import { randomUUID } from 'node:crypto'
import { run, rpc, supabase } from './db.js'
import { ensureProfile, me } from './services.js'
import { dueDate, HttpError, monthlyCredit, monthsUntilNow, monthStart, MONTHS_LONG, rm, todayKL } from './utils.js'

const monthKey = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`

async function siteOrThrow(siteId) {
  const site = (await run(supabase.from('sites').select('*').eq('id', siteId).limit(1)))[0]
  if (!site) throw new HttpError(404, 'Project not found')
  return site
}

async function notify(userId, alert) {
  const [row] = await run(supabase.from('alerts').insert({ user_id: userId, detection: 'database_event', ...alert }).select('id'))
  await run(supabase.from('notification_deliveries').insert({ alert_id: row.id, channel: 'in_app', status: 'sent', attempts: 1, sent_at: new Date().toISOString() }))
}

/** (re)write this month's pending credit for a subscription from its current unit count */
async function refreshPendingCredit(sub, site, units, userId) {
  const month = new Date(monthStart() + 'T00:00:00Z')
  await run(supabase.from('payouts').upsert({
    user_id: userId,
    site_id: site.id,
    subscription_id: sub.id,
    amount: monthlyCredit(units, site, month),
    status: 'pending',
    due_at: dueDate(month).toISOString(),
    paid_at: null,
    external_reference: `SK-PAY-${sub.id}-${monthKey(month)}`,
  }, { onConflict: 'external_reference' }))
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

  const points = units.length * site.points_per_unit
  await rpc('apply_points', {
    p_user_id: userId, p_delta: points, p_activity: 'subscribe', p_title: `Subscribed to ${site.name}`,
    p_idempotency_key: `subscribe:${sub.id}:${units.join('-')}`, p_metadata: { site_id: siteId, units },
  })

  const allUnits = await run(supabase.from('subscription_units').select('unit_index').eq('subscription_id', sub.id))
  await refreshPendingCredit(sub, site, allUnits.length, userId)

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

// the resident's starting state; mirrors the demo resident in seed.sql
const DEMO_HOLDINGS = [
  { siteId: 'elmina-subscription', units: [3], since: '2024-01-01' },
  { siteId: 'elmina-rooftop', units: [0], since: '2024-03-01' },
]

/** put this resident's personal data back to the seeded demo state (catalogue and neighbours untouched) */
export async function resetDemo(userId) {
  const profile = await ensureProfile(userId)
  const ago = (ms) => new Date(Date.now() - ms).toISOString()
  const H = 3_600_000
  const D = 24 * H

  // 1. clear personal records (children before parents)
  await run(supabase.from('alerts').delete().eq('user_id', userId))
  await supabase.from('green_trips').delete().eq('user_id', userId) // ignore if green.sql hasn't been run
  for (const table of ['redemptions', 'daily_checkins', 'point_ledger', 'payouts', 'contributions']) {
    await run(supabase.from(table).delete().eq('user_id', userId))
  }
  await run(supabase.from('subscriptions').delete().eq('user_id', userId))

  // 2. holdings, contributions and the full credit history
  const sites = new Map()
  const subs = []
  for (const h of DEMO_HOLDINGS) {
    const site = await siteOrThrow(h.siteId)
    sites.set(site.id, site)
    const clash = await run(supabase.from('subscription_units').select('unit_index').eq('site_id', h.siteId).in('unit_index', h.units))
    if (clash.length) continue
    const [sub] = await run(supabase.from('subscriptions').insert({
      user_id: userId, site_id: h.siteId, since_month: h.since, status: 'active',
      created_at: new Date(Date.parse(h.since) + 2 * D).toISOString(),
    }).select('id, site_id, since_month, created_at'))
    await run(supabase.from('subscription_units').insert(h.units.map((u) => ({ subscription_id: sub.id, site_id: h.siteId, unit_index: u }))))
    subs.push({ ...sub, units: h.units })
  }

  const thisMonth = monthStart()
  const payouts = []
  const contributions = []
  for (const s of subs) {
    const site = sites.get(s.site_id)
    const since = Date.parse(s.since_month)
    contributions.push({
      user_id: userId, site_id: s.site_id, subscription_id: s.id, amount: s.units.length * Number(site.price_per_unit), status: 'completed',
      external_reference: `SK-CON-${s.id}`, contributed_at: new Date(since + D + 10 * H).toISOString(), settled_at: new Date(since + 2 * D + 10 * H).toISOString(),
    })
    for (const month of monthsUntilNow(s.since_month)) {
      const done = monthStart(month) < thisMonth
      payouts.push({
        user_id: userId, site_id: s.site_id, subscription_id: s.id,
        amount: monthlyCredit(s.units.length, site, month),
        status: done ? 'completed' : 'pending',
        due_at: dueDate(month).toISOString(),
        paid_at: done ? dueDate(month).toISOString() : null,
        external_reference: `SK-PAY-${s.id}-${monthKey(month)}`,
      })
    }
  }
  // the rooftop credit three months ago was paid two days late (see the alert below)
  const now = new Date()
  const lateMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1))
  const rooftop = subs.find((s) => s.site_id === 'elmina-rooftop')
  const late = payouts.find((p) => rooftop && p.subscription_id === rooftop.id && p.due_at === dueDate(lateMonth).toISOString())
  if (late) late.paid_at = new Date(Date.parse(late.due_at) + 2 * D).toISOString()
  if (contributions.length) await run(supabase.from('contributions').insert(contributions))
  if (payouts.length) await run(supabase.from('payouts').insert(payouts))

  // 3. points: subscriptions + the app's sample activity; balance = 2,050 earned - 800 redeemed
  const ledger = subs.map((s) => ({
    user_id: userId, activity: 'subscribe', title: `Subscribed to ${sites.get(s.site_id).name}`,
    points_delta: s.units.length * sites.get(s.site_id).points_per_unit, idempotency_key: `seed:subscribe:${s.id}`,
    metadata: { site_id: s.site_id, units: s.units.length }, created_at: s.created_at,
  }))
  const tag = randomUUID().slice(0, 8)
  ledger.push(
    { user_id: userId, activity: 'bonus', title: 'Welcome bonus', points_delta: 80, idempotency_key: `seed:${tag}:welcome`, metadata: {}, created_at: '2024-01-03T02:00:00Z' },
    { user_id: userId, activity: 'quiz', title: 'Energy-saving quiz', points_delta: 50, idempotency_key: `seed:${tag}:quiz`, metadata: {}, created_at: ago(15 * D) },
    { user_id: userId, activity: 'redeem', title: 'Redeemed EV Charging Credit', points_delta: -800, idempotency_key: `seed:${tag}:redeem-ev20`, metadata: { reward_id: 'ev20' }, created_at: ago(12 * D) },
    { user_id: userId, activity: 'event', title: 'Joined “Lights Out Hour”', points_delta: 120, idempotency_key: `seed:${tag}:lights-out`, metadata: {}, created_at: ago(6 * D) },
    ...Array.from({ length: 30 }, (_, k) => {
      const d = new Date(Date.now() - 2 * D)
      d.setUTCMonth(d.getUTCMonth() - k)
      return { user_id: userId, activity: 'bonus', title: 'Monthly solar bonus', points_delta: 50, idempotency_key: `seed:${tag}:monthly-${k}`, metadata: {}, created_at: d.toISOString() }
    }),
  )
  await run(supabase.from('point_ledger').insert(ledger))
  const balance = ledger.reduce((a, l) => a + l.points_delta, 0)
  const lifetime = ledger.reduce((a, l) => a + Math.max(0, l.points_delta), 0)
  await run(supabase.from('profiles').update({ points_balance: balance, points_lifetime: lifetime, township_id: 'elmina', full_name: profile.full_name || 'Jane Doe' }).eq('id', userId))

  const ev20 = (await run(supabase.from('rewards').select('id').eq('id', 'ev20').limit(1)))[0]
  if (ev20) {
    const taken = await run(supabase.from('redemptions').select('id').eq('redemption_code', 'SK-EV-4821').limit(1))
    await run(supabase.from('redemptions').insert({
      user_id: userId, reward_id: 'ev20', points_spent: 800, status: 'issued', redeemed_at: ago(12 * D),
      redemption_code: taken.length ? `SK-EV-${Math.floor(1000 + Math.random() * 9000)}` : 'SK-EV-4821',
    }))
  }

  // 4. the eight sample notifications, with amounts and months from the rows above
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const lastMonthCredit = payouts.filter((p) => p.due_at === dueDate(lastMonth).toISOString()).reduce((a, p) => a + p.amount, 0)
  const grid = await run(supabase.from('subscription_units').select('unit_index').eq('site_id', 'elmina-investment'))
  const incidents = new Map((await run(supabase.from('alert_incidents').select('id, alert_type, site_id'))).map((i) => [`${i.alert_type}:${i.site_id}`, i.id]))

  const alerts = [
    { type: 'low_generation', severity: 'warning', title: 'Low solar generation', site_id: 'serenia-subscription', detection: 'scheduled_check', created_at: ago(1.5 * H),
      body: 'Serenia Sunrise Farm has been 12% below forecast for 3 days due to heavy cloud cover.', incident_id: incidents.get('low_generation:serenia-subscription') ?? null },
    { type: 'payout_completed', severity: 'success', title: 'Energy Savings Credit applied', site_id: null, detection: 'database_event', created_at: ago(26 * H),
      body: `Your ${MONTHS_LONG[lastMonth.getUTCMonth()]} credit of ${rm(lastMonthCredit)} was applied to your TNB bill (account ••4821).` },
    { type: 'funding_milestone', severity: 'info', title: 'Funding milestone', site_id: 'elmina-investment', detection: 'scheduled_check', created_at: ago(50 * H),
      body: `Elmina Grid Array is ${Math.round((grid.length / 18) * 100)}% funded (${grid.length} of 18 array blocks). Subscriptions close in 14 days.` },
    { type: 'project_report', severity: 'info', title: 'New project report', site_id: 'elmina-subscription', detection: 'database_event', created_at: ago(74 * H),
      body: `The ${MONTHS_LONG[lastMonth.getUTCMonth()]} generation report for Elmina Sunfield is now available.`, read: true },
    { type: 'rewards_milestone', severity: 'success', title: 'Rewards milestone', site_id: null, detection: 'database_event', created_at: ago(120 * H),
      body: 'You passed 2,000 lifetime points and unlocked Level 3 · Solar Champion.', read: true },
    { type: 'contribution_recorded', severity: 'success', title: 'Contribution recorded', site_id: 'elmina-rooftop', detection: 'database_event', created_at: ago(220 * H),
      body: 'Your RM 8,000 contribution to Elmina West Homes has been verified.', read: true },
    { type: 'payout_overdue', severity: 'critical', title: 'Credit delayed (resolved)', site_id: null, detection: 'scheduled_check', created_at: ago(400 * H),
      body: `The ${MONTHS_LONG[lateMonth.getUTCMonth()]} credit for Elmina West Homes was 2 days late and has since been applied.`, read: true, incident_id: incidents.get('payout_overdue:elmina-rooftop') ?? null },
    { type: 'project_outage', severity: 'critical', title: 'Project outage (resolved)', site_id: 'elmina-ev', detection: 'monitoring_rule', created_at: ago(700 * H),
      body: 'Elmina Hub Chargers were offline for 4 hours for inverter maintenance.', read: true, incident_id: incidents.get('project_outage:elmina-ev') ?? null },
  ]
  const inserted = await run(supabase.from('alerts').insert(alerts.map(({ read: _read, ...a }) => ({ user_id: userId, ...a }))).select('id, created_at, title'))
  const readTitles = new Set(alerts.filter((a) => a.read).map((a) => a.title))
  const reads = inserted.filter((a) => readTitles.has(a.title)).map((a) => ({ alert_id: a.id, user_id: userId, read_at: new Date(Date.parse(a.created_at) + H).toISOString() }))
  if (reads.length) await run(supabase.from('alert_reads').insert(reads))
  await run(supabase.from('notification_deliveries').insert(inserted.map((a) => ({ alert_id: a.id, channel: 'in_app', status: 'sent', attempts: 1, sent_at: a.created_at }))))

  return me(userId)
}

/** mark every alert read */
export async function markAllAlertsRead(userId) {
  const ids = (await run(supabase.from('alerts').select('id').eq('user_id', userId))).map((a) => a.id)
  if (ids.length) {
    await run(supabase.from('alert_reads').upsert(ids.map((id) => ({ alert_id: id, user_id: userId })), { onConflict: 'alert_id,user_id', ignoreDuplicates: true }))
  }
}

