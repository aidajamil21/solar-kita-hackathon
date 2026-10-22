import { run, rpc, supabase } from './db.js'
import { dueDate, HttpError, MONTHS_LONG, rm, todayKL } from './utils.js'

/**
 * Solar Builder Plan: a fixed monthly payment that supports a township solar farm.
 * Each payment ("tranche") is returned over 120 months, starting the month after it's paid:
 * 1/120 of it every month, plus 3% a year on the part not yet returned. Keep in sync with src/plan.ts.
 *
 * There is no background job, so payments and credits are brought up to date ("synced")
 * whenever the resident's data is read.
 */
export const PLAN = {
  months: 120,
  ratePct: 3,
  minAmount: 50,
  maxAmount: 10000,
  /** 1 point per RM 5 paid */
  rmPerPoint: 5,
  /** bonus points when the streak of consecutive payments reaches these counts */
  streakBonuses: [{ at: 6, points: 50 }],
  /** and this many points every 12 consecutive payments */
  yearlyBonus: 100,
}

const round2 = (n) => Math.round(n * 100) / 100

/** month start (UTC) `k` months after the month of `date` */
const monthAfter = (date, k) => { const d = new Date(date); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1)) }

/** the 120 monthly credits for one payment: capital back + 3% a year on what's still outstanding */
export function trancheSchedule(amount, paidAt) {
  const P = Number(amount)
  const cap = round2(P / PLAN.months)
  const out = []
  for (let k = 1; k <= PLAN.months; k++) {
    const capital = k < PLAN.months ? cap : round2(P - cap * (PLAN.months - 1))
    const outstanding = P - cap * (k - 1)
    const interest = round2((outstanding * PLAN.ratePct) / 100 / 12)
    out.push({ k, due: dueDate(monthAfter(paidAt, k)), capital, interest })
  }
  return out
}

/** same day next month (charge days are 1-28, so no month-end overflow) */
const nextMonth = (date, day) => { const d = new Date(date); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, day, d.getUTCHours(), d.getUTCMinutes())) }
/** one month earlier, keeping the day where possible */
const monthBefore = (date) => {
  const d = new Date(date)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0)).getUTCDate()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, Math.min(d.getUTCDate(), last), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()))
}

function missingTable(error) {
  return error && /builder_plans|builder_payments|plan_payment_id/.test(error.message)
}
const SETUP = 'The Solar Builder Plan isn’t set up on the database yet: run server/plan.sql in the Supabase SQL Editor.'

async function plansOf(userId) {
  const { data, error } = await supabase.from('builder_plans').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (missingTable(error)) return null
  if (error) throw new HttpError(500, error.message)
  return data
}

/* ---------- monthly processing ---------- */

