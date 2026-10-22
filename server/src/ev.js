import { config } from './config.js'
import { run, rpc, supabase } from './db.js'
import { ensureProfile } from './services.js'
import { HttpError, rm, todayKL } from './utils.js'

/**
 * EV charging bookings. Same rules as src/ev.ts.
 * Times are Malaysia time (UTC+8); every slot is one whole hour.
 */
export const EV = {
  pricePerKwh: 1.2,
  /** AC charger power per bay */
  chargerKw: 7.4,
  openHour: 7,
  closeHour: 23,
  /** solar peak: hours from peakStart up to (not including) peakEnd */
  peakStart: 11,
  peakEnd: 15,
  peakPointsPerKwh: 2,
  offPeakPointsPerKwh: 0.5,
  maxHours: 4,
  daysAhead: 7,
  maxUpcoming: 3,
}

const H = 3_600_000
const SETUP = 'EV charging isn’t set up on the database yet: run server/ev.sql in the Supabase SQL Editor.'

/** a whole hour in Malaysia time, e.g. ('2026-10-24', 13) -> 2026-10-24T05:00Z */
const slotAt = (date, hour) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+08:00`)
const hourKL = (d) => (new Date(d).getUTCHours() + 8) % 24
const isPeak = (hour) => hour >= EV.peakStart && hour < EV.peakEnd
const round2 = (n) => Math.round(n * 100) / 100

function failMissing(error) {
  if (error && /ev_booking/.test(error.message)) throw new HttpError(503, SETUP)
  if (error) throw new HttpError(500, error.message)
}

async function station(siteId) {
  const s = (await run(supabase.from('sites').select('id, name, kind, status, total_units, township_id').eq('id', String(siteId ?? '')).limit(1)))[0]
  if (!s || s.kind !== 'ev') throw new HttpError(404, 'EV station not found')
  return s
}

/** free bays for every bookable hour of a day */
export async function availability(siteId, date) {
  const s = await station(siteId)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new HttpError(400, 'Pick a date')
  const from = slotAt(date, 0), to = slotAt(date, 23)
  const { data, error } = await supabase.from('ev_booking_slots').select('slot_start').eq('site_id', s.id).gte('slot_start', from.toISOString()).lte('slot_start', to.toISOString())
  failMissing(error)
  const taken = new Map()
  for (const r of data) { const k = new Date(r.slot_start).getTime(); taken.set(k, (taken.get(k) ?? 0) + 1) }
  const now = Date.now()
  const hours = []
  for (let h = EV.openHour; h < EV.closeHour; h++) {
    const at = slotAt(date, h)
    hours.push({ hour: h, free: Math.max(0, s.total_units - (taken.get(at.getTime()) ?? 0)), peak: isPeak(h), past: at.getTime() + H <= now })
  }
  return { siteId: s.id, date, bays: s.total_units, hours, rules: EV }
}

const toBooking = (b, names) => ({
  id: b.id,
  siteId: b.site_id,
  siteName: names?.get(b.site_id) ?? b.site_id,
  bay: b.bay + 1,
  startsAt: b.starts_at,
  hours: b.hours,
  status: b.status,
  energyKwh: b.energy_kwh === null ? null : Number(b.energy_kwh),
  peakKwh: b.peak_kwh === null ? null : Number(b.peak_kwh),
  amount: b.amount === null ? null : Number(b.amount),
  points: b.points,
  startedAt: b.started_at,
  finishedAt: b.finished_at,
  paidAt: b.paid_at,
})

/** the resident's bookings; bookings whose time passed without charging become 'missed' */
export async function bookingsOf(userId) {
  const { data, error } = await supabase.from('ev_bookings').select('*').eq('user_id', userId).order('starts_at', { ascending: false }).limit(50)
  if (error && /ev_booking/.test(error.message)) return { setup: false, bookings: [], rules: EV }
  failMissing(error)
  const now = Date.now()
  const missed = data.filter((b) => b.status === 'booked' && new Date(b.starts_at).getTime() + b.hours * H <= now)
  for (const b of missed) {
    await run(supabase.from('ev_bookings').update({ status: 'missed' }).eq('id', b.id))
    await run(supabase.from('ev_booking_slots').delete().eq('booking_id', b.id))
    b.status = 'missed'
  }
  const ids = [...new Set(data.map((b) => b.site_id))]
  const names = new Map(ids.length ? (await run(supabase.from('sites').select('id, name').in('id', ids))).map((s) => [s.id, s.name]) : [])
  return { setup: true, bookings: data.map((b) => toBooking(b, names)), rules: EV }
}

export async function book(userId, body) {
  await ensureProfile(userId)
  const s = await station(body?.siteId)
  if (s.status !== 'active') throw new HttpError(400, 'This station isn’t open yet')
  const date = String(body?.date ?? '')
  const startHour = Number(body?.startHour)
  const hours = Number(body?.hours)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'Pick a date')
  if (!Number.isInteger(hours) || hours < 1 || hours > EV.maxHours) throw new HttpError(400, `Book 1 to ${EV.maxHours} hours`)
  if (!Number.isInteger(startHour) || startHour < EV.openHour || startHour + hours > EV.closeHour) {
    throw new HttpError(400, `Stations are open ${EV.openHour}am to ${EV.closeHour - 12}pm`)
  }
  const start = slotAt(date, startHour)
  const now = Date.now()
  if (start.getTime() + H <= now) throw new HttpError(400, 'That time has already passed')
  const last = slotAt(todayKL(), 0).getTime() + EV.daysAhead * 24 * H
  if (start.getTime() >= last) throw new HttpError(400, `You can book up to ${EV.daysAhead} days ahead`)
  const end = start.getTime() + hours * H

  const { data: mine, error } = await supabase.from('ev_bookings').select('id, starts_at, hours, status').eq('user_id', userId).in('status', ['booked', 'charging'])
  failMissing(error)
  if (mine.length >= EV.maxUpcoming) throw new HttpError(409, `You can have up to ${EV.maxUpcoming} upcoming bookings`)
  if (mine.some((b) => new Date(b.starts_at).getTime() < end && new Date(b.starts_at).getTime() + b.hours * H > start.getTime())) {
    throw new HttpError(409, 'You already have a booking at that time')
  }

  const slots = Array.from({ length: hours }, (_, i) => new Date(start.getTime() + i * H).toISOString())
  const held = await run(supabase.from('ev_booking_slots').select('bay, slot_start').eq('site_id', s.id).in('slot_start', slots))
  const busy = new Set(held.map((r) => r.bay))
  for (let bay = 0; bay < s.total_units; bay++) {
    if (busy.has(bay)) continue
    const [b] = await run(supabase.from('ev_bookings').insert({ user_id: userId, site_id: s.id, bay, starts_at: start.toISOString(), hours, status: 'booked' }).select('*'))
    try {
      await run(supabase.from('ev_booking_slots').insert(slots.map((slot_start) => ({ booking_id: b.id, site_id: s.id, bay, slot_start }))))
    } catch (err) {
      await run(supabase.from('ev_bookings').delete().eq('id', b.id))
      if (err.status === 409) continue // someone took this bay a moment ago; try the next one
      throw err
    }
    await notify(userId, s.id, 'Charging bay booked',
      `Bay ${bay + 1} at ${s.name} is yours on ${start.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', timeZone: 'Asia/Kuala_Lumpur' })}, ${fmtHour(startHour)}–${fmtHour(startHour + hours)}. You pay after charging.`)
    return toBooking(b, new Map([[s.id, s.name]]))
  }
  throw new HttpError(409, 'No bay is free for that whole time. Try another hour or station.')
}

