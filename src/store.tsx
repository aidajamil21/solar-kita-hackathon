import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError, backendApi, type RemoteMe } from './api/backend'
import { hydrateCatalogue, REWARDS, SUNSHINE, siteById, townshipById, type Site } from './data'
import { checkTrip, GREEN, greenPointsToday, type GpsPoint, type Trip, type TripMode } from './green'

export type MapMode = '3d' | '2d'

export interface Sub {
  siteId: string
  units: number[]
  /** YYYY-MM the subscription started */
  since: string
}

export interface Activity {
  id: string
  title: string
  points: number
  at: number
  type: ActivityType
}

export type ActivityType = 'subscribe' | 'redeem' | 'bonus' | 'event' | 'quiz' | 'checkin' | 'walk' | 'cycle' | 'plan'

export interface Redemption {
  id: string
  rewardId: string
  at: number
  code: string
}

interface State {
  /** resident's display name */
  name: string
  points: number
  lifetime: number
  township: string
  subs: Sub[]
  redemptions: Redemption[]
  activity: Activity[]
  checkins: string[]
  /** explore map renderer: the GPU-heavy 3D scene or a light flat 2D map */
  mapMode: MapMode
  /** Go Green walks and rides, newest first */
  trips: Trip[]
}

export interface TripResult { trip: Trip; capped: boolean }

const DAY = 86_400_000
const now = Date.now()

const SEED: State = {
  name: 'Jane Doe',
  points: 1250,
  // 2,050 earned - 800 redeemed = 1,250 (matches server/seed.sql)
  lifetime: 2050,
  township: 'elmina',
  subs: [
    { siteId: 'elmina-subscription', units: [12, 13, 14, 15], since: '2024-01' },
    { siteId: 'elmina-rooftop', units: [0, 1], since: '2024-03' },
  ],
  redemptions: [
    { id: 'r0', rewardId: 'ev20', at: now - 12 * DAY, code: 'SK-EV-4821' },
  ],
  activity: [
    { id: 'a1', title: 'Monthly solar bonus', points: 50, at: now - 2 * DAY, type: 'bonus' },
    { id: 'a2', title: 'Joined “Lights Out Hour”', points: 120, at: now - 6 * DAY, type: 'event' },
    { id: 'a3', title: 'Redeemed EV Charging Credit', points: -800, at: now - 12 * DAY, type: 'redeem' },
    { id: 'a4', title: 'Energy-saving quiz', points: 50, at: now - 15 * DAY, type: 'quiz' },
  ],
  checkins: [],
  mapMode: '3d',
  trips: [],
}

const KEY = 'solar-kita-v5'

/** set before render when the backend answered at startup (see main.tsx); the store then reads and writes through the API */
let remoteStart: RemoteMe | null = null
export function startWithBackend(me: RemoteMe) { remoteStart = me }

const fromRemote = (me: RemoteMe): State => ({ ...me, trips: me.trips ?? [] })

/** today's date as YYYY-MM-DD in local time */
const today = () => new Date().toLocaleDateString('en-CA')

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...SEED, ...JSON.parse(raw) }
  } catch { /* storage unavailable */ }
  return SEED
}

/* ---------- credit maths ----------
 * A block purchase is returned over 120 months, starting the month after it's bought:
 * 1/120 of the price every month, plus the project's expected return (mid of its 2-3% range,
 * scaled by that month's sunshine) on the part not yet returned. Same as server/src/utils.js.
 */

export const MONTHS_BACK = 120
export const expectedRate = (s: Site) => (s.returnLow + s.returnHigh) / 200
export const investedOf = (sub: Sub) => sub.units.length * (siteById(sub.siteId)?.pricePerUnit ?? 0)

const round2 = (n: number) => Math.round(n * 100) / 100

/** credit k (1..120) for a purchase of `price`, paid in calendar month `monthIdx` (0 = Jan) */
export function blockCredit(price: number, rate: number, k: number, monthIdx: number) {
  if (k < 1 || k > MONTHS_BACK) return { capital: 0, interest: 0, amount: 0 }
  // whole sen and integer maths so it rounds exactly like the server and seed.sql (half up)
  const divRound = (num: number, den: number) => Math.floor((2 * num + den) / (2 * den))
  const P = Math.round(price * 100)
  const cap = divRound(P, MONTHS_BACK)
  const capital = k < MONTHS_BACK ? cap : P - cap * (MONTHS_BACK - 1)
  const interest = divRound((P - cap * (k - 1)) * Math.round(rate * 1e6) * Math.round(SUNSHINE[monthIdx] * 100), 1e6 * 100 * 12)
  return { capital: capital / 100, interest: interest / 100, amount: (capital + interest) / 100 }
}

function monthIndex(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return y * 12 + (m - 1)
}
const thisMonth = () => {
  const d = new Date()
  return d.getFullYear() * 12 + d.getMonth()
}

