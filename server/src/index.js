import cors from 'cors'
import express from 'express'
import { config } from './config.js'
import { requireUser } from './auth.js'
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

app.use('/api', requireUser, routes)

app.use((err, _req, res, _next) => {
  const status = Number(err?.status) || 500
  if (status >= 500) console.error(err)
  // errors raised on purpose (they carry a status) are safe to show; anything else stays generic
  res.status(status).json({ error: err?.status ? err.message : 'Internal server error', detail: err instanceof Error ? err.message : String(err) })
})

const server = app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`)
})

async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down...`)
  server.close(() => process.exit(0))
}

process.on('SIGINT', () => { void shutdown('SIGINT') })
process.on('SIGTERM', () => { void shutdown('SIGTERM') })
