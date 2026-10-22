import { run, supabase } from './db.js'
import { blockCredit, dueDate, MONTHS_BACK } from './utils.js'

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