/** the credit a holding pays in absolute month `idx` (credits start the month after purchase) */
function creditIn(sub: Sub, idx: number) {
  const site = siteById(sub.siteId)
  if (!site) return { capital: 0, interest: 0, amount: 0 }
  return blockCredit(investedOf(sub), expectedRate(site), idx - monthIndex(sub.since), idx % 12)
}

/** credits received (oldest first), from the month after purchase until last month */
export function payoutHistory(sub: Sub) {
  const out: { idx: number; month: number; year: number; amount: number; capital: number; interest: number }[] = []
  for (let i = monthIndex(sub.since) + 1; i < thisMonth(); i++) {
    out.push({ idx: i, month: i % 12, year: Math.floor(i / 12), ...creditIn(sub, i) })
  }
  return out
}

/** everything credited so far (your money returned + extra) */
export const payoutsReceived = (sub: Sub) => round2(payoutHistory(sub).reduce((a, b) => a + b.amount, 0))
/** the extra earned so far, on top of your own money coming back */
export const interestReceived = (sub: Sub) => round2(payoutHistory(sub).reduce((a, b) => a + b.interest, 0))
/** your own money returned so far */
export const capitalReturned = (sub: Sub) => round2(payoutHistory(sub).reduce((a, b) => a + b.capital, 0))

/** this month's credit (or next month's, for a holding bought this month) */
export function monthlyPayout(sub: Sub) {
  const now = thisMonth()
  return creditIn(sub, Math.max(now, monthIndex(sub.since) + 1)).amount
}

/** credits in a given month, k months from now (0 = this month) */
export const creditAhead = (sub: Sub, k: number) => creditIn(sub, Math.max(thisMonth(), monthIndex(sub.since) + 1) + k).amount

/** combined monthly credits across holdings for the last n months */
export function combinedPayouts(subs: Sub[], n: number) {
  const end = thisMonth()
  return Array.from({ length: n }, (_, k) => {
    const idx = end - n + k
    let amount = 0, interest = 0
    for (const s of subs) { const c = creditIn(s, idx); amount += c.amount; interest += c.interest }
    return { idx, month: idx % 12, year: Math.floor(idx / 12), amount: round2(amount), interest: round2(interest) }
  })
}

export function nextPayoutDate() {
  const d = new Date()
  const p = new Date(d.getFullYear(), d.getMonth(), 28)
  if (d.getDate() > 28) p.setMonth(p.getMonth() + 1)
  return p
}

/* ---------- context ---------- */

interface Toast { id: number; text: string }

interface Store extends State {
  /** true when data comes from the Solar Kita backend (otherwise it's the local demo) */
  online: boolean
  subscribe: (siteId: string, units: number[]) => number
  redeem: (rewardId: string) => Redemption | null
  checkIn: () => boolean
  setTownship: (id: string) => void
  setMapMode: (mode: MapMode) => void
  reset: () => Promise<void>
  /** replace the resident's data with what the server returned (after plan changes etc.) */
  applyMe: (me: RemoteMe) => void
  /** save a walk/ride; rejects with a message when it doesn't qualify */
  logTrip: (mode: TripMode, path: GpsPoint[], source: 'gps' | 'demo') => Promise<TripResult>
  toast: (text: string) => void
  toasts: Toast[]
  takenFor: (site: Site) => Set<number>
  mineFor: (site: Site) => Set<number>
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [online] = useState(() => remoteStart !== null)
  const [state, setState] = useState<State>(() => (remoteStart ? fromRemote(remoteStart) : load()))
  const [toasts, setToasts] = useState<Toast[]>([])
  const [, setCatalogueVersion] = useState(0)
  const tid = useRef(0)

  // the local demo keeps its state in the browser; online state lives in the database
  useEffect(() => {
    if (online) return
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
  }, [state, online])

