import { randomUUID } from 'node:crypto'
import { count, run, rpc, supabase } from './db.js'
import { ensureProfile, me } from './services.js'
import { syncBlockCredits } from './credits.js'
import { MOCK_USERS } from './mockdata.js'
import { syncPlan } from './plan.js'
import { dueDate, HttpError, monthStart, MONTHS_LONG, purchasePoints, rm, todayKL } from './utils.js'

async function siteOrThrow(siteId) {
  const site = (await run(supabase.from('sites').select('*').eq('id', siteId).limit(1)))[0]
  if (!site) throw new HttpError(404, 'Project not found')
  return site
}

async function notify(userId, alert) {
  const [row] = await run(supabase.from('alerts').insert({ user_id: userId, detection: 'database_event', ...alert }).select('id'))
  await run(supabase.from('notification_deliveries').insert({ alert_id: row.id, channel: 'in_app', status: 'sent', attempts: 1, sent_at: new Date().toISOString() }))
}

/**
 * Subscribe to units at a site: claims the units, records the (simulated, already settled)
 * contribution, awards points, books this month's pending credit and raises an alert.
 */
export async function subscribe(userId, siteId, rawUnits) {
  await ensureProfile(userId)
  const site = await siteOrThrow(siteId)
  if (site.status !== 'active') throw new HttpError(400, 'This project is not open for subscriptions')

  const units = [...new Set((rawUnits ?? []).map(Number))].sort((a, b) => a - b)
  if (!units.length || units.some((u) => !Number.isInteger(u) || u < 0 || u >= site.total_units)) {
    throw new HttpError(400, `Choose unit numbers between 0 and ${site.total_units - 1}`)
  }

  const clash = await run(supabase.from('subscription_units').select('unit_index').eq('site_id', siteId).in('unit_index', units))
  if (clash.length) throw new HttpError(409, `Already taken: ${clash.map((c) => c.unit_index + 1).join(', ')}`)

  let sub = (await run(supabase.from('subscriptions').select('id, since_month').eq('user_id', userId).eq('site_id', siteId).eq('status', 'active').limit(1)))[0]
  const created = !sub
  if (!sub) {
    sub = (await run(supabase.from('subscriptions').insert({ user_id: userId, site_id: siteId, since_month: monthStart(), status: 'active' }).select('id, since_month')))[0]
  }

  try {
    await run(supabase.from('subscription_units').insert(units.map((u) => ({ subscription_id: sub.id, site_id: siteId, unit_index: u }))))
  } catch (err) {
    if (created) await run(supabase.from('subscriptions').delete().eq('id', sub.id))
    if (err.status === 409) throw new HttpError(409, 'Someone just took one of those units. Please pick again.')
    throw err
  }

  const now = new Date().toISOString()
  const amount = units.length * Number(site.price_per_unit)
  await run(supabase.from('contributions').insert({
    user_id: userId, site_id: siteId, subscription_id: sub.id, amount, status: 'completed',
    external_reference: `SK-CON-${sub.id}-${Date.now()}`, contributed_at: now, settled_at: now,
  }))

  const points = purchasePoints(amount)
  await rpc('apply_points', {
    p_user_id: userId, p_delta: points, p_activity: 'subscribe', p_title: `Subscribed to ${site.name}`,
    p_idempotency_key: `subscribe:${sub.id}:${units.join('-')}`, p_metadata: { site_id: siteId, units },
  })

  // this purchase's first credit (next month) and anything else that has fallen due
  await syncBlockCredits(userId)

  await notify(userId, {
    type: 'contribution_recorded', severity: 'success', title: 'Contribution recorded', site_id: siteId,
    body: `Your ${rm(amount, 0)} contribution to ${site.name} has been verified.`,
  })

  return { points, me: await me(userId) }
}

/** spend points on a reward; `code` lets the app show the voucher code it generated */
export async function redeem(userId, rewardId, code) {
  await ensureProfile(userId)
  const reward = (await run(supabase.from('rewards').select('*').eq('id', rewardId).eq('active', true).limit(1)))[0]
  if (!reward) throw new HttpError(404, 'Reward unavailable')

  try {
    await rpc('apply_points', {
      p_user_id: userId, p_delta: -reward.cost_points, p_activity: 'redeem', p_title: `Redeemed ${reward.title}`,
      p_idempotency_key: `redeem:${randomUUID()}`, p_metadata: { reward_id: reward.id },
    })
  } catch (err) {
    if (/insufficient/i.test(err.message)) throw new HttpError(400, 'Not enough points for this reward')
    throw err
  }

  const wanted = typeof code === 'string' && /^SK-[A-Z0-9-]{3,24}$/.test(code) ? code : null
  const fresh = () => `SK-${reward.id.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`
  let row
  for (let attempt = 0; !row && attempt < 5; attempt++) {
    try {
      row = (await run(supabase.from('redemptions').insert({
        user_id: userId, reward_id: reward.id, points_spent: reward.cost_points, redemption_code: attempt === 0 && wanted ? wanted : fresh(),
      }).select('id, reward_id, redemption_code, redeemed_at')))[0]
    } catch (err) {
      if (err.status !== 409) throw err
    }
  }
  if (!row) throw new HttpError(500, 'Could not issue a voucher code')

  return {
    redemption: { id: row.id, rewardId: row.reward_id, at: new Date(row.redeemed_at).getTime(), code: row.redemption_code },
    me: await me(userId),
  }
}

