import type { GpsPoint, Trip, TripMode } from '../green'
import type { Alert, ChatMessage, EnvironmentalImpact, PortfolioSummary, ProjectPerformance, RealizedReturn, ScenarioSet } from './types'

const baseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, '')

/* ---------- session (set by the login page, kept in this browser) ---------- */

export interface Session { token: string; email: string; name: string }
const SESSION_KEY = 'solar-kita-session'

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) as Session : null
  } catch {
    return null
  }
}
export function setSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch { /* storage unavailable */ }
}

/** forget the session and go back to the login page */
export function signOut() {
  setSession(null)
  window.history.replaceState(null, '', '#/')
  window.location.reload()
}

/** the frontend has a backend to talk to (otherwise it runs the local demo) */
function isConfigured() {
  return !!baseUrl
}

/** a failed API call; `status` is 0 when the server couldn't be reached */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isConfigured()) {
    throw new ApiError(0, 'Missing VITE_API_URL')
  }

  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  const session = getSession()
  if (session) headers.set('Authorization', `Bearer ${session.token}`)

  let res: Response
  try {
    res = await fetch(`${baseUrl}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'Can’t reach the Solar Kita server')
  }

  if (res.status === 401 && session) {
    // expired or invalid session: back to the login page
    setSession(null)
    window.location.reload()
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null
    throw new ApiError(res.status, body?.error || `Request failed: ${res.status}`)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}

const post = <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

/* ---------- shapes served by /api/catalogue and /api/me (see server/src/services.js) ---------- */

export interface RemoteTownship {
  id: string; name: string; area: string; state: string; lat: number; lon: number; photo: string | null
  lake: [number, number]; park: [number, number]; towers: [number, number][]; seed: number; communityMWh: number; residents: number
}
export interface RemoteSite {
  id: string; townshipId: string; kind: 'subscription' | 'investment' | 'rooftop' | 'ev'; name: string; block: [number, number]
  pricePerUnit: number; returnLow: number; returnHigh: number; pointsPerUnit: number; co2PerUnit: number; kwpPerUnit: number
  units: number; cols: number; taken: number[]; capacityMW: number; outputPct: number; since: string; description: string; homesPowered: number
}
export interface RemoteReward {
  id: string; title: string; value: string; detail: string; cost: number; cat: 'mobility' | 'shopping' | 'home' | 'community'; icon: string | null; photo: string | null
}
export interface Catalogue { townships: RemoteTownship[]; sites: RemoteSite[]; rewards: RemoteReward[] }

export interface RemoteMe {
  name: string
  points: number
  lifetime: number
  township: string
  mapMode: '3d' | '2d'
  subs: { siteId: string; units: number[]; since: string }[]
  redemptions: { id: string; rewardId: string; at: number; code: string }[]
  activity: { id: string; title: string; points: number; at: number; type: 'subscribe' | 'redeem' | 'bonus' | 'event' | 'quiz' | 'checkin' | 'walk' | 'cycle' }[]
  checkins: string[]
  trips: Trip[]
}

export const backendApi = {
  isConfigured,

  /* sign-in (public) */
  login: (email: string) => post<{ isNew: true; email: string } | ({ isNew: false } & Session)>('/api/auth/login', { email }),
  testAccounts: () => request<{ email: string; name: string }[]>('/api/auth/accounts'),
  register: (email: string, name: string, townshipId: string) => post<Session>('/api/auth/register', { email, name, townshipId }),
  health: () => request<{ ok: boolean }>('/api/health'),

  /* app data */
  getCatalogue: () => request<Catalogue>('/api/catalogue'),
  getMe: () => request<RemoteMe>('/api/me'),
  updateMe: (patch: { townshipId?: string; mapMode?: '3d' | '2d'; fullName?: string }) =>
    request<RemoteMe>('/api/me', { method: 'PATCH', body: JSON.stringify(patch) }),
  subscribe: (siteId: string, units: number[]) => post<{ points: number; me: RemoteMe }>('/api/subscriptions', { siteId, units }),
  redeem: (rewardId: string, code: string) =>
    post<{ redemption: RemoteMe['redemptions'][number]; me: RemoteMe }>('/api/redemptions', { rewardId, code }),
  checkIn: () => post<RemoteMe>('/api/checkins'),
  resetDemo: () => post<RemoteMe>('/api/demo/reset'),
  logTrip: (mode: TripMode, path: GpsPoint[], source: 'gps' | 'demo') =>
    post<{ trip: Trip; capped: boolean; me: RemoteMe }>('/api/green/trips', { mode, path, source }),

  /* AI analyst tools */
  getPortfolioSummary: () => request<PortfolioSummary>('/api/portfolio/summary'),
  getRealizedReturn: () => request<RealizedReturn>('/api/returns/realized'),
  getProjectedScenarios: (args: { amount: number; years: number }) => post<ScenarioSet>('/api/scenarios/projected', args),
  getProjectPerformance: (projectId: string) =>
    request<ProjectPerformance>(`/api/projects/${encodeURIComponent(projectId)}/performance`),
  getEnvironmentalImpact: () => request<EnvironmentalImpact>('/api/impact/environmental'),

  /* alerts */
  getActiveAlerts: () => request<Alert[]>('/api/alerts'),
  markAlertRead: (id: string) => post<void>(`/api/alerts/${encodeURIComponent(id)}/read`),
  markAllAlertsRead: () => post<void>('/api/alerts/read-all'),

  /* Solar Analyst chat: the signed-in resident's own conversation */
  chatMessages: () => request<ChatMessage[]>('/api/chat/messages'),
  chatSend: (text: string) => post<ChatMessage>('/api/chat/messages', { text }),
  chatClear: () => request<void>('/api/chat/messages', { method: 'DELETE' }),
  sendMessage: (conversationId: string, text: string) =>
    post<ChatMessage>(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, { text }),
  listMessages: (conversationId: string) =>
    request<ChatMessage[]>(`/api/conversations/${encodeURIComponent(conversationId)}/messages`),
  clearMessages: (conversationId: string) =>
    request<void>(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, { method: 'DELETE' }),
}
