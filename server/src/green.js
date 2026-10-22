import { run, rpc, supabase } from './db.js'
import { ensureProfile, me, toTrip } from './services.js'
import { HttpError, todayKL } from './utils.js'

/**
 * Go Green: residents earn points for walking or cycling inside their township instead of driving.
 * The app sends the raw GPS path; distance, speed, area checks, points and savings are all
 * computed here so a modified client can't award itself points. Keep in sync with src/green.ts.
 */
export const GREEN = {
  walk: { kmPerPoint: 3, minKmh: 1, maxKmh: 8, maxSegmentKmh: 15 },
  cycle: { kmPerPoint: 5, minKmh: 5, maxKmh: 35, maxSegmentKmh: 45 },
  dailyCap: 20,
  minKm: 0.2,
  minMinutes: 2,
  maxMinutes: 240,
  areaRadiusKm: 3,
  minInsideShare: 0.8,
  /** average petrol car, kg CO2e per km */
  co2KgPerKm: 0.171,
  petrolLPerKm: 0.07,
}

const R = 6371
const rad = (d) => (d * Math.PI) / 180
export function haversineKm(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** start of today in Malaysia, as an ISO timestamp */
const startOfTodayKL = () => new Date(`${todayKL()}T00:00:00+08:00`).toISOString()

function parsePath(raw) {
  if (!Array.isArray(raw) || raw.length < 2) throw new HttpError(400, 'Trip needs at least two GPS points')
  if (raw.length > 20_000) throw new HttpError(400, 'Trip has too many GPS points')
  const path = raw.map((p) => ({ lat: Number(p?.lat), lon: Number(p?.lon), t: Number(p?.t) }))
  if (path.some((p) => !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || !Number.isFinite(p.t) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180)) {
    throw new HttpError(400, 'Trip has invalid GPS points')
  }
  for (let i = 1; i < path.length; i++) if (path[i].t < path[i - 1].t) throw new HttpError(400, 'GPS points are out of order')
  return path
}

/** every Nth point so a stored route stays small */
const simplify = (path, max = 300) => {
  const step = Math.max(1, Math.ceil(path.length / max))
  const out = path.filter((_, i) => i % step === 0)
  if (out[out.length - 1] !== path[path.length - 1]) out.push(path[path.length - 1])
  return out.map((p) => [Math.round(p.lat * 1e6) / 1e6, Math.round(p.lon * 1e6) / 1e6])
}

/** pts earned from green trips so far today (Malaysia time) */
async function pointsToday(userId) {
  const { data, error } = await supabase.from('green_trips').select('points').eq('user_id', userId).gte('started_at', startOfTodayKL())
  if (error) {
    if (/green_trips/.test(error.message)) throw new HttpError(503, 'Go Green isn’t set up on the database yet: run server/green.sql in the Supabase SQL Editor.')
    throw new HttpError(500, error.message)
  }
  return data.reduce((a, r) => a + r.points, 0)
}

export async function logTrip(userId, body) {
  const profile = await ensureProfile(userId)
  const mode = body?.mode
  const rules = GREEN[mode]
  if (mode !== 'walk' && mode !== 'cycle') throw new HttpError(400, 'mode must be walk or cycle')
  const source = body?.source === 'demo' ? 'demo' : 'gps'
  const path = parsePath(body?.path)

  const township = (await run(supabase.from('townships').select('id, name, latitude, longitude').eq('id', profile.township_id ?? 'elmina').limit(1)))[0]
  if (!township) throw new HttpError(400, 'Set your home township first')

  // distance, ignoring GPS jumps faster than the mode allows
  let km = 0
  let rawKm = 0
  for (let i = 1; i < path.length; i++) {
    const d = haversineKm(path[i - 1], path[i])
    const hours = (path[i].t - path[i - 1].t) / 3_600_000
    rawKm += d
    if (hours > 0 && d / hours <= rules.maxSegmentKmh) km += d
  }
  const minutes = (path[path.length - 1].t - path[0].t) / 60_000
  const kmh = minutes > 0 ? km / (minutes / 60) : 0
  const centre = { lat: Number(township.latitude), lon: Number(township.longitude) }
  const inside = path.filter((p) => haversineKm(p, centre) <= GREEN.areaRadiusKm).length / path.length

  const label = mode === 'walk' ? 'walk' : 'ride'
  if (minutes < GREEN.minMinutes) throw new HttpError(400, `That ${label} was too short. Keep going for at least ${GREEN.minMinutes} minutes.`)
  if (minutes > GREEN.maxMinutes) throw new HttpError(400, `Trips can be at most ${GREEN.maxMinutes / 60} hours`)
  if (km < GREEN.minKm && rawKm >= GREEN.minKm) throw new HttpError(400, `That was faster than ${mode === 'walk' ? 'walking' : 'cycling'} (over ${rules.maxSegmentKmh} km/h), so it can’t earn points`)
  if (km < GREEN.minKm) throw new HttpError(400, `Go at least ${GREEN.minKm * 1000} m to earn points`)
  if (kmh < rules.minKmh || kmh > rules.maxKmh) {
    throw new HttpError(400, `Average speed ${kmh.toFixed(1)} km/h doesn’t look like ${mode === 'walk' ? 'walking' : 'cycling'} (${rules.minKmh}-${rules.maxKmh} km/h)`)
  }
  if (inside < GREEN.minInsideShare) {
    throw new HttpError(400, `Most of this ${label} was outside ${township.name}. Points are for trips within ${GREEN.areaRadiusKm} km of your township.`)
  }

  // whole points only: 1 per 3 km walked / 5 km cycled; shorter trips still count towards impact
  const earned = Math.floor(km / rules.kmPerPoint)
  const points = Math.max(0, Math.min(earned, GREEN.dailyCap - (await pointsToday(userId))))

  const [trip] = await run(supabase.from('green_trips').insert({
    user_id: userId,
    township_id: township.id,
    mode,
    source,
    started_at: new Date(path[0].t).toISOString(),
    ended_at: new Date(path[path.length - 1].t).toISOString(),
    distance_km: Math.round(km * 1000) / 1000,
    duration_min: Math.round(minutes * 100) / 100,
    inside_pct: Math.round(inside * 10000) / 100,
    points,
    co2_saved_kg: Math.round(km * GREEN.co2KgPerKm * 1000) / 1000,
    petrol_saved_l: Math.round(km * GREEN.petrolLPerKm * 1000) / 1000,
    path: simplify(path),
  }).select('*'))

  if (points > 0) {
    await rpc('apply_points', {
      p_user_id: userId, p_delta: points, p_activity: mode,
      p_title: `${mode === 'walk' ? 'Walked' : 'Cycled'} ${km.toFixed(1)} km in ${township.name}`,
      p_idempotency_key: `green:${trip.id}`, p_metadata: { trip_id: trip.id, km: Math.round(km * 100) / 100 },
    })
  }

  return { trip: toTrip(trip), capped: points < earned, me: await me(userId) }
}
