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
  /** (payouts - fees) / contributions */
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
}
export interface ScenarioSet extends DataMeta {
  amount: number
  years: number
  scenarios: Scenario[]
  assumptions: string[]
  risks: string[]
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
  | 'project_outage' | 'funding_milestone' | 'rewards_milestone' | 'project_report'
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
  | 'get_portfolio_summary' | 'calculate_realized_return' | 'calculate_projected_scenarios'
  | 'get_project_performance' | 'get_environmental_impact' | 'get_active_alerts'

/** structured results the assistant attaches so the UI can render rich cards */
export type Attachment =
  | { kind: 'portfolio'; data: PortfolioSummary }
  | { kind: 'realized'; data: RealizedReturn }
  | { kind: 'scenarios'; data: ScenarioSet }
  | { kind: 'performance'; data: ProjectPerformance }
  | { kind: 'impact'; data: EnvironmentalImpact }
  | { kind: 'alerts'; data: Alert[] }

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