  const toast = useCallback((text: string) => {
    const id = ++tid.current
    setToasts((t) => [...t, { id, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }, [])

  /* ---- server sync: every change is applied locally first, then confirmed by the API ---- */
  const apply = useCallback((me: RemoteMe) => setState(fromRemote(me)), [])
  const refreshCatalogue = useCallback(() => {
    backendApi.getCatalogue().then((c) => { hydrateCatalogue(c); setCatalogueVersion((v) => v + 1) }).catch(() => {})
  }, [])
  const failed = useCallback((err: unknown) => {
    toast(err instanceof ApiError ? err.message : 'Couldn’t save that change')
    backendApi.getMe().then(apply).catch(() => {})
    if (err instanceof ApiError && err.status === 409) refreshCatalogue()
  }, [toast, apply, refreshCatalogue])

  const subscribe = useCallback((siteId: string, units: number[]) => {
    const site = siteById(siteId)!
    const pts = units.length * site.pointsPerUnit
    setState((s) => {
      const existing = s.subs.find((x) => x.siteId === siteId)
      const d = new Date()
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const subs = existing
        ? s.subs.map((x) => (x.siteId === siteId ? { ...x, units: [...new Set([...x.units, ...units])].sort((a, b) => a - b) } : x))
        : [...s.subs, { siteId, units: [...units].sort((a, b) => a - b), since: ym }]
      return {
        ...s,
        subs,
        points: s.points + pts,
        lifetime: s.lifetime + pts,
        activity: [{ id: `a${Date.now()}`, title: `Subscribed to ${site.name}`, points: pts, at: Date.now(), type: 'subscribe' }, ...s.activity],
      }
    })
    if (online) backendApi.subscribe(siteId, units).then((r) => apply(r.me)).catch(failed)
    return pts
  }, [online, apply, failed])

  const redeem = useCallback((rewardId: string) => {
    const r = REWARDS.find((x) => x.id === rewardId)!
    if (state.points < r.cost) return null
    const red: Redemption = {
      id: `r${Date.now()}`,
      rewardId,
      at: Date.now(),
      code: `SK-${rewardId.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
    }
    setState((s) => ({
      ...s,
      points: s.points - r.cost,
      redemptions: [red, ...s.redemptions],
      activity: [{ id: `a${Date.now()}`, title: `Redeemed ${r.title}`, points: -r.cost, at: Date.now(), type: 'redeem' }, ...s.activity],
    }))
    if (online) backendApi.redeem(rewardId, red.code).then((res) => apply(res.me)).catch(failed)
    return red
  }, [state.points, online, apply, failed])

  const checkIn = useCallback(() => {
    const day = today()
    if (state.checkins.includes(day)) return false
    setState((s) => ({
      ...s,
      points: s.points + 10,
      lifetime: s.lifetime + 10,
      checkins: [day, ...s.checkins],
      activity: [{ id: `a${Date.now()}`, title: 'Daily sun check-in', points: 10, at: Date.now(), type: 'checkin' }, ...s.activity],
    }))
    if (online) backendApi.checkIn().then(apply).catch(failed)
    return true
  }, [state.checkins, online, apply, failed])

  const setTownship = useCallback((id: string) => {
    setState((s) => ({ ...s, township: id }))
    if (online) backendApi.updateMe({ townshipId: id }).then(apply).catch(failed)
  }, [online, apply, failed])

  const setMapMode = useCallback((mapMode: MapMode) => {
    setState((s) => ({ ...s, mapMode }))
    if (online) backendApi.updateMe({ mapMode }).then(apply).catch(failed)
  }, [online, apply, failed])

  const reset = useCallback(async () => {
    if (!online) { setState((s) => ({ ...SEED, mapMode: s.mapMode })); return }
    try { apply(await backendApi.resetDemo()); refreshCatalogue() } catch (err) { failed(err); throw err }
  }, [online, apply, failed, refreshCatalogue])

  const logTrip = useCallback(async (mode: TripMode, path: GpsPoint[], source: 'gps' | 'demo'): Promise<TripResult> => {
    if (online) {
      const res = await backendApi.logTrip(mode, path, source)
      apply(res.me)
      return { trip: res.trip, capped: res.capped }
    }
    // local demo: same checks as the server
    const town = townshipById(state.township)
    const c = checkTrip(path, mode, town, town.name)
    if (c.issue) throw new Error(c.issue)
    const points = Math.max(0, Math.min(c.points, GREEN.dailyCap - greenPointsToday(state.trips)))
    const trip: Trip = {
      id: `t${Date.now()}`, mode, source, at: path[0].t, distanceKm: c.km, durationMin: c.minutes, points,
      co2Kg: c.co2Kg, petrolL: c.petrolL, path: path.map((p) => [p.lat, p.lon] as [number, number]),
    }
    setState((s) => ({
      ...s,
      trips: [trip, ...s.trips],
      points: s.points + points,
      lifetime: s.lifetime + points,
      activity: points
        ? [{ id: `a${Date.now()}`, title: `${mode === 'walk' ? 'Walked' : 'Cycled'} ${c.km.toFixed(1)} km in ${town.name}`, points, at: Date.now(), type: mode }, ...s.activity]
        : s.activity,
    }))
    return { trip, capped: points < c.points }
  }, [online, apply, state.township, state.trips])

  const store = useMemo<Store>(() => ({
    ...state,
    online,
    toasts,
    toast,
    subscribe,
    redeem,
    checkIn,
    setTownship,
    setMapMode,
    reset,
    logTrip,
    applyMe: apply,
    takenFor: (site) => new Set(site.taken),
    mineFor: (site) => new Set(state.subs.find((x) => x.siteId === site.id)?.units ?? []),
  }), [state, online, toasts, toast, subscribe, redeem, checkIn, setTownship, setMapMode, reset, logTrip, apply])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside provider')
  return s
}


