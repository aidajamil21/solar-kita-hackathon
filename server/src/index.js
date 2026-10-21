import cors from 'cors'
import express from 'express'
import { config } from './config.js'
import { pool } from './db.js'
import { requireUser } from './auth.js'
import routes from './routes.js'

const app = express()

app.use(cors({ origin: [config.frontendUrl], credentials: true }))
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({
    service: 'solar-kita-server',
    ok: true,
    at: new Date().toISOString(),
  })
})

app.use('/api', requireUser, routes)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

const server = app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`)
})

async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down...`)
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.on('SIGINT', () => { void shutdown('SIGINT') })
process.on('SIGTERM', () => { void shutdown('SIGTERM') })
