import { all, run, supabase } from './db.js'
import { returnedSoFar } from './credits.js'
import { planHoldings } from './plan.js'
import { clamp, HttpError, MONTHS, nowMeta, POINTS, toMonthLabel } from './utils.js'

// Queries go through the Supabase REST API, which can't run raw SQL joins or sums,
// so each service fetches the rows it needs and does the joining/aggregation here.

const byId = (rows) => new Map(rows.map((r) => [r.id, r]))
const sinceLabel = (date) => (date ? `${MONTHS[new Date(date).getUTCMonth()]} ${new Date(date).getUTCFullYear()}` : '')

/* ---------- catalogue ---------- */

export async function sitesById() {
  return byId(await run(supabase.from('sites').select('*')))
}

/** townships, sites and rewards in the frontend's shapes; `taken` = units held by other residents */
export async function catalogue(userId) {
  const [townships, sites, rewards, subs, units] = await Promise.all([
    run(supabase.from('townships').select('*').order('created_at').order('id')),
    run(supabase.from('sites').select('*').order('created_at').order('id')),
    run(supabase.from('rewards').select('*').eq('active', true).order('created_at').order('id')),
    all(() => supabase.from('subscriptions').select('id, user_id').neq('status', 'cancelled').order('id')),
    all(() => supabase.from('subscription_units').select('subscription_id, site_id, unit_index').order('subscription_id').order('unit_index')),
  ])
  const owner = new Map(subs.map((s) => [s.id, s.user_id]))
  const taken = new Map()
  for (const u of units) {
    const who = owner.get(u.subscription_id)
    if (!who || who === userId) continue
    if (!taken.has(u.site_id)) taken.set(u.site_id, [])
    taken.get(u.site_id).push(u.unit_index)
  }

  return {
    townships: townships.map((t) => ({
      id: t.id,
      name: t.name,
      area: t.area,
      state: t.state,
      lat: Number(t.latitude),
      lon: Number(t.longitude),
      photo: t.photo_url,
      lake: t.map_layout?.lake ?? [0, 0],
      park: t.map_layout?.park ?? [1, 1],
      towers: t.map_layout?.towers ?? [],
      seed: t.map_seed ?? 1,
      communityMWh: Number(t.community_mwh),
      residents: t.residents_count,
    })),
    sites: sites.map((s) => ({
      id: s.id,
      townshipId: s.township_id,
      kind: s.kind,
      name: s.name,
      block: [s.map_x ?? 0, s.map_z ?? 0],
      pricePerUnit: Number(s.price_per_unit),
      returnLow: Number(s.return_low_pct ?? 0),
      returnHigh: Number(s.return_high_pct ?? 0),
      pointsPerUnit: Math.floor(Number(s.price_per_unit) / POINTS.rmPerPoint),
      co2PerUnit: Number(s.co2_kg_per_unit_year) / 1000,
      kwpPerUnit: Number(s.kwp_per_unit),
      units: s.total_units,
      cols: s.grid_cols ?? 1,
      blocks: s.blocks_per_row ?? 1,
      taken: (taken.get(s.id) ?? []).sort((a, b) => a - b),
      capacityMW: Number(s.capacity_mw),
      outputPct: Number(s.output_pct ?? 0),
      since: sinceLabel(s.since_date),
      description: s.description ?? '',
      homesPowered: s.homes_powered,
      status: s.status,
    })),
    rewards: rewards.map((r) => ({
      id: r.id,
      title: r.title,
      value: r.value_label,
      detail: r.detail,
      cost: r.cost_points,
      cat: r.category,
      icon: r.icon,
      photo: r.photo_url,
    })),
  }
}

/* ---------- the signed-in resident ---------- */

