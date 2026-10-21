import type { Alert, ChatMessage, EnvironmentalImpact, PortfolioSummary, ProjectPerformance, RealizedReturn, ScenarioSet } from './types'

const baseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
const userId = (import.meta.env.VITE_DEMO_USER_ID as string | undefined)?.trim()

function isConfigured() {
  return !!baseUrl && !!userId
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isConfigured()) {
    throw new Error('Missing VITE_API_URL or VITE_DEMO_USER_ID')
  }

  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('x-user-id', userId!)

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed: ${res.status}`)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}

export const backendApi = {
  isConfigured,
  getPortfolioSummary: () => request<PortfolioSummary>('/api/portfolio/summary'),
  getRealizedReturn: () => request<RealizedReturn>('/api/returns/realized'),
  getProjectedScenarios: (args: { amount: number; years: number }) =>
    request<ScenarioSet>('/api/scenarios/projected', {
      method: 'POST',
      body: JSON.stringify(args),
    }),
  getProjectPerformance: (projectId: string) =>
    request<ProjectPerformance>(`/api/projects/${encodeURIComponent(projectId)}/performance`),
  getEnvironmentalImpact: () => request<EnvironmentalImpact>('/api/impact/environmental'),
  getActiveAlerts: () => request<Alert[]>('/api/alerts'),
  markAlertRead: (id: string) =>
    request<void>(`/api/alerts/${encodeURIComponent(id)}/read`, { method: 'POST' }),
  sendMessage: (conversationId: string, text: string) =>
    request<ChatMessage>(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  listMessages: (conversationId: string) =>
    request<ChatMessage[]>(`/api/conversations/${encodeURIComponent(conversationId)}/messages`),
  seedDemoData: (conversationId: string) =>
    request<{ conversationId: string; alerts: number; messages: number }>('/api/demo/seed', {
      method: 'POST',
      body: JSON.stringify({ conversationId }),
    }),
}
