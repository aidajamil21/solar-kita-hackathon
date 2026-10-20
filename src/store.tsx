import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { REWARDS, SUNSHINE, siteById, type Site } from './data'

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

export type ActivityType = 'subscribe' | 'redeem' | 'bonus' | 'event' | 'quiz' | 'checkin'

export interface Redemption {
  id: string
  rewardId: string
  at: number
  code: string
}

interface State {
  points: number
  lifetime: number
  township: string
  subs: Sub[]
  redemptions: Redemption[]
  activity: Activity[]
  checkins: string[]
}

const DAY = 86_400_000
const now = Date.now()

const SEED: State = {
  points: 1250,
  lifetime: 1250,
  township: 'elmina',
  subs: [
    { siteId: 'elmina-subscription', units: [2, 3], since: '2024-01' },
    { siteId: 'elmina-rooftop', units: [0], since: '2024-03' },
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
}

const KEY = 'solar-kita-v2'

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...SEED, ...JSON.parse(raw) }
  } catch { /* storage unavailable */ }
  return SEED
}

/* ---------- ROF maths ---------- */

export const rateOf = (s: Site) => (s.returnLow + s.returnHigh) / 200
export const investedOf = (sub: Sub) => sub.units.length * (siteById(sub.siteId)?.pricePerUnit ?? 0)
export const monthlyRof = (sub: Sub) => {
  const site = siteById(sub.siteId)!
  return (investedOf(sub) * rateOf(site)) / 12
}

function monthIndex(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return y * 12 + (m - 1)
}
const thisMonth = () => {
  const d = new Date()
  return d.getFullYear() * 12 + d.getMonth()
}

/** ROF paid per month (oldest first) from start until last month */
export function rofHistory(sub: Sub) {
  const start = monthIndex(sub.since)
  const end = thisMonth()
  const base = monthlyRof(sub)
  const out: { idx: number; month: number; year: number; amount: number }[] = []
  for (let i = start; i < end; i++) {
    out.push({ idx: i, month: i % 12, year: Math.floor(i / 12), amount: base * SUNSHINE[i % 12] })
  }
  return out
}

export const rofEarned = (sub: Sub) => rofHistory(sub).reduce((a, b) => a + b.amount, 0)

/** combined monthly payouts across subs for the last n months */
export function combinedPayouts(subs: Sub[], n: number) {
  const end = thisMonth()
  return Array.from({ length: n }, (_, k) => {
    const idx = end - n + k
    const amount = subs.reduce((acc, s) => (monthIndex(s.since) <= idx ? acc + monthlyRof(s) * SUNSHINE[idx % 12] : acc), 0)
    return { idx, month: idx % 12, year: Math.floor(idx / 12), amount }
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
  subscribe: (siteId: string, units: number[]) => number
  redeem: (rewardId: string) => Redemption | null
  checkIn: () => boolean
  setTownship: (id: string) => void
  reset: () => void
  toast: (text: string) => void
  toasts: Toast[]
  takenFor: (site: Site) => Set<number>
  mineFor: (site: Site) => Set<number>
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(load)
  const [toasts, setToasts] = useState<Toast[]>([])
  const tid = useRef(0)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
  }, [state])

  const toast = useCallback((text: string) => {
    const id = ++tid.current
    setToasts((t) => [...t, { id, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }, [])

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
    return pts
  }, [])

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
    return red
  }, [state.points])

  const checkIn = useCallback(() => {
    const today = new Date().toDateString()
    if (state.checkins.includes(today)) return false
    setState((s) => ({
      ...s,
      points: s.points + 10,
      lifetime: s.lifetime + 10,
      checkins: [...s.checkins, today],
      activity: [{ id: `a${Date.now()}`, title: 'Daily sun check-in', points: 10, at: Date.now(), type: 'checkin' }, ...s.activity],
    }))
    return true
  }, [state.checkins])

  const store = useMemo<Store>(() => ({
    ...state,
    toasts,
    toast,
    subscribe,
    redeem,
    checkIn,
    setTownship: (id) => setState((s) => ({ ...s, township: id })),
    reset: () => setState(SEED),
    takenFor: (site) => new Set(site.taken),
    mineFor: (site) => new Set(state.subs.find((x) => x.siteId === site.id)?.units ?? []),
  }), [state, toasts, toast, subscribe, redeem, checkIn])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside provider')
  return s
}