export async function ensureProfile(userId) {
  const rows = await run(supabase.from('profiles').select('*').eq('id', userId).limit(1))
  if (rows[0]) return rows[0]
  try {
    await run(supabase.from('profiles').upsert({ id: userId, full_name: 'Demo Resident' }, { onConflict: 'id', ignoreDuplicates: true }))
  } catch (err) {
    // the account was deleted (e.g. by re-running seed.sql) but the browser still has its session
    if (err.code === '23503') throw new HttpError(401, 'Your account no longer exists. Please sign in again.')
    throw err
  }
  await run(supabase.from('notification_preferences').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true }))
  return (await run(supabase.from('profiles').select('*').eq('id', userId).limit(1)))[0]
}

/** the user's subscriptions with their unit indexes */
export async function holdingsOf(userId, statuses = ['active', 'pending']) {
  const subs = await run(supabase.from('subscriptions').select('id, site_id, status, since_month, created_at').eq('user_id', userId).in('status', statuses).order('created_at'))
  const units = subs.length
    ? await run(supabase.from('subscription_units').select('subscription_id, unit_index').in('subscription_id', subs.map((s) => s.id)).order('unit_index'))
    : []
  return subs.map((s) => ({ ...s, units: units.filter((u) => u.subscription_id === s.id).map((u) => u.unit_index) }))
}

/** a green_trips row in the app's shape */
export const toTrip = (t) => ({
  id: t.id,
  mode: t.mode,
  source: t.source,
  at: new Date(t.started_at).getTime(),
  distanceKm: Number(t.distance_km),
  durationMin: Number(t.duration_min),
  points: t.points,
  co2Kg: Number(t.co2_saved_kg),
  petrolL: Number(t.petrol_saved_l),
  path: t.path ?? [],
})

/** recent walks/rides; empty if server/green.sql hasn't been run yet */
export async function tripsOf(userId, limit = 30) {
  const { data, error } = await supabase.from('green_trips').select('*').eq('user_id', userId).order('started_at', { ascending: false }).limit(limit)
  return error ? [] : data.map(toTrip)
}

