import { Router } from 'express'
import { checkIn, markAllAlertsRead, redeem, resetDemo, subscribe, updateMe } from './actions.js'
import { GREEN, logTrip } from './green.js'
import { planSummary, skipMonth, startPlan, stopPlan, syncPlan, updatePlan } from './plan.js'
import { syncBlockCredits, syncGenerationPoints } from './credits.js'
import { availability, book, bookingsOf, cancel as cancelBooking, EV, finish as finishCharging, pay as payCharging, start as startCharging } from './ev.js'
import { config } from './config.js'
import { analyst } from './llm.js'
import { run, supabase } from './db.js'
import { alertsFor, catalogue, environmentalImpact, me, portfolioSummary, projectedScenarios, projectPerformance, realizedReturn, tripsOf } from './services.js'
import { HttpError } from './utils.js'

const router = Router()

/** wrap an async handler so thrown errors reach the error middleware */
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)

/* ---------- health ---------- */

router.get('/health', h(async (_req, res) => {
  const { count, error } = await supabase.from('townships').select('id', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  res.json({ ok: true, at: new Date().toISOString(), townships: count })
}))

/* ---------- catalogue + the signed-in resident ---------- */

router.get('/catalogue', h(async (req, res) => res.json(await catalogue(req.userId))))
router.get('/me', h(async (req, res) => {
  await syncPlan(req.userId).catch((err) => console.error('plan sync failed', err))
  // independent of each other: credits write payouts, generation writes the points ledger
  await Promise.all([
    syncBlockCredits(req.userId).catch((err) => console.error('credit sync failed', err)),
    syncGenerationPoints(req.userId).catch((err) => console.error('generation points sync failed', err)),
  ])
  res.json(await me(req.userId))
}))
router.patch('/me', h(async (req, res) => res.json(await updateMe(req.userId, req.body))))

router.post('/subscriptions', h(async (req, res) => {
  res.status(201).json(await subscribe(req.userId, String(req.body?.siteId ?? ''), req.body?.units))
}))
router.post('/redemptions', h(async (req, res) => {
  res.status(201).json(await redeem(req.userId, String(req.body?.rewardId ?? ''), req.body?.code))
}))
router.post('/checkins', h(async (req, res) => res.status(201).json(await checkIn(req.userId))))
/* Solar Builder Plan: monthly payments returned over 10 years + 3% a year */
router.get('/plan', h(async (req, res) => res.json(await planSummary(req.userId))))
router.post('/plan', h(async (req, res) => {
  await startPlan(req.userId, req.body)
  res.status(201).json({ ...(await planSummary(req.userId)), me: await me(req.userId) })
}))
router.patch('/plan', h(async (req, res) => {
  await updatePlan(req.userId, req.body)
  res.json({ ...(await planSummary(req.userId)), me: await me(req.userId) })
}))
router.delete('/plan', h(async (req, res) => {
  await stopPlan(req.userId)
  res.json({ ...(await planSummary(req.userId)), me: await me(req.userId) })
}))
// prototype demo tool: pretend a month has passed (hidden when SHOW_TEST_ACCOUNTS=false)
router.post('/plan/skip-month', h(async (req, res) => {
  if (!config.showTestAccounts) throw new HttpError(404, 'Not available')
  await skipMonth(req.userId)
  res.json({ ...(await planSummary(req.userId)), me: await me(req.userId) })
}))

/* EV charging: book a bay, charge, pay after */
const evResult = async (userId) => ({ ...(await bookingsOf(userId)), me: await me(userId) })
router.get('/ev/rules', (_req, res) => res.json(EV))
router.get('/ev/availability', h(async (req, res) => res.json(await availability(req.query.siteId, req.query.date))))
router.get('/ev/bookings', h(async (req, res) => res.json(await bookingsOf(req.userId))))
router.post('/ev/bookings', h(async (req, res) => { await book(req.userId, req.body); res.status(201).json(await evResult(req.userId)) }))
router.post('/ev/bookings/:id/cancel', h(async (req, res) => { await cancelBooking(req.userId, req.params.id); res.json(await evResult(req.userId)) }))
router.post('/ev/bookings/:id/start', h(async (req, res) => { await startCharging(req.userId, req.params.id, !!req.body?.demo); res.json(await evResult(req.userId)) }))
router.post('/ev/bookings/:id/finish', h(async (req, res) => { await finishCharging(req.userId, req.params.id); res.json(await evResult(req.userId)) }))
router.post('/ev/bookings/:id/pay', h(async (req, res) => { await payCharging(req.userId, req.params.id); res.json(await evResult(req.userId)) }))

/* Go Green: walk or cycle in your township to earn points */
router.get('/green/rules', (_req, res) => res.json(GREEN))
router.get('/green/trips', h(async (req, res) => res.json(await tripsOf(req.userId, Math.min(100, Number(req.query.limit) || 30)))))
router.post('/green/trips', h(async (req, res) => res.status(201).json(await logTrip(req.userId, req.body))))

router.post('/demo/reset', h(async (req, res) => res.json(await resetDemo(req.userId))))

/* ---------- AI analyst tools ---------- */

router.get('/portfolio/summary', h(async (req, res) => res.json(await portfolioSummary(req.userId))))
router.get('/returns/realized', h(async (req, res) => res.json(await realizedReturn(req.userId))))
router.post('/scenarios/projected', h(async (req, res) => res.json(projectedScenarios(Number(req.body?.amount), Number(req.body?.years)))))
router.get('/projects/:projectId/performance', h(async (req, res) => res.json(await projectPerformance(req.params.projectId))))
router.get('/impact/environmental', h(async (req, res) => res.json(await environmentalImpact(req.userId))))

/* ---------- alerts ---------- */

router.get('/alerts', h(async (req, res) => res.json(await alertsFor(req.userId))))
router.post('/alerts/read-all', h(async (req, res) => { await markAllAlertsRead(req.userId); res.status(204).send() }))
router.post('/alerts/:id/read', h(async (req, res) => {
  const owned = await run(supabase.from('alerts').select('id').eq('id', req.params.id).eq('user_id', req.userId).limit(1))
  if (!owned.length) throw new HttpError(404, 'Alert not found')
  await run(supabase.from('alert_reads').upsert({ alert_id: req.params.id, user_id: req.userId }, { onConflict: 'alert_id,user_id', ignoreDuplicates: true }))
  res.status(204).send()
}))

/* ---------- Solar Analyst chat ---------- */

const toMessage = (m) => ({
  id: m.id,
  role: m.role,
  content: m.content,
  createdAt: new Date(m.created_at).toISOString(),
  toolCalls: m.tool_calls ?? undefined,
  attachments: m.attachments ?? undefined,
  suggestions: m.suggestions ?? undefined,
})

/** the conversation must be the caller's; a new id is created on first use */
async function ensureConversation(conversationId, userId) {
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) throw new HttpError(400, 'Invalid conversation id')
  const rows = await run(supabase.from('conversations').select('id, user_id').eq('id', conversationId).limit(1))
  if (rows[0] && rows[0].user_id !== userId) throw new HttpError(404, 'Conversation not found')
  if (!rows[0]) {
    await me(userId) // makes sure the profile exists
    await run(supabase.from('conversations').insert({ id: conversationId, user_id: userId, title: 'Solar Analyst' }))
  }
}

