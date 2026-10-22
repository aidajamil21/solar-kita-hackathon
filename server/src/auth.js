import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { config } from './config.js'
import { run, rpc, supabase } from './db.js'
import { ensureProfile } from './services.js'
import { HttpError } from './utils.js'

/**
 * Email sign-in for the prototype: residents type their email, no password or code.
 * The server looks the email up in Supabase Auth (creating the account on first sign-up)
 * and hands back a signed session token that every /api call must carry.
 * Anyone who knows a resident's email can sign in as them, so add an emailed
 * one-time code (Supabase signInWithOtp) before real residents use it.
 */

const SECRET = config.sessionSecret || createHash('sha256').update(`solar-kita-session:${config.serviceRoleKey}`).digest('hex')
const DAYS = 30
const b64 = (s) => Buffer.from(s).toString('base64url')

export function signSession(userId, email) {
  const payload = b64(JSON.stringify({ sub: userId, email, exp: Date.now() + DAYS * 86_400_000 }))
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

function verifySession(token) {
  const [payload, sig] = String(token).split('.')
  if (!payload || !sig) return null
  const want = createHmac('sha256', SECRET).update(payload).digest()
  const got = Buffer.from(sig, 'base64url')
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return data.exp > Date.now() && data.sub ? data : null
  } catch {
    return null
  }
}

/** every /api route below this needs `Authorization: Bearer <token>` */
export function requireUser(req, res, next) {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '')
  const session = token ? verifySession(token) : null
  if (!session) return res.status(401).json({ error: 'Please sign in again' })
  req.userId = session.sub
  req.userEmail = session.email
  return next()
}

/* ---------- sign-in routes (public) ---------- */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const cleanEmail = (raw) => {
  const email = String(raw ?? '').trim().toLowerCase()
  if (!EMAIL.test(email) || email.length > 254) throw new HttpError(400, 'Enter a valid email address')
  return email
}

async function findUser(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new HttpError(500, error.message)
    const hit = data.users.find((u) => u.email?.toLowerCase() === email)
    if (hit) return hit
    if (data.users.length < 1000) return null
  }
  return null
}

async function session(user) {
  const profile = await ensureProfile(user.id)
  return { token: signSession(user.id, user.email), email: user.email, name: profile.full_name ?? '' }
}

const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
export const authRoutes = Router()

/** prototype testing: every account's email and name, for the login page's picker */
authRoutes.get('/accounts', h(async (_req, res) => {
  if (!config.showTestAccounts) return res.json([])
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new HttpError(500, error.message)
  const profiles = await run(supabase.from('profiles').select('id, full_name'))
  const names = new Map(profiles.map((p) => [p.id, p.full_name]))
  res.json(data.users
    .filter((u) => u.email)
    .map((u) => ({ email: u.email, name: names.get(u.id) ?? u.user_metadata?.full_name ?? '' }))
    .sort((a, b) => a.email.localeCompare(b.email)))
}))

/** step 1: an existing resident gets a session; a new email is told to sign up */
authRoutes.post('/login', h(async (req, res) => {
  const email = cleanEmail(req.body?.email)
  const user = await findUser(email)
  if (!user) return res.json({ isNew: true, email })
  res.json({ isNew: false, ...(await session(user)) })
}))

/** step 2 for new residents: create the account with a name and home township */
authRoutes.post('/register', h(async (req, res) => {
  const email = cleanEmail(req.body?.email)
  const name = String(req.body?.name ?? '').trim()
  if (!name || name.length > 80) throw new HttpError(400, 'Enter your name')
  const townshipId = String(req.body?.townshipId ?? '')
  const town = await run(supabase.from('townships').select('id').eq('id', townshipId).limit(1))
  if (!town.length) throw new HttpError(400, 'Choose your township')

  const existing = await findUser(email)
  if (existing) return res.json(await session(existing))

  const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name } })
  if (error) throw new HttpError(400, error.message)
  await ensureProfile(data.user.id)
  await run(supabase.from('profiles').update({ full_name: name, township_id: townshipId }).eq('id', data.user.id))
  await rpc('apply_points', {
    p_user_id: data.user.id, p_delta: 50, p_activity: 'bonus', p_title: 'Welcome to Solar Kita',
    p_idempotency_key: `welcome:${data.user.id}`, p_metadata: {},
  })
  res.status(201).json(await session(data.user))
}))