async function mineOr404(userId, id) {
  const { data, error } = await supabase.from('ev_bookings').select('*').eq('id', id).eq('user_id', userId).limit(1)
  failMissing(error)
  if (!data[0]) throw new HttpError(404, 'Booking not found')
  return data[0]
}

export async function cancel(userId, id) {
  const b = await mineOr404(userId, id)
  if (b.status !== 'booked') throw new HttpError(400, 'Only bookings that haven’t started can be cancelled')
  await run(supabase.from('ev_bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', b.id))
  await run(supabase.from('ev_booking_slots').delete().eq('booking_id', b.id))
}

/** plug in. `demo` (prototype only) allows starting before the slot */
export async function start(userId, id, demo) {
  const b = await mineOr404(userId, id)
  if (b.status !== 'booked') throw new HttpError(400, 'This booking can’t be started')
  const now = Date.now(), from = new Date(b.starts_at).getTime(), to = from + b.hours * H
  const early = now < from - 15 * 60_000
  if ((early && !(demo && config.showTestAccounts)) || now >= to) {
    throw new HttpError(400, early ? 'You can start charging from 15 minutes before your slot' : 'This booking has ended')
  }
  await run(supabase.from('ev_bookings').update({ status: 'charging', started_at: new Date().toISOString() }).eq('id', b.id))
}

