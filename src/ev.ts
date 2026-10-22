/**
 * EV charging bookings: same rules as server/src/ev.js (the server keeps the real records and
 * works out the actual energy and bill; the app uses these for previews). Times are Malaysia time.
 */
export const EV = {
  pricePerKwh: 1.2,
  chargerKw: 7.4,
  openHour: 7,
  closeHour: 23,
  peakStart: 11,
  peakEnd: 15,
  peakPointsPerKwh: 2,
  offPeakPointsPerKwh: 0.5,
  maxHours: 4,
  daysAhead: 7,
  maxUpcoming: 3,
} as const

/** typical share of the charger's power a car takes over an hour (it slows as the battery fills) */
const TYPICAL_LOAD = 0.87

export const isPeak = (hour: number) => hour >= EV.peakStart && hour < EV.peakEnd

export const fmtHour = (h: number) => `${((h + 11) % 12) + 1}${h < 12 || h === 24 ? 'am' : 'pm'}`

/** estimated energy, cost and points for a booking (the real figures come after charging) */
export function estimate(startHour: number, hours: number) {
  let kwh = 0, peakKwh = 0
  for (let i = 0; i < hours; i++) {
    const k = EV.chargerKw * TYPICAL_LOAD
    kwh += k
    if (isPeak(startHour + i)) peakKwh += k
  }
  return {
    kwh: Math.round(kwh * 10) / 10,
    peakKwh: Math.round(peakKwh * 10) / 10,
    cost: Math.round(kwh * EV.pricePerKwh * 100) / 100,
    points: Math.floor(peakKwh * EV.peakPointsPerKwh + (kwh - peakKwh) * EV.offPeakPointsPerKwh),
  }
}

/** the next `EV.daysAhead` dates in Malaysia time, as YYYY-MM-DD */
export function bookableDates() {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
  const now = Date.now()
  return Array.from({ length: EV.daysAhead }, (_, i) => fmt.format(new Date(now + i * 86_400_000)))
}

/** "Today", "Tomorrow", "Sat 25 Oct" */
export function dayLabel(date: string, i: number) {
  if (i === 0) return 'Today'
  if (i === 1) return 'Tomorrow'
  return new Date(`${date}T12:00:00+08:00`).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kuala_Lumpur' })
}

/** hour of a timestamp in Malaysia time */
export const hourKL = (iso: string) => (new Date(iso).getUTCHours() + 8) % 24
