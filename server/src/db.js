import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'
import { HttpError } from './utils.js'

/**
 * Supabase client using the service-role key. It talks to the database over HTTPS (port 443),
 * so it works on networks that block the Postgres ports 5432/6543. The service role bypasses
 * RLS, so every query must filter by the caller's user id itself.
 */
export const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function fail(error) {
  // unique violation → 409 so callers can tell "already taken" from a real failure
  const status = error.code === '23505' ? 409 : error.code === 'P0001' ? 400 : 500
  const err = new HttpError(status, `${error.message}${error.details ? ` (${error.details})` : ''}`)
  err.code = error.code
  return err
}

/** await a Supabase query builder and return its rows, throwing on error */
export async function run(builder) {
  const { data, error } = await builder
  if (error) throw fail(error)
  return data
}

/** number of rows matching a filtered `select('*', { count: 'exact', head: true })` */
export async function count(builder) {
  const { count: n, error } = await builder
  if (error) throw fail(error)
  return n ?? 0
}

/**
 * every row of a query, paging past the REST API's 1,000-row cap.
 * `make` must return a fresh, deterministically ordered query each call.
 */
export async function all(make, pageSize = 1000) {
  const out = []
  for (let from = 0; ; from += pageSize) {
    const rows = await run(make().range(from, from + pageSize - 1))
    out.push(...rows)
    if (rows.length < pageSize) return out
  }
}

/** call a Postgres function (RPC) */
export const rpc = (fn, args) => run(supabase.rpc(fn, args))
