import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL?.trim()
// accept either name for the service-role key
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE)?.trim()

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL (Supabase > Project Settings > API > Project URL)')
}
if (!/^https:\/\/.+/.test(supabaseUrl)) {
  throw new Error('SUPABASE_URL must be the https://<project-ref>.supabase.co address, not a postgresql:// connection string')
}
if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (Supabase > Project Settings > API > service_role secret)')
}

export const config = {
  supabaseUrl,
  serviceRoleKey,
  port: Number(process.env.PORT ?? 2000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  /** signs login tokens; derived from the service-role key when not set */
  sessionSecret: process.env.SESSION_SECRET?.trim() || '',
  /** list every account on the login page for prototype testing (SHOW_TEST_ACCOUNTS=false hides it) */
  showTestAccounts: process.env.SHOW_TEST_ACCOUNTS?.trim().toLowerCase() !== 'false',
}
