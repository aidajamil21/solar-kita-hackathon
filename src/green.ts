/**
 * Go Green: walk or cycle around your township instead of driving and earn points.
 * Same rules as server/src/green.js (the server recomputes everything from the GPS path;
 * the app uses these for the live preview and for the offline demo).
 */
export type TripMode = 'walk' | 'cycle'
export interface GpsPoint { lat: number; lon: number; t: number }
export interface Trip {
  id: string
  mode: TripMode
  source: 'gps' | 'demo'
  /** start time, ms */
  at: number
  distanceKm: number
  durationMin: number
  points: number
  co2Kg: number
  petrolL: number
  /** simplified route [[lat, lon], ...] */
  path: [number, number][]
}

export const GREEN = {
  walk: { kmPerPoint: 3, minKmh: 1, maxKmh: 8, maxSegmentKmh: 15 },
  cycle: { kmPerPoint: 5, minKmh: 5, maxKmh: 35, maxSegmentKmh: 45 },
  dailyCap: 20,
  minKm: 0.2,
  minMinutes: 2,
  maxMinutes: 240,
  areaRadiusKm: 3,
  minInsideShare: 0.8,
  co2KgPerKm: 0.171,
  petrolLPerKm: 0.07,
  /** RON95, RM per litre */
  petrolPrice: 2.05,
} as const

const rad = (d: number) => (d * Math.PI) / 180
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

export interface TripCheck {
  km: number
  minutes: number
  kmh: number
  /** share of points within the township area, 0..1 */
  inside: number
  /** points before the daily cap */
  points: number
  co2Kg: number
  petrolL: number
  /** why the trip wouldn't earn points yet, if anything */
  issue: string | null
}

/** the server's checks, run locally for the live preview */
export function checkTrip(path: GpsPoint[], mode: TripMode, centre: { lat: number; lon: number }, townName: string): TripCheck {
  const rules = GREEN[mode]
  let km = 0
  let rawKm = 0
  for (let i = 1; i < path.length; i++) {
    const d = haversineKm(path[i - 1], path[i])
    const hours = (path[i].t - path[i - 1].t) / 3_600_000
    rawKm += d
    if (hours > 0 && d / hours <= rules.maxSegmentKmh) km += d
  }
  const minutes = path.length > 1 ? (path[path.length - 1].t - path[0].t) / 60_000 : 0
  const kmh = minutes > 0 ? km / (minutes / 60) : 0
  const inside = path.length ? path.filter((p) => haversineKm(p, centre) <= GREEN.areaRadiusKm).length / path.length : 1
  const label = mode === 'walk' ? 'walk' : 'ride'

  let issue: string | null = null
  if (minutes < GREEN.minMinutes) issue = `Keep going: trips need at least ${GREEN.minMinutes} minutes`
  else if (km < GREEN.minKm && rawKm >= GREEN.minKm) issue = `That’s faster than ${mode === 'walk' ? 'walking' : 'cycling'} (over ${rules.maxSegmentKmh} km/h)`
  else if (km < GREEN.minKm) issue = `Go at least ${GREEN.minKm * 1000} m to earn points`
  else if (minutes > GREEN.maxMinutes) issue = `Trips can be at most ${GREEN.maxMinutes / 60} hours`
  else if (kmh < rules.minKmh || kmh > rules.maxKmh) issue = `${kmh.toFixed(1)} km/h doesn’t look like ${mode === 'walk' ? 'walking' : 'cycling'} (${rules.minKmh}-${rules.maxKmh} km/h)`
  else if (inside < GREEN.minInsideShare) issue = `Most of this ${label} is outside ${townName}`

  return {
    km,
    minutes,
    kmh,
    inside,
    // whole points only: 1 per 3 km walked / 5 km cycled
    points: Math.floor(km / rules.kmPerPoint),
    co2Kg: km * GREEN.co2KgPerKm,
    petrolL: km * GREEN.petrolLPerKm,
    issue,
  }
}

/** points already earned from trips today (local time) */
export function greenPointsToday(trips: Trip[]) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return trips.filter((t) => t.at >= start.getTime()).reduce((a, t) => a + t.points, 0)
}

/**
 * A realistic loop near the township centre, for demos on a laptop or outside the township:
 * ~2.2 km walk at ~5 km/h or ~6.5 km ride at ~16 km/h, one GPS fix every 5 s, ending now.
 */
export function demoRoute(centre: { lat: number; lon: number }, mode: TripMode): GpsPoint[] {
  const [a, b, kmh] = mode === 'walk' ? [0.42, 0.28, 5] : [1.2, 0.85, 16]
  const perimeter = 2 * Math.PI * Math.sqrt((a * a + b * b) / 2)
  const seconds = (perimeter / kmh) * 3600
  const n = Math.round(seconds / 5)
  const kmPerLat = 111.32
  const kmPerLon = 111.32 * Math.cos(rad(centre.lat))
  const offset = { x: (Math.random() - 0.5) * 0.8, y: (Math.random() - 0.5) * 0.8 }
  const turn = Math.random() * Math.PI
  const end = Date.now()
  return Array.from({ length: n + 1 }, (_, i) => {
    const th = (i / n) * Math.PI * 2
    const wob = 1 + Math.sin(th * 5) * 0.03
    const x0 = Math.cos(th) * a * wob, y0 = Math.sin(th) * b * wob
    const x = offset.x + x0 * Math.cos(turn) - y0 * Math.sin(turn) + (Math.random() - 0.5) * 0.004
    const y = offset.y + x0 * Math.sin(turn) + y0 * Math.cos(turn) + (Math.random() - 0.5) * 0.004
    return { lat: centre.lat + y / kmPerLat, lon: centre.lon + x / kmPerLon, t: Math.round(end - seconds * 1000 + (i / n) * seconds * 1000) }
  })
}

export const fmtDuration = (minutes: number) => {
  const s = Math.max(0, Math.round(minutes * 60))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}