/** take every payment that has fallen due, with its points and streak bonuses */
async function chargeDue(plan) {
  if (plan.status !== 'active' || !plan.next_charge_at) return 0
  const now = Date.now()
  const site = (await run(supabase.from('sites').select('name').eq('id', plan.site_id).limit(1)))[0]
  const last = await run(supabase.from('builder_payments').select('seq').eq('plan_id', plan.id).order('seq', { ascending: false }).limit(1))
  let seq = last[0]?.seq ?? 0
  let streak = plan.streak
  let next = new Date(plan.next_charge_at)
  let charged = 0

  for (let guard = 0; next.getTime() <= now && guard < 36; guard++) {
    seq += 1
    const amount = Number(plan.monthly_amount)
    const points = Math.floor(amount / PLAN.rmPerPoint)
    let payment
    try {
      payment = (await run(supabase.from('builder_payments').insert({
        plan_id: plan.id, user_id: plan.user_id, seq, amount, paid_at: next.toISOString(), points,
      }).select('id')))[0]
    } catch (err) {
      if (err.status === 409) break // another request is processing this plan
      throw err
    }
    streak += 1
    charged += 1
    await run(supabase.from('contributions').insert({
      user_id: plan.user_id, site_id: plan.site_id, subscription_id: null, amount, status: 'completed',
      external_reference: `SK-PLANPAY-${payment.id}`, contributed_at: next.toISOString(), settled_at: next.toISOString(),
      plan_payment_id: payment.id,
    }))
    const month = `${MONTHS_LONG[next.getUTCMonth()]} ${next.getUTCFullYear()}`
    if (points > 0) {
      await rpc('apply_points', {
        p_user_id: plan.user_id, p_delta: points, p_activity: 'plan', p_title: `Solar Builder Plan · ${month}`,
        p_idempotency_key: `plan:${plan.id}:pay:${seq}`, p_metadata: { plan_id: plan.id, amount, site_id: plan.site_id },
      })
    }
    const bonus = (PLAN.streakBonuses.find((b) => b.at === streak)?.points ?? 0) + (streak % 12 === 0 ? PLAN.yearlyBonus : 0)
    if (bonus) {
      await rpc('apply_points', {
        p_user_id: plan.user_id, p_delta: bonus, p_activity: 'plan', p_title: `Solar Builder streak: ${streak} months in a row`,
        p_idempotency_key: `plan:${plan.id}:streak:${seq}`, p_metadata: { plan_id: plan.id, streak },
      })
      await notify(plan.user_id, {
        type: 'rewards_milestone', severity: 'success', title: 'Solar Builder streak',
        body: `${streak} monthly payments in a row! You earned ${bonus} bonus points.`, site_id: plan.site_id,
      })
    }
    next = nextMonth(next, plan.charge_day)
  }

  await run(supabase.from('builder_plans').update({ next_charge_at: next.toISOString(), streak }).eq('id', plan.id))
  if (charged) {
    const amount = Number(plan.monthly_amount) * charged
    await notify(plan.user_id, {
      type: 'contribution_recorded', severity: 'success', title: 'Solar Builder payment received', site_id: plan.site_id,
      body: `${rm(amount)} received for your Solar Builder Plan${site ? ` supporting ${site.name}` : ''}. It comes back to you over 10 years, plus 3% a year.`,
    })
  }
  return charged
}

/** write every credit that has fallen due (completed) and each tranche's next one (pending) into payouts */
async function syncCredits(userId, plans) {
  const payments = await run(supabase.from('builder_payments').select('id, plan_id, amount, paid_at').eq('user_id', userId))
  const siteOf = new Map(plans.map((p) => [p.id, p.site_id]))
  const now = Date.now()
  const desired = new Map()
  for (const pay of payments) {
    for (const c of trancheSchedule(pay.amount, pay.paid_at)) {
      const due = c.due.getTime()
      const done = due <= now
      desired.set(`SK-PLAN-${pay.id}-${c.k}`, {
        user_id: userId, site_id: siteOf.get(pay.plan_id), subscription_id: null, plan_payment_id: pay.id,
        amount: round2(c.capital + c.interest), status: done ? 'completed' : 'pending',
        due_at: c.due.toISOString(), paid_at: done ? c.due.toISOString() : null,
        external_reference: `SK-PLAN-${pay.id}-${c.k}`,
      })
      if (!done) break
    }
  }

  const existing = payments.length
    ? await run(supabase.from('payouts').select('id, external_reference, status, due_at').in('plan_payment_id', payments.map((p) => p.id)))
    : []
  const have = new Map(existing.map((e) => [e.external_reference, e]))
  const stale = existing.filter((e) => {
    const want = desired.get(e.external_reference)
    return !want || want.status !== e.status || new Date(e.due_at).getTime() !== new Date(want.due_at).getTime()
  })
  if (stale.length) await run(supabase.from('payouts').delete().in('id', stale.map((e) => e.id)))
  const staleRefs = new Set(stale.map((e) => e.external_reference))
  const toInsert = [...desired.values()].filter((d) => !have.has(d.external_reference) || staleRefs.has(d.external_reference))
  for (let i = 0; i < toInsert.length; i += 500) await run(supabase.from('payouts').insert(toInsert.slice(i, i + 500)))
}

/** bring the resident's plan up to date; quietly does nothing if plan.sql hasn't been run */
export async function syncPlan(userId) {
  const plans = await plansOf(userId)
  if (!plans?.length) return
  for (const plan of plans) await chargeDue(plan)
  await syncCredits(userId, plans)
}

async function notify(userId, alert) {
  const [row] = await run(supabase.from('alerts').insert({ user_id: userId, detection: 'database_event', ...alert }).select('id'))
  await run(supabase.from('notification_deliveries').insert({ alert_id: row.id, channel: 'in_app', status: 'sent', attempts: 1, sent_at: new Date().toISOString() }))
}

