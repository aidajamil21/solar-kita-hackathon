import { rpc, run, supabase } from './db.js'
import { blockCredit, dueDate, MONTHS, monthlyKwh, MONTHS_BACK, POINTS } from './utils.js'

/**
 * Energy Savings Credits for block purchases (one-off blocks, rooftop sections, charger bays).
 * Each completed purchase is returned over 120 months, starting the month after it's paid:
 * 1/120 of the price every month, plus the project's expected return (scaled by sunshine) on
 * the part not yet returned. Credits that have fallen due are "completed" and the next one is
 * "pending". There is no background job, so this runs whenever the resident's data is read.
 * (Solar Builder Plan credits are kept by plan.js.)
 */
export async function syncBlockCredits(userId) {
  const [contributions, sites, existing] = await Promise.all([
    run(supabase.from('contributions').select('*').eq('user_id', userId).eq('status', 'completed')),
    run(supabase.from('sites').select('id, return_low_pct, return_high_pct')),
    run(supabase.from('payouts').select('id, external_reference, status, due_at').eq('user_id', userId).not('subscription_id', 'is', null)),
  ])
  const rate = new Map(sites.map((s) => [s.id, (Number(s.return_low_pct ?? 0) + Number(s.return_high_pct ?? 0)) / 200]))
  const now = Date.now()

  const desired = new Map()
  for (const c of contributions) {
    if (!c.subscription_id || c.plan_payment_id) continue
    const paid = new Date(c.contributed_at)
    for (let k = 1; k <= MONTHS_BACK; k++) {
      const month = new Date(Date.UTC(paid.getUTCFullYear(), paid.getUTCMonth() + k, 1))
      const due = dueDate(month)
      const done = due.getTime() <= now
      const credit = blockCredit(Number(c.amount), rate.get(c.site_id) ?? 0, k, month)
      const ref = `SK-PAY-${c.id}-${k}`
      desired.set(ref, {
        user_id: userId, site_id: c.site_id, subscription_id: c.subscription_id,
        amount: credit.amount, status: done ? 'completed' : 'pending',
        due_at: due.toISOString(), paid_at: done ? due.toISOString() : null, external_reference: ref,
      })
      if (!done) break // only the next upcoming credit
    }
  }

  // keep rows that already match (status and due date); rebuild the rest
  const stale = existing.filter((e) => {
    const want = desired.get(e.external_reference)
    return !want || want.status !== e.status || new Date(e.due_at).getTime() !== new Date(want.due_at).getTime()
  })
  for (let i = 0; i < stale.length; i += 200) await run(supabase.from('payouts').delete().in('id', stale.slice(i, i + 200).map((e) => e.id)))
  const keep = new Set(existing.filter((e) => !stale.includes(e)).map((e) => e.external_reference))
  const toInsert = [...desired.values()].filter((d) => !keep.has(d.external_reference))
  for (let i = 0; i < toInsert.length; i += 500) await run(supabase.from('payouts').insert(toInsert.slice(i, i + 500)))
}

/**
 * Generation points for block purchases: 1 per 10 kWh the resident's panels made, one ledger entry per month, added
 * once that month's credits are paid (the 28th). Each purchase generates from the month after it was paid, like its
 * credits, and only months from POINTS.generationFrom count, so nobody gets a lump of back-dated points.
 * Idempotent: the ledger key is per resident and month, so it is safe to run on every read.
 */
export async function syncGenerationPoints(userId) {
  const [contributions, sites, done] = await Promise.all([
    run(supabase.from('contributions').select('site_id, amount, contributed_at, plan_payment_id, subscription_id').eq('user_id', userId).eq('status', 'completed')),
    run(supabase.from('sites').select('id, price_per_unit, kwp_per_unit')),
    run(supabase.from('point_ledger').select('idempotency_key').eq('user_id', userId).like('idempotency_key', 'gen:%')),
  ])
  const site = new Map(sites.map((s) => [s.id, s]))
  const have = new Set(done.map((d) => d.idempotency_key))
  const blocks = contributions.filter((c) => c.subscription_id && !c.plan_payment_id && Number(site.get(c.site_id)?.price_per_unit) > 0)
  if (!blocks.length) return

  const now = new Date()
  const start = new Date(POINTS.generationFrom)
  for (let t = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1); ;) {
    const month = new Date(t)
    if (dueDate(month).getTime() > now.getTime()) break
    const key = `gen:${userId}:${month.toISOString().slice(0, 7)}`
    if (!have.has(key)) {
      let kwh = 0
      for (const c of blocks) {
        const paid = new Date(c.contributed_at)
        if (Date.UTC(paid.getUTCFullYear(), paid.getUTCMonth(), 1) >= t) continue // generates from the month after paying
        const s = site.get(c.site_id)
        const units = Math.round(Number(c.amount) / Number(s.price_per_unit))
        kwh += monthlyKwh(units * Number(s.kwp_per_unit), month)
      }
      const points = Math.floor(kwh / POINTS.kwhPerPoint)
      if (points > 0) {
        await rpc('apply_points', {
          p_user_id: userId, p_delta: points, p_activity: 'bonus',
          p_title: `Solar generation · ${MONTHS[month.getUTCMonth()]} ${month.getUTCFullYear()} (${Math.round(kwh)} kWh)`,
          p_idempotency_key: key, p_metadata: { kwh: Math.round(kwh) },
        })
      }
    }
    t = Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)
  }
}

/** how much of a purchase has come back and the "money-years" it was outstanding, as of now */
export function returnedSoFar(amount, paidAt) {
  const P = Number(amount)
  const paid = new Date(paidAt)
  const now = Date.now()
  let capital = 0
  let exposure = 0 // RM-years outstanding, for an annualised rate
  for (let k = 1; k <= MONTHS_BACK; k++) {
    const due = dueDate(new Date(Date.UTC(paid.getUTCFullYear(), paid.getUTCMonth() + k, 1)))
    if (due.getTime() > now) break
    const c = blockCredit(P, 0, k, due)
    exposure += (P - capital) / 12
    capital += c.capital
  }
  return { capital: Math.round(capital * 100) / 100, exposure }
}
