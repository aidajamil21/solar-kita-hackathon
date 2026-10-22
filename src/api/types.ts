/**
 * Shared contract between the Solar Kita frontend and backend.
 * Each type mirrors one approved AI tool / REST endpoint (see API.md).
 * All money is in MYR, all timestamps are ISO-8601 strings.
 */

/** Every response says where its numbers came from and how fresh they are. */
export interface DataMeta {
  /** 'verified' = recorded actuals; 'forecast' = model output based on stated assumptions */
  basis: 'verified' | 'forecast'
  asOf: string
  source: string
}

/* ---------- get_portfolio_summary ---------- */
export interface Holding {
  projectId: string
  projectName: string
  kind: 'subscription' | 'investment' | 'rooftop' | 'ev'
  township: string
  units: number
  contributed: number
  payoutsReceived: number
  status: 'active' | 'pending' | 'closed'
}
export interface PortfolioSummary extends DataMeta {
  totalContributed: number
  totalPayoutsReceived: number
  /** declared but not yet paid */
  outstandingPayouts: number
  nextPayout: { date: string; estimatedAmount: number } | null
  holdings: Holding[]
}

/* ---------- calculate_realized_return ---------- */
export interface CashFlow { date: string; type: 'contribution' | 'payout' | 'fee'; amount: number; projectId: string }
export interface RealizedReturn extends DataMeta {
  contributions: number
  payouts: number
  fees: number
  /** part of the credits that is the resident's own money coming back */
  capitalReturned?: number
  /** part of the credits earned on top */
  extra?: number
  /** extra earned / contributions */
  realizedReturnPct: number
  /** annualised, money-weighted */
  annualisedPct: number
  cashFlows: CashFlow[]
}

/* ---------- calculate_projected_scenarios ---------- */
export interface Scenario {
  name: 'Conservative' | 'Base' | 'Optimistic'
  annualReturnPct: number
  totalPayouts: number
  endValue: number
  /** own money returned by the end of the period */
  moneyBack?: number
}
export interface ScenarioSet extends DataMeta {
  amount: number
  years: number
  scenarios: Scenario[]
  assumptions: string[]
  risks: string[]
  /** set when the projection uses one project's return range */
  projectName?: string
}

/* ---------- get_project_performance ---------- */
export interface GenerationPoint { month: string; actualMWh: number; forecastMWh: number }
export interface ProjectPerformance extends DataMeta {
  projectId: string
  projectName: string
  capacityMW: number
  generation: GenerationPoint[]
  /** latest month, actual vs forecast */
  forecastDeviationPct: number
  availabilityPct: number
  revenueMonth: number
  operatingCostMonth: number
  status: 'normal' | 'underperforming' | 'outage'
}

/* ---------- get_environmental_impact ---------- */
export interface EnvironmentalImpact extends DataMeta {
  attributableKWh: number
  emissionsAvoidedT: number
  treesEquivalent: number
  method: string
  byProject: { projectName: string; kWh: number; tCO2e: number }[]
}

/* ---------- get_active_alerts ---------- */
export type AlertType =
  | 'contribution_recorded' | 'payout_completed' | 'payout_overdue' | 'low_generation'
  | 'project_outage' | 'funding_milestone' | 'rewards_milestone' | 'project_report' | 'ev_charging'
export interface Alert {
  id: string
  type: AlertType
  severity: 'info' | 'success' | 'warning' | 'critical'
  title: string
  body: string
  createdAt: string
  read: boolean
  projectId?: string
  /** how the backend detected it: database event, scheduled check, monitoring rule */
  detection: 'database_event' | 'scheduled_check' | 'monitoring_rule'
}

/* ---------- conversation ---------- */
export type ToolName =
  // LLM analyst (server/src/llm.js)
  | 'get_user_portfolio' | 'calculate_investment_return' | 'compare_investment_scenarios' | 'get_recent_alerts'
  // rule-based analyst (server/src/assistant.js, the fallback) and older saved messages
  | 'get_portfolio_summary' | 'calculate_realized_return' | 'calculate_projected_scenarios' | 'get_active_alerts'
  | 'get_project_performance' | 'get_environmental_impact'

/** a button in a reply that opens a page of the app (validated by the server) */
export interface ChatLink { label: string; to: string; icon?: 'map' | 'sun' | 'coins' | 'calendar' | 'plug' | 'leaf' | 'gift'; section?: string; siteId?: string }

/** structured results the assistant attaches so the UI can render rich cards */
export type Attachment =
  | { kind: 'portfolio'; data: PortfolioSummary }
  | { kind: 'realized'; data: RealizedReturn }
  /** `sets` holds every compared duration (the card switches between them); `data` is the longest */
  | { kind: 'scenarios'; data: ScenarioSet; sets?: ScenarioSet[] }
  | { kind: 'performance'; data: ProjectPerformance }
  | { kind: 'impact'; data: EnvironmentalImpact }
  | { kind: 'alerts'; data: Alert[] }
  | { kind: 'links'; data: ChatLink[] }

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  toolCalls?: { name: ToolName; args?: Record<string, unknown> }[]
  attachments?: Attachment[]
  suggestions?: string[]
}

/** streamed while the assistant is answering */
export type ChatEvent =
  | { type: 'tool'; name: ToolName; args?: Record<string, unknown> }
  | { type: 'delta'; text: string }
  | { type: 'done'; message: ChatMessage }

export interface SolarApi {
  getPortfolioSummary(): Promise<PortfolioSummary>
  calculateRealizedReturn(): Promise<RealizedReturn>
  calculateProjectedScenarios(args: { amount: number; years: number }): Promise<ScenarioSet>
  getProjectPerformance(projectId: string): Promise<ProjectPerformance>
  getEnvironmentalImpact(): Promise<EnvironmentalImpact>
  getActiveAlerts(): Promise<Alert[]>
  markAlertRead(id: string): Promise<void>
  listMessages(conversationId: string): Promise<ChatMessage[]>
  sendMessage(conversationId: string, text: string, onEvent: (e: ChatEvent) => void): Promise<ChatMessage>
  clearConversation(conversationId: string): Promise<void>
}