/* ---------- what the app shows ---------- */

export async function planSummary(userId) {
  const plans = await plansOf(userId)
  if (plans === null) return { setup: false, rules: PLAN }
  await syncPlan(userId)
  const fresh = await plansOf(userId)
  const current = fresh.find((p) => p.status !== 'cancelled') ?? fresh[0] ?? null

  const payments = fresh.length
    ? await run(supabase.from('builder_payments').select('id, plan_id, seq, amount, paid_at, points').eq('user_id', userId).order('paid_at', { ascending: false }))
    : []
  const now = Date.now()
  let paid = 0, returned = 0, extra = 0, expectedTotal = 0
  const byMonth = new Map() // due month -> amount
  for (const pay of payments) {
    paid += Number(pay.amount)
    for (const c of trancheSchedule(pay.amount, pay.paid_at)) {
      const amount = c.capital + c.interest
      expectedTotal += amount
      const key = c.due.toISOString().slice(0, 7)
      byMonth.set(key, (byMonth.get(key) ?? 0) + amount)
      if (c.due.getTime() <= now) { returned += c.capital; extra += c.interest }
    }
  }
  const thisMonth = new Date().toISOString().slice(0, 7)
  const months = [...byMonth.keys()].sort()
  const lastDone = months.filter((m) => m < thisMonth || (m === thisMonth && dueDate(new Date(`${m}-01T00:00:00Z`)).getTime() <= now)).pop()
  const nextKey = months.find((m) => dueDate(new Date(`${m}-01T00:00:00Z`)).getTime() > now)

  const sites = current ? await run(supabase.from('sites').select('id, name, township_id').eq('id', current.site_id).limit(1)) : []
  return {
    setup: true,
    rules: PLAN,
    plan: current && {
      id: current.id,
      siteId: current.site_id,
      siteName: sites[0]?.name ?? current.site_id,
      monthlyAmount: Number(current.monthly_amount),
      status: current.status,
      chargeDay: current.charge_day,
      nextChargeAt: current.next_charge_at,
      streak: current.streak,
      startedAt: current.started_at,
      cancelledAt: current.cancelled_at,
    },
    payments: payments.map((p) => ({ id: p.id, seq: p.seq, amount: Number(p.amount), paidAt: p.paid_at, points: p.points })),
    totals: {
      paid: round2(paid),
      returned: round2(returned),
      extra: round2(extra),
      received: round2(returned + extra),
      outstanding: round2(paid - returned),
      expectedTotal: round2(expectedTotal),
      lastCredit: lastDone ? { month: lastDone, amount: round2(byMonth.get(lastDone)) } : null,
      nextCredit: nextKey ? { date: dueDate(new Date(`${nextKey}-01T00:00:00Z`)).toISOString(), amount: round2(byMonth.get(nextKey)) } : null,
    },
    /** monthly credits from the first one to the next upcoming one */
    credits: months.filter((m) => !nextKey || m <= nextKey).slice(-12).map((m) => ({ month: m, amount: round2(byMonth.get(m)), upcoming: m === nextKey })),
  }
}

/* ---------- changes ---------- */

const cleanAmount = (raw) => {
  const amount = Math.round(Number(raw) * 100) / 100
  if (!Number.isFinite(amount) || amount < PLAN.minAmount || amount > PLAN.maxAmount) {
    throw new HttpError(400, `Monthly amount must be between RM ${PLAN.minAmount} and RM ${PLAN.maxAmount.toLocaleString('en-MY')}`)
  }
  return amount
}

async function openPlan(userId) {
  const plans = await plansOf(userId)
  if (plans === null) throw new HttpError(503, SETUP)
  return plans.find((p) => p.status !== 'cancelled') ?? null
}

export async function startPlan(userId, body) {
  if (await openPlan(userId)) throw new HttpError(409, 'You already have a Solar Builder Plan. Change or stop it instead.')
  const amount = cleanAmount(body?.monthlyAmount)
  const site = (await run(supabase.from('sites').select('id, name, status').eq('id', String(body?.siteId ?? '')).limit(1)))[0]
  if (!site) throw new HttpError(400, 'Choose a solar farm to support')
  if (site.status !== 'active') throw new HttpError(400, 'That project isn’t open yet')

  const now = new Date()
  const day = Math.min(28, Number(todayKL().slice(8, 10)))
  try {
    await run(supabase.from('builder_plans').insert({
      user_id: userId, site_id: site.id, monthly_amount: amount, status: 'active', charge_day: day,
      next_charge_at: now.toISOString(), started_at: now.toISOString(), streak: 0,
    }))
  } catch (err) {
    if (err.status === 409) throw new HttpError(409, 'You already have a Solar Builder Plan.')
    throw err
  }
  await syncPlan(userId) // takes the first payment now
}

