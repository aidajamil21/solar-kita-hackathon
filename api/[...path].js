// Vercel serverless function: every /api/* request is handled by the Express backend in /server.
// Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SESSION_SECRET in the Vercel project settings.
import app from '../server/src/app.js'

export default app
