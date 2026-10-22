// Vercel serverless function: vercel.json rewrites every /api/* request here, and the
// Express backend in /server routes it (req.url keeps the original /api/... path).
// Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SESSION_SECRET in the Vercel project settings.
import app from '../server/src/app.js'

export default app