export async function updatePlan(userId, body) {
  const plan = await openPlan(userId)
  if (!plan) throw new HttpError(404, 'You don’t have a Solar Builder Plan')
  const patch = {}
  if (body?.monthlyAmount !== undefined) patch.monthly_amount = cleanAmount(body.monthlyAmount)
  if (body?.status === 'paused' && plan.status === 'active') {
    Object.assign(patch, { status: 'paused', next_charge_at: null, streak: 0 })
  } else if (body?.status === 'active' && plan.status === 'paused') {
    // resume on the next charge day (no back payments for the paused months)
    const now = new Date()
    let next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), plan.charge_day, now.getUTCHours(), now.getUTCMinutes()))
    if (next.getTime() < now.getTime()) next = nextMonth(next, plan.charge_day)
    Object.assign(patch, { status: 'active', next_charge_at: next.toISOString() })
  } else if (body?.status && body.status !== plan.status) {
    throw new HttpError(400, 'status must be active or paused')
  }
  if (Object.keys(patch).length) await run(supabase.from('builder_plans').update(patch).eq('id', plan.id))
}

/** stop future payments; everything already paid keeps coming back on schedule */
export async function stopPlan(userId) {
  const plan = await openPlan(userId)
  if (!plan) throw new HttpError(404, 'You don’t have a Solar Builder Plan')
  await run(supabase.from('builder_plans').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), next_charge_at: null }).eq('id', plan.id))
}

/**
 * Prototype only: move the plan's whole timeline one month into the past, so the next
 * monthly payment and credits happen now (for demos, where real months can't pass).
 */
export async function skipMonth(userId) {
  const plans = await plansOf(userId)
  if (plans === null) throw new HttpError(503, SETUP)
  if (!plans.length) throw new HttpError(404, 'Start a Solar Builder Plan first')
  for (const plan of plans) {
    await run(supabase.from('builder_plans').update({
      started_at: monthBefore(plan.started_at).toISOString(),
      next_charge_at: plan.next_charge_at ? monthBefore(plan.next_charge_at).toISOString() : null,
    }).eq('id', plan.id))
  }
  const payments = await run(supabase.from('builder_payments').select('id, paid_at').eq('user_id', userId))
  for (const p of payments) {
    const at = monthBefore(p.paid_at).toISOString()
    await run(supabase.from('builder_payments').update({ paid_at: at }).eq('id', p.id))
    await run(supabase.from('contributions').update({ contributed_at: at, settled_at: at }).eq('plan_payment_id', p.id))
  }
  // credit rows are rebuilt from the shifted payments
  if (payments.length) await run(supabase.from('payouts').delete().in('plan_payment_id', payments.map((p) => p.id)))
  await syncPlan(userId)
}

/** plan holdings for the portfolio summary (empty if plan.sql hasn't been run) */
export async function planHoldings(userId) {
  const plans = await plansOf(userId)
  if (!plans?.length) return []
  const payments = await run(supabase.from('builder_payments').select('id, plan_id, amount').eq('user_id', userId))
  const payouts = payments.length
    ? await run(supabase.from('payouts').select('plan_payment_id, amount, status').in('plan_payment_id', payments.map((p) => p.id)).eq('status', 'completed'))
    : []
  const planOf = new Map(payments.map((p) => [p.id, p.plan_id]))
  return plans.map((plan) => ({
    plan,
    paid: round2(payments.filter((p) => p.plan_id === plan.id).reduce((a, p) => a + Number(p.amount), 0)),
    received: round2(payouts.filter((p) => planOf.get(p.plan_payment_id) === plan.id).reduce((a, p) => a + Number(p.amount), 0)),
    payments: payments.filter((p) => p.plan_id === plan.id).length,
  })).filter((h) => h.payments > 0)
}
