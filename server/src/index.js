import app from './app.js'
import { config } from './config.js'

// local server: `npm run dev` in /server (on Vercel, api/[...path].js serves the same app)
const server = app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`)
})

async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down...`)
  server.close(() => process.exit(0))
}

process.on('SIGINT', () => { void shutdown('SIGINT') })
process.on('SIGTERM', () => { void shutdown('SIGTERM') })
