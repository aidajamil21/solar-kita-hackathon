/**
 * The Express app, shared by the local server (index.js) and the Vercel function (api/index.js).
 */
import cors from 'cors'
import express from 'express'
import { config } from './config.js'
import { authRoutes, requireUser } from './auth.js'
import { supabase } from './db.js'
import routes from './routes.js'

const app = express()

// FRONTEND_URL may list several origins separated by commas
app.use(cors({ origin: config.frontendUrl.split(',').map((o) => o.trim()), credentials: true }))
// GPS paths from long walks can be a few hundred KB
app.use(express.json({ limit: '2mb' }))

app.get('/', (_req, res) => {
  res.json({
    service: 'solar-kita-server',
    ok: true,
    at: new Date().toISOString(),
  })
})

// public: health check and email sign-in
app.get('/api/health', async (_req, res) => {
  const { count, error } = await supabase.from('townships').select('id', { count: 'exact', head: true })
  res.status(error ? 503 : 200).json({ ok: !error, at: new Date().toISOString(), townships: count ?? 0 })
})
app.use('/api/auth', authRoutes)

// everything else needs a signed-in resident
app.use('/api', requireUser, routes)

app.use((err, _req, res, _next) => {
  const status = Number(err?.status) || 500
  if (status >= 500) console.error(err)
  // errors raised on purpose (they carry a status) are safe to show; anything else stays generic
  res.status(status).json({ error: err?.status ? err.message : 'Internal server error', detail: err instanceof Error ? err.message : String(err) })
})

export default app