/** daily check-in: +10 points once per Malaysian calendar day */
export async function checkIn(userId) {
  await ensureProfile(userId)
  const day = todayKL()
  try {
    await run(supabase.from('daily_checkins').insert({ user_id: userId, checkin_date: day }))
  } catch (err) {
    if (err.status === 409) throw new HttpError(409, 'Already checked in today')
    throw err
  }
  await rpc('apply_points', {
    p_user_id: userId, p_delta: 10, p_activity: 'checkin', p_title: 'Daily sun check-in',
    p_idempotency_key: `checkin:${userId}:${day}`, p_metadata: { source: 'daily_checkin' },
  })
  return me(userId)
}

/** profile settings the app can change */
export async function updateMe(userId, body) {
  await ensureProfile(userId)
  const patch = {}
  if (body?.townshipId !== undefined) {
    const t = await run(supabase.from('townships').select('id').eq('id', String(body.townshipId)).limit(1))
    if (!t.length) throw new HttpError(400, 'Unknown township')
    patch.township_id = t[0].id
  }
  if (body?.mapMode !== undefined) {
    if (body.mapMode !== '2d' && body.mapMode !== '3d') throw new HttpError(400, 'mapMode must be 2d or 3d')
    patch.map_mode = body.mapMode
  }
  if (body?.fullName !== undefined) {
    const name = String(body.fullName).trim()
    if (!name || name.length > 80) throw new HttpError(400, 'Name must be 1-80 characters')
    patch.full_name = name
  }
  if (Object.keys(patch).length) await run(supabase.from('profiles').update(patch).eq('id', userId))
  return me(userId)
}

/* ---------- demo reset ---------- */

const H = 3_600_000
const D = 24 * H

/** a mock-data time (see mockdata.js) as an ISO string, relative to now */
function when(t) {
  if (t.at) return t.at
  if (t.kl) return klAt(t.kl[0], t.kl[1], t.kl[2])
  if (t.monthsAgo !== undefined) {
    const d = new Date()
    d.setUTCMonth(d.getUTCMonth() - t.monthsAgo)
    return d.toISOString()
  }
  return new Date(Date.now() - t.agoHours * H).toISOString()
}
/** `dayOffset` days from today, at `hour`:`minute` Malaysia time */
const klAt = (dayOffset, hour, minute = 0) =>
  new Date(Date.parse(`${todayKL()}T00:00:00+08:00`) + dayOffset * D + hour * H + minute * 60_000).toISOString()

/**
 * put this resident's personal data back to their seeded starting state (server/seed.sql and
 * mockdata.js are generated together). Accounts that aren't demo residents become a fresh account.
 * The catalogue and everyone else's data are untouched.
 */