/** the resident's own Solar Analyst conversation (latest, or a new one) */
async function myConversation(userId) {
  const rows = await run(supabase.from('conversations').select('id').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1))
  if (rows[0]) return rows[0].id
  await me(userId)
  return (await run(supabase.from('conversations').insert({ user_id: userId, title: 'Solar Analyst' }).select('id')))[0].id
}

async function listMessages(conversationId) {
  const rows = await run(supabase.from('messages')
    .select('id, role, content, created_at, tool_calls, attachments, suggestions')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true }))
  return rows.map(toMessage)
}

async function postMessage(conversationId, userId, raw) {
  const text = String(raw ?? '').trim().slice(0, 2000)
  if (!text) throw new HttpError(400, 'text is required')
  const history = (await listMessages(conversationId)).slice(-10)
  await run(supabase.from('messages').insert({ conversation_id: conversationId, role: 'user', content: text }))
  const reply = await analyst(userId, text, history)
  const [saved] = await run(supabase.from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: reply.content,
      tool_calls: reply.toolCalls ?? null,
      attachments: reply.attachments ?? null,
      suggestions: reply.suggestions ?? null,
    })
    .select('id, role, content, created_at, tool_calls, attachments, suggestions'))
  await run(supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId))
  return toMessage(saved)
}

const clearMessages = (conversationId) => run(supabase.from('messages').delete().eq('conversation_id', conversationId))

// the signed-in resident's conversation
router.get('/chat/messages', h(async (req, res) => res.json(await listMessages(await myConversation(req.userId)))))
router.post('/chat/messages', h(async (req, res) => res.json(await postMessage(await myConversation(req.userId), req.userId, req.body?.text))))
router.delete('/chat/messages', h(async (req, res) => { await clearMessages(await myConversation(req.userId)); res.status(204).send() }))

// a specific conversation (must be the caller's)
router.get('/conversations/:conversationId/messages', h(async (req, res) => {
  await ensureConversation(req.params.conversationId, req.userId)
  res.json(await listMessages(req.params.conversationId))
}))
router.post('/conversations/:conversationId/messages', h(async (req, res) => {
  await ensureConversation(req.params.conversationId, req.userId)
  res.json(await postMessage(req.params.conversationId, req.userId, req.body?.text))
}))
router.delete('/conversations/:conversationId/messages', h(async (req, res) => {
  await ensureConversation(req.params.conversationId, req.userId)
  await clearMessages(req.params.conversationId)
  res.status(204).send()
}))

/* kept for older frontends: makes sure the profile and conversation exist */
router.post('/demo/seed', h(async (req, res) => {
  const conversationId = String(req.body?.conversationId ?? '').trim()
  await me(req.userId)
  if (conversationId) await ensureConversation(conversationId, req.userId)
  res.json({ conversationId, alerts: (await alertsFor(req.userId)).length, messages: 0 })
}))

export default router