/** everything the app's store holds for one resident (same shape as src/store.tsx State) */
export async function me(userId) {
  const profile = await ensureProfile(userId)
  const [subs, redemptions, ledger, checkins, trips] = await Promise.all([
    holdingsOf(userId),
    run(supabase.from('redemptions').select('id, reward_id, redemption_code, redeemed_at').eq('user_id', userId).neq('status', 'cancelled').order('redeemed_at', { ascending: false })),
    run(supabase.from('point_ledger').select('id, activity, title, points_delta, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)),
    run(supabase.from('daily_checkins').select('checkin_date').eq('user_id', userId).order('checkin_date', { ascending: false }).limit(60)),
    tripsOf(userId),
  ])

  // one entry per site, as the app expects
  const bySite = new Map()
  for (const s of subs) {
    const cur = bySite.get(s.site_id)
    const since = String(s.since_month).slice(0, 7)
    if (cur) {
      cur.units = [...new Set([...cur.units, ...s.units])].sort((a, b) => a - b)
      if (since < cur.since) cur.since = since
    } else {
      bySite.set(s.site_id, { siteId: s.site_id, units: s.units, since })
    }
  }

  return {
    name: profile.full_name ?? 'Resident',
    points: profile.points_balance,
    lifetime: profile.points_lifetime,
    township: profile.township_id ?? 'elmina',
    mapMode: profile.map_mode,
    subs: [...bySite.values()],
    redemptions: redemptions.map((r) => ({ id: r.id, rewardId: r.reward_id, at: new Date(r.redeemed_at).getTime(), code: r.redemption_code })),
    activity: ledger.map((l) => ({ id: l.id, title: l.title, points: l.points_delta, at: new Date(l.created_at).getTime(), type: l.activity })),
    checkins: checkins.map((c) => c.checkin_date),
    trips,
  }
}

/* ---------- AI analyst tools (also served as REST endpoints) ---------- */

export async function portfolioSummary(userId) {
  const [sites, townships, subs, payouts, contributions, plans] = await Promise.all([
    sitesById(),
    run(supabase.from('townships').select('id, name')).then(byId),
    holdingsOf(userId, ['active', 'pending', 'cancelled']),
    all(() => supabase.from('payouts').select('id, subscription_id, amount, status, due_at').eq('user_id', userId).order('id')),
    run(supabase.from('contributions').select('subscription_id, amount').eq('user_id', userId).eq('status', 'completed')),
    planHoldings(userId).catch(() => []),
  ])

  const paidBySub = new Map()
  const contributedBySub = new Map()
  let totalPayoutsReceived = 0
  let outstandingPayouts = 0
  for (const p of payouts) {
    const amount = Number(p.amount)
    if (p.status === 'completed') {
      totalPayoutsReceived += amount
      if (p.subscription_id) paidBySub.set(p.subscription_id, (paidBySub.get(p.subscription_id) ?? 0) + amount)
    } else if (p.status === 'pending' || p.status === 'processing') {
      outstandingPayouts += amount
    }
  }
  for (const c of contributions) contributedBySub.set(c.subscription_id, (contributedBySub.get(c.subscription_id) ?? 0) + Number(c.amount))

  // next credit: everything pending on the earliest due date
  const pending = payouts.filter((p) => (p.status === 'pending' || p.status === 'processing') && p.due_at)
  const nextDue = pending.map((p) => new Date(p.due_at).getTime()).sort((a, b) => a - b)[0]
  const nextPayout = nextDue
    ? { date: new Date(nextDue).toISOString(), estimatedAmount: round2(pending.filter((p) => new Date(p.due_at).getTime() === nextDue).reduce((a, p) => a + Number(p.amount), 0)) }
    : null

  const holdings = subs.map((s) => {
    const site = sites.get(s.site_id)
    return {
      projectId: s.site_id,
      projectName: site?.name ?? s.site_id,
      kind: site?.kind,
      township: townships.get(site?.township_id)?.name ?? '',
      units: s.units.length,
      contributed: round2(contributedBySub.get(s.id) ?? 0),
      payoutsReceived: round2(paidBySub.get(s.id) ?? 0),
      status: s.status === 'cancelled' ? 'closed' : s.status,
    }
  })
  // Solar Builder Plan payments and the credits they've returned so far
  for (const h of plans) {
    const site = sites.get(h.plan.site_id)
    holdings.push({
      projectId: h.plan.site_id,
      projectName: `Solar Builder Plan · ${site?.name ?? h.plan.site_id}`,
      kind: site?.kind,
      township: townships.get(site?.township_id)?.name ?? '',
      units: h.payments,
      contributed: h.paid,
      payoutsReceived: h.received,
      status: h.plan.status === 'active' ? 'active' : h.plan.status === 'paused' ? 'pending' : 'closed',
    })
  }

  return {
    ...nowMeta('verified', 'Supabase contributions + credit ledger'),
    totalContributed: round2(holdings.reduce((acc, h) => acc + h.contributed, 0)),
    totalPayoutsReceived: round2(totalPayoutsReceived),
    outstandingPayouts: round2(outstandingPayouts),
    nextPayout,
    holdings,
  }
}

export async function realizedReturn(userId) {
  const [contributions, payouts] = await Promise.all([
    run(supabase.from('contributions').select('contributed_at, amount, site_id').eq('user_id', userId).eq('status', 'completed')),
    all(() => supabase.from('payouts').select('id, paid_at, created_at, amount, site_id').eq('user_id', userId).eq('status', 'completed').order('id')),
  ])

  const contributionSum = contributions.reduce((acc, r) => acc + Number(r.amount), 0)
  const payoutSum = payouts.reduce((acc, r) => acc + Number(r.amount), 0)
  const fees = 0

  // credits are part your own money coming back, part extra; split them by the 120-month schedule
  let capitalReturned = 0
  let exposure = 0
  for (const c of contributions) {
    const r = returnedSoFar(c.amount, c.contributed_at)
    capitalReturned += r.capital
    exposure += r.exposure
  }
  capitalReturned = Math.min(capitalReturned, payoutSum)
  const extra = Math.max(0, payoutSum - capitalReturned - fees)

  const cashFlows = [
    ...contributions.map((r) => ({ date: new Date(r.contributed_at).toISOString(), type: 'contribution', amount: Number(r.amount), projectId: r.site_id })),
    ...payouts.map((r) => ({ date: new Date(r.paid_at ?? r.created_at).toISOString(), type: 'payout', amount: Number(r.amount), projectId: r.site_id })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return {
    ...nowMeta('verified', 'Supabase contributions + credit ledger'),
    contributions: round2(contributionSum),
    payouts: round2(payoutSum),
    fees,
    capitalReturned: round2(capitalReturned),
    extra: round2(extra),
    /** extra earned so far, as a share of everything paid in */
    realizedReturnPct: contributionSum > 0 ? round2((extra / contributionSum) * 100) : 0,
    /** extra per year on the money still out (what the 2-3% is measured on) */
    annualisedPct: exposure > 0 ? round2((extra / exposure) * 100) : 0,
    cashFlows,
  }
}

/**
 * Projection for a one-off amount: it comes back over 10 years (1/120 a month), plus `range`
 * ([low, mid, high] % a year) on the part not yet returned. totalPayouts = the extra earned.
 */
export function projectedScenarios(amount, years, range = [2, 2.5, 3]) {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(years) || years <= 0) {
    throw new HttpError(400, 'Invalid amount or years')
  }
  const names = ['Conservative', 'Base', 'Optimistic']
  const months = Math.min(120, Math.round(years * 12))
  const cap = amount / 120
  return {
    ...nowMeta('forecast', 'Scenario model v2 (money back over 10 years)'),
    amount,
    years,
    scenarios: range.map((pct, i) => {
      let extra = 0
      for (let k = 1; k <= months; k++) extra += ((amount - cap * (k - 1)) * pct) / 100 / 12
      const totalPayouts = round2(extra)
      return { name: names[i], annualReturnPct: pct, totalPayouts, endValue: round2(amount + totalPayouts), moneyBack: round2(cap * months) }
    }),
    assumptions: [
      'Your money comes back in equal monthly parts over 10 years.',
      'The return is earned on the part not yet returned, so it shrinks as your money comes back.',
      'Output follows the long-run Klang Valley monthly sunshine pattern.',
    ],
    risks: [
      'Cloudy months or outages reduce the return.',
      'Tariff or regulatory changes.',
      'Returns are estimates and not guaranteed.',
    ],
  }
}

export async function projectPerformance(projectId) {
  const site = (await run(supabase.from('sites').select('id, name, capacity_mw').eq('id', projectId).limit(1)))[0]
  if (!site) throw new HttpError(404, 'Project not found')

  const readings = await all(() => supabase.from('solar_readings').select('id, measured_at, generation_kwh, expected_kwh').eq('site_id', projectId).order('id'))
  readings.sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())

  // monthly totals for the last six complete months
  const now = new Date()
  const thisMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  const months = new Map()
  for (const r of readings) {
    const d = new Date(r.measured_at)
    const key = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
    if (key >= thisMonth) continue
    const m = months.get(key) ?? { actual: 0, forecast: 0 }
    m.actual += Number(r.generation_kwh)
    m.forecast += Number(r.expected_kwh ?? r.generation_kwh)
    months.set(key, m)
  }
  const generation = [...months.entries()].sort(([a], [b]) => a - b).slice(-6).map(([key, m]) => ({
    month: toMonthLabel(key),
    actualMWh: round1(m.actual / 1000),
    forecastMWh: round1(m.forecast / 1000),
  }))

  const ratio = (rows) => {
    const a = rows.reduce((s, r) => s + Number(r.generation_kwh), 0)
    const f = rows.reduce((s, r) => s + Number(r.expected_kwh ?? r.generation_kwh), 0)
    return f > 0 ? a / f : 1
  }
  const last30 = readings.slice(-30)
  const last3 = readings.slice(-3)
  const forecastDeviationPct = round1((ratio(last30) - 1) * 100)
  const availabilityPct = round1(clamp(
    (last30.reduce((s, r) => s + Math.min(1, Number(r.generation_kwh) / Number(r.expected_kwh || r.generation_kwh || 1)), 0) / Math.max(1, last30.length)) * 100,
    0, 100,
  ))
  const lastMonth = generation[generation.length - 1]
  const revenueMonth = Math.round((lastMonth?.actualMWh ?? 0) * 1000 * 0.45)

  return {
    ...nowMeta('verified', 'Supabase solar_readings (daily metered output)'),
    projectId: site.id,
    projectName: site.name,
    capacityMW: Number(site.capacity_mw ?? 0),
    generation,
    forecastDeviationPct,
    availabilityPct,
    revenueMonth,
    operatingCostMonth: Math.round(revenueMonth * 0.12),
    status: last3.some((r) => Number(r.generation_kwh) < 0.5 * Number(r.expected_kwh)) ? 'outage' : ratio(last3) < 0.92 ? 'underperforming' : 'normal',
    recentDeviationPct: round1((ratio(last3) - 1) * 100),
  }
}

/** the resident's share (units x kWp) of each site's metered output over the last 12 months */
export async function environmentalImpact(userId) {
  const [sites, subs] = await Promise.all([sitesById(), holdingsOf(userId)])
  const siteIds = [...new Set(subs.map((s) => s.site_id))]
  const readings = siteIds.length
    ? await all(() => supabase.from('solar_readings').select('id, site_id, measured_at, generation_kwh').in('site_id', siteIds).order('id'))
    : []

  const gridFactor = 0.585
  const byProject = subs.map((s) => {
    const site = sites.get(s.site_id)
    const siteKWp = Number(site?.capacity_mw ?? 0) * 1000
    const share = siteKWp > 0 ? (s.units.length * Number(site?.kwp_per_unit ?? 0)) / siteKWp : 0
    const since = new Date(s.since_month).getTime()
    const siteKWh = readings
      .filter((r) => r.site_id === s.site_id && new Date(r.measured_at).getTime() >= since)
      .reduce((acc, r) => acc + Number(r.generation_kwh), 0)
    const kWh = siteKWh * share
    return { projectName: site?.name ?? s.site_id, kWh: Math.round(kWh), tCO2e: round1((kWh * gridFactor) / 1000) }
  })

  const attributableKWh = byProject.reduce((acc, p) => acc + p.kWh, 0)
  const emissionsAvoidedT = round1(byProject.reduce((acc, p) => acc + p.tCO2e, 0))

  return {
    ...nowMeta('verified', 'Supabase solar_readings + your holdings'),
    attributableKWh,
    emissionsAvoidedT,
    treesEquivalent: Math.round(emissionsAvoidedT / 0.022),
    method: 'Your share (units × kWp) of each project’s metered output over the last 12 months × grid factor 0.585 kgCO₂e/kWh.',
    byProject,
  }
}

export async function alertsFor(userId) {
  const [alerts, reads] = await Promise.all([
    run(supabase.from('alerts').select('id, type, severity, title, body, site_id, detection, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(100)),
    run(supabase.from('alert_reads').select('alert_id').eq('user_id', userId)),
  ])
  const read = new Set(reads.map((r) => r.alert_id))
  return alerts
    .filter((a) => a.type !== 'sensor_offline')
    .map((a) => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      title: a.title,
      body: a.body,
      createdAt: new Date(a.created_at).toISOString(),
      read: read.has(a.id),
      projectId: a.site_id ?? undefined,
      detection: a.detection,
    }))
}

function round2(n) { return Math.round(n * 100) / 100 }
function round1(n) { return Math.round(n * 10) / 10 }