export async function resetDemo(userId) {
  await ensureProfile(userId)
  const mock = MOCK_USERS.find((u) => u.id === userId)

  // 1. clear personal records (children before parents)
  await run(supabase.from('alerts').delete().eq('user_id', userId))
  await supabase.from('green_trips').delete().eq('user_id', userId) // ignore if green.sql hasn't been run
  await supabase.from('ev_bookings').delete().eq('user_id', userId) // bay holds cascade; ignore if ev.sql hasn't been run
  await supabase.from('builder_plans').delete().eq('user_id', userId) // payments + their credits cascade; ignore if plan.sql hasn't been run
  for (const table of ['redemptions', 'daily_checkins', 'point_ledger', 'payouts', 'contributions']) {
    await run(supabase.from(table).delete().eq('user_id', userId))
  }
  await run(supabase.from('subscriptions').delete().eq('user_id', userId))

  if (!mock) {
    await run(supabase.from('point_ledger').insert({
      user_id: userId, activity: 'bonus', title: 'Welcome to Solar Kita', points_delta: 50, idempotency_key: `welcome:${userId}`, metadata: {},
    }))
    await run(supabase.from('profiles').update({ points_balance: 50, points_lifetime: 50 }).eq('id', userId))
    return me(userId)
  }

  // 2. holdings, contributions and the full credit history
  const sites = new Map((await run(supabase.from('sites').select('*'))).map((s) => [s.id, s]))
  const subs = []
  for (const h of mock.subs) {
    const site = sites.get(h.siteId)
    if (!site) continue
    // someone may have subscribed to these units since the seed
    const clash = await run(supabase.from('subscription_units').select('unit_index').eq('site_id', h.siteId).in('unit_index', h.units))
    if (clash.length) continue
    const [sub] = await run(supabase.from('subscriptions').insert({
      id: h.id, user_id: userId, site_id: h.siteId, since_month: h.since, status: 'active',
      created_at: new Date(Date.parse(h.since) + 2 * D).toISOString(),
    }).select('id, site_id, since_month, created_at'))
    await run(supabase.from('subscription_units').insert(h.units.map((u) => ({ subscription_id: sub.id, site_id: h.siteId, unit_index: u }))))
    subs.push({ ...sub, units: h.units })
  }
  if (subs.length) {
    await run(supabase.from('contributions').insert(subs.map((s) => {
      const since = Date.parse(s.since_month)
      return {
        user_id: userId, site_id: s.site_id, subscription_id: s.id, amount: s.units.length * Number(sites.get(s.site_id).price_per_unit), status: 'completed',
        external_reference: `SK-CON-${s.id}`, contributed_at: new Date(since + D + 10 * H).toISOString(), settled_at: new Date(since + 2 * D + 10 * H).toISOString(),
      }
    })))
  }
  // every monthly credit since purchase (your money back over 10 years + the project's return)
  await syncBlockCredits(userId)

  // 3. Solar Builder Plan: past payments; syncPlan adds their credits
  if (mock.plan) {
    const p = mock.plan
    const { error } = await supabase.from('builder_plans').insert({
      id: p.id, user_id: userId, site_id: p.siteId, monthly_amount: p.amount, status: 'active',
      charge_day: Math.min(28, Number(todayKL().slice(8))), next_charge_at: when({ monthsAgo: -1 }), streak: p.months, started_at: when({ monthsAgo: p.months - 1 }),
    })
    if (!error) {
      const payments = p.payments.map((x) => ({ id: x.id, plan_id: p.id, user_id: userId, seq: x.seq, amount: p.amount, paid_at: when(x), points: x.points }))
      await run(supabase.from('builder_payments').insert(payments))
      await run(supabase.from('contributions').insert(payments.map((x) => ({
        user_id: userId, site_id: p.siteId, subscription_id: null, amount: x.amount, status: 'completed',
        external_reference: `SK-PLANPAY-${x.id}`, contributed_at: x.paid_at, settled_at: x.paid_at, plan_payment_id: x.id,
      }))))
      await syncPlan(userId)
    }
  }

  // 4. Go Green trips
  if (mock.trips.length) {
    await supabase.from('green_trips').insert(mock.trips.map((t) => {
      const start = when(t)
      return {
        id: t.id, user_id: userId, township_id: t.township, mode: t.mode, source: 'gps', started_at: start,
        ended_at: new Date(Date.parse(start) + t.minutes * 60_000).toISOString(), distance_km: t.km, duration_min: t.minutes,
        inside_pct: t.inside, points: t.points, co2_saved_kg: Math.round(t.km * 17.1) / 100, petrol_saved_l: Math.round(t.km * 7) / 100, path: [],
      }
    }))
  }

  // 5. EV charging: paid sessions and upcoming bookings (skipped if that bay has been taken since)
  for (const b of mock.ev) {
    const startsAt = klAt(b.dayOffset, b.hour)
    const end = Date.parse(startsAt) + b.hours * H
    const row = b.status === 'paid'
      ? { energy_kwh: b.energy, peak_kwh: b.peak, amount: b.amount, points: b.points, started_at: startsAt, finished_at: new Date(end).toISOString(), paid_at: new Date(end + 5 * 60_000).toISOString() }
      : {}
    const { error } = await supabase.from('ev_bookings').insert({ id: b.id, user_id: userId, site_id: b.siteId, bay: b.bay, starts_at: startsAt, hours: b.hours, status: b.status, ...row })
    if (error) break // ev.sql hasn't been run
    if (b.status !== 'booked') continue
    const slots = Array.from({ length: b.hours }, (_, i) => ({ booking_id: b.id, site_id: b.siteId, bay: b.bay, slot_start: klAt(b.dayOffset, b.hour + i) }))
    const { error: taken } = await supabase.from('ev_booking_slots').insert(slots)
    if (taken) await run(supabase.from('ev_bookings').delete().eq('id', b.id))
  }

  // 6. points: holdings + their activity, then the balance
  const ledger = subs.map((s) => ({
    user_id: userId, activity: 'subscribe', title: `Subscribed to ${sites.get(s.site_id).name}`,
    points_delta: s.units.length * sites.get(s.site_id).points_per_unit, idempotency_key: `seed:subscribe:${s.id}`,
    metadata: { site_id: s.site_id, units: s.units.length }, created_at: s.created_at,
  }))
  for (const l of mock.ledger) {
    const at = when(l)
    const d = new Date(at)
    ledger.push({
      user_id: userId, activity: l.activity, points_delta: l.points, idempotency_key: l.key, metadata: {}, created_at: at,
      title: l.monthTitle ? `${l.title} · ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}` : l.title,
    })
  }
  // skip point types whose migration hasn't been run, rather than failing the whole reset
  const { error: ledgerError } = await supabase.from('point_ledger').insert(ledger)
  if (ledgerError) await run(supabase.from('point_ledger').insert(ledger.filter((l) => !['walk', 'cycle', 'plan', 'charge'].includes(l.activity))))
  const kept = await run(supabase.from('point_ledger').select('points_delta').eq('user_id', userId))
  const balance = kept.reduce((a, l) => a + l.points_delta, 0)
  const lifetime = kept.reduce((a, l) => a + Math.max(0, l.points_delta), 0)
  await run(supabase.from('profiles').update({ points_balance: balance, points_lifetime: lifetime, township_id: mock.township, full_name: mock.name }).eq('id', userId))

  for (const rd of mock.redemptions) {
    const taken = await run(supabase.from('redemptions').select('id').eq('redemption_code', rd.code).limit(1))
    await run(supabase.from('redemptions').insert({
      user_id: userId, reward_id: rd.rewardId, points_spent: rd.points, status: 'issued', redeemed_at: when(rd),
      redemption_code: taken.length ? `${rd.code.slice(0, 7)}${Math.floor(1000 + Math.random() * 9000)}` : rd.code,
    }))
  }

  // 7. notifications, with amounts and months from the rows above
  const now = new Date()
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const payouts = await run(supabase.from('payouts').select('amount, due_at').eq('user_id', userId).eq('due_at', dueDate(lastMonth).toISOString()))
  const lastMonthCredit = payouts.reduce((a, p) => a + Number(p.amount), 0)
  const incidents = new Set((await run(supabase.from('alert_incidents').select('id'))).map((i) => i.id))
  const alerts = []
  for (const a of mock.alerts) {
    let body = a.body
    if (a.kind === 'credit') body = `Your ${MONTHS_LONG[lastMonth.getUTCMonth()]} credit of ${rm(lastMonthCredit)} was applied to your TNB bill.`
    if (a.kind === 'report') body = `The ${MONTHS_LONG[lastMonth.getUTCMonth()]} generation report for ${a.siteName} is now available.`
    if (a.type === 'funding_milestone') {
      const site = sites.get(a.siteId)
      const held = await count(supabase.from('subscription_units').select('*', { count: 'exact', head: true }).eq('site_id', a.siteId))
      body = `${site.name} is ${Math.round((held / site.total_units) * 100)}% funded (${held} of ${site.total_units} array blocks). Subscriptions close in 14 days.`
    }
    if (a.type === 'ev_charging' && !mock.ev.some((b) => b.status === 'booked')) continue
    alerts.push({
      user_id: userId, type: a.type, severity: a.severity, title: a.title, body, site_id: a.siteId, detection: a.detection,
      created_at: when(a), incident_id: a.incident && incidents.has(a.incident) ? a.incident : null, read: a.read,
    })
  }
  const { data: inserted, error: alertError } = await supabase.from('alerts').insert(alerts.map(({ read: _read, ...a }) => a)).select('id, created_at, title')
  // the EV alert type needs ev.sql; drop it if that hasn't been run
  const rows = alertError
    ? await run(supabase.from('alerts').insert(alerts.filter((a) => a.type !== 'ev_charging').map(({ read: _read, ...a }) => a)).select('id, created_at, title'))
    : inserted
  const readTitles = new Set(alerts.filter((a) => a.read).map((a) => a.title))
  const reads = rows.filter((a) => readTitles.has(a.title)).map((a) => ({ alert_id: a.id, user_id: userId, read_at: new Date(Date.parse(a.created_at) + H).toISOString() }))
  if (reads.length) await run(supabase.from('alert_reads').insert(reads))
  if (rows.length) await run(supabase.from('notification_deliveries').insert(rows.map((a) => ({ alert_id: a.id, channel: 'in_app', status: 'sent', attempts: 1, sent_at: a.created_at }))))

  return me(userId)
}

/** mark every alert read */
export async function markAllAlertsRead(userId) {
  const ids = (await run(supabase.from('alerts').select('id').eq('user_id', userId))).map((a) => a.id)
  if (ids.length) {
    await run(supabase.from('alert_reads').upsert(ids.map((id) => ({ alert_id: id, user_id: userId })), { onConflict: 'alert_id,user_id', ignoreDuplicates: true }))
  }
}