/**
 * Unplug: work out the energy delivered and the bill. In the prototype the session is simulated
 * as the full booked time; each hour delivers ~80-95% of the charger's power as the battery fills.
 */
export async function finish(userId, id) {
  const b = await mineOr404(userId, id)
  if (b.status !== 'charging') throw new HttpError(400, 'Start charging first')
  let energy = 0, peak = 0
  const startHour = hourKL(b.starts_at)
  for (let i = 0; i < b.hours; i++) {
    const seed = [...`${b.id}${i}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
    const kwh = round2(EV.chargerKw * (0.95 - (i * 0.04) - (seed % 50) / 1000))
    energy += kwh
    if (isPeak((startHour + i) % 24)) peak += kwh
  }
  energy = round2(energy)
  peak = round2(peak)
  const amount = round2(energy * EV.pricePerKwh)
  const points = Math.floor(peak * EV.peakPointsPerKwh + (energy - peak) * EV.offPeakPointsPerKwh)
  await run(supabase.from('ev_bookings').update({
    status: 'awaiting_payment', finished_at: new Date().toISOString(), energy_kwh: energy, peak_kwh: peak, amount, points,
  }).eq('id', b.id))
  await run(supabase.from('ev_booking_slots').delete().eq('booking_id', b.id)) // the bay is free again
}

/** settle the bill (no payment gateway in the prototype) and award the points */
export async function pay(userId, id) {
  const b = await mineOr404(userId, id)
  if (b.status !== 'awaiting_payment') throw new HttpError(400, 'Nothing to pay for this booking')
  const s = await station(b.site_id)
  await run(supabase.from('ev_bookings').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', b.id))
  if (b.points > 0) {
    await rpc('apply_points', {
      p_user_id: userId, p_delta: b.points, p_activity: 'charge',
      p_title: `Charged ${Number(b.energy_kwh).toFixed(1)} kWh at ${s.name}`,
      p_idempotency_key: `ev:${b.id}`, p_metadata: { booking_id: b.id, kwh: Number(b.energy_kwh), peak_kwh: Number(b.peak_kwh) },
    })
  }
  await notify(userId, s.id, 'Charging paid',
    `${rm(Number(b.amount))} paid for ${Number(b.energy_kwh).toFixed(1)} kWh at ${s.name}. You earned ${b.points} points${Number(b.peak_kwh) > 0 ? ', with a solar-peak bonus' : ''}.`)
}

const fmtHour = (h) => `${((h + 11) % 12) + 1}${h < 12 || h === 24 ? 'am' : 'pm'}`

async function notify(userId, siteId, title, body) {
  const [row] = await run(supabase.from('alerts').insert({ user_id: userId, type: 'ev_charging', severity: 'success', title, body, site_id: siteId, detection: 'database_event' }).select('id'))
  await run(supabase.from('notification_deliveries').insert({ alert_id: row.id, channel: 'in_app', status: 'sent', attempts: 1, sent_at: new Date().toISOString() }))
}

