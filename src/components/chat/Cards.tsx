import { motion } from 'framer-motion'
import { AlertTriangle, BadgeCheck, BarChart3, Bell, CalendarClock, ChevronDown, CircleDollarSign, FileText, Flag, HandCoins, Leaf, LineChart, PowerOff, Star, TreePine, Wrench, Zap, type LucideIcon } from 'lucide-react'
import { createElement, useState, type ReactNode } from 'react'
import type { Alert, AlertType, Attachment, DataMeta, EnvironmentalImpact, PortfolioSummary, ProjectPerformance, RealizedReturn, ScenarioSet, ToolName } from '../../api/types'
import { rm } from '../../data'

const fmtTime = (iso: string) => new Date(iso).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** "Verified · as of …" or "Forecast" — every number says what it is */
export function DataBadge({ meta }: { meta: DataMeta }) {
  const verified = meta.basis === 'verified'
  return (
    <div className="row" style={{ gap: 6, fontSize: 10.5, color: 'var(--muted)', fontWeight: 600 }}>
      <span className={`pill ${verified ? 'green' : ''}`} style={{ height: 20, fontSize: 10, padding: '0 7px' }}>
        {verified ? <BadgeCheck size={11} /> : <LineChart size={11} />} {verified ? 'Verified data' : 'Forecast'}
      </span>
      <span className="ellipsis">{meta.source} · {fmtTime(meta.asOf)}</span>
    </div>
  )
}

function Shell({ icon, title, meta, children }: { icon: LucideIcon; title: string; meta?: DataMeta; children: ReactNode }) {
  return (
    <div className="card" style={{ padding: 14, marginTop: 8 }}>
      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <span className="ic sm" style={{ width: 28, height: 28 }}>{createElement(icon, { size: 14 })}</span>
        <span style={{ fontWeight: 800, fontSize: 13 }}>{title}</span>
      </div>
      {children}
      {meta && <div style={{ marginTop: 10 }}><DataBadge meta={meta} /></div>}
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'muted' }) {
  return (
    <div style={{ background: '#FAFAF8', border: '1px solid var(--line-2)', borderRadius: 12, padding: '8px 10px' }}>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
      <div className="num" style={{ fontWeight: 800, fontSize: 14.5, color: tone === 'green' ? 'var(--green)' : undefined }}>{value}</div>
    </div>
  )
}

/* ---------- get_portfolio_summary ---------- */
export function PortfolioCard({ d }: { d: PortfolioSummary }) {
  return (
    <Shell icon={CircleDollarSign} title="Portfolio summary" meta={d}>
      <div className="grid-2" style={{ gap: 6 }}>
        <Metric label="Contributed" value={rm(d.totalContributed)} />
        <Metric label="Credited to you" value={rm(d.totalPayoutsReceived, 2)} tone="green" />
        <Metric label="Credits on the way" value={rm(d.outstandingPayouts, 2)} />
        <Metric label="Next credit (est.)" value={d.nextPayout ? rm(d.nextPayout.estimatedAmount, 2) : '—'} />
      </div>
      <div className="list" style={{ marginTop: 6 }}>
        {d.holdings.map((h) => (
          <div key={h.projectId} className="list-row" style={{ padding: '9px 0' }}>
            <div className="grow">
              <div style={{ fontWeight: 700, fontSize: 12.5 }}>{h.projectName}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{h.units} unit{h.units > 1 ? 's' : ''} · {h.township}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11.5 }}>
              <div className="num" style={{ fontWeight: 700 }}>{rm(h.contributed)}</div>
              <div className="num" style={{ color: 'var(--green)', fontWeight: 600 }}>+{rm(h.payoutsReceived, 2)}</div>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  )
}

/* ---------- calculate_realized_return ---------- */
export function RealizedCard({ d }: { d: RealizedReturn }) {
  return (
    <Shell icon={HandCoins} title="Returns received so far" meta={d}>
      <div className="grid-2" style={{ gap: 6 }}>
        <Metric label="Your contributions" value={rm(d.contributions)} />
        <Metric label="Credited to you" value={rm(d.payouts, 2)} tone="green" />
        <Metric label="Your money back" value={rm(d.capitalReturned ?? 0, 2)} />
        <Metric label="Extra earned" value={`${rm(d.extra ?? 0, 2)} (≈${d.annualisedPct.toFixed(1)}% a year)`} tone="green" />
      </div>
    </Shell>
  )
}

/* ---------- calculate_projected_scenarios ---------- */
export function ScenarioCard({ d }: { d: ScenarioSet }) {
  const max = Math.max(...d.scenarios.map((s) => s.totalPayouts))
  const [open, setOpen] = useState(false)
  return (
    <Shell icon={LineChart} title={`${rm(d.amount)} over ${d.years} years`} meta={d}>
      <div className="col" style={{ gap: 10 }}>
        {d.scenarios.map((s, i) => (
          <div key={s.name}>
            <div className="row between" style={{ fontSize: 11.5, marginBottom: 4 }}>
              <span style={{ fontWeight: 700 }}>{s.name} <span className="muted" style={{ fontWeight: 500 }}>· {s.annualReturnPct}% p.a.</span></span>
              <span className="num" style={{ fontWeight: 800 }}>+{rm(s.totalPayouts)}</span>
            </div>
            <div className="progress" style={{ height: 8 }}>
              <motion.i initial={{ width: 0 }} animate={{ width: `${(s.totalPayouts / max) * 100}%` }} transition={{ delay: 0.1 + i * 0.1, duration: 0.7 }}
                style={{ background: ['#FFC9A8', '#FF6E00', '#F20000'][i] }} />
            </div>
          </div>
        ))}
      </div>
      <button className="row" onClick={() => setOpen((o) => !o)} style={{ marginTop: 12, fontSize: 11.5, fontWeight: 700, color: 'var(--brand)', gap: 4 }}>
        Assumptions & risks <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
      </button>
      {open && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          <b>Assumptions</b>
          <ul style={{ margin: '4px 0 8px', paddingLeft: 18 }}>{d.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
          <b>Risks</b>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{d.risks.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}
    </Shell>
  )
}

/* ---------- get_project_performance ---------- */
export function PerformanceCard({ d }: { d: ProjectPerformance }) {
  const max = Math.max(...d.generation.flatMap((g) => [g.actualMWh, g.forecastMWh])) * 1.05
  const pos = d.forecastDeviationPct >= 0
  return (
    <Shell icon={BarChart3} title={d.projectName} meta={d}>
      <div className="grid-2" style={{ gap: 6, gridTemplateColumns: '1fr 1fr 1fr' }}>
        <Metric label="vs forecast" value={`${pos ? '+' : ''}${d.forecastDeviationPct.toFixed(1)}%`} tone={pos ? 'green' : undefined} />
        <Metric label="Availability" value={`${d.availabilityPct.toFixed(1)}%`} />
        <Metric label="Status" value={d.status === 'normal' ? 'Normal' : d.status === 'outage' ? 'Outage' : 'Below'} />
      </div>
      <div className="row" style={{ alignItems: 'flex-end', gap: 6, height: 92, marginTop: 12 }}>
        {d.generation.map((g, i) => (
          <div key={g.month} className="col" style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <div className="row" style={{ alignItems: 'flex-end', gap: 2, height: 72 }}>
              <motion.span initial={{ height: 0 }} animate={{ height: `${(g.forecastMWh / max) * 72}px` }} transition={{ delay: i * 0.05 }}
                style={{ width: 8, borderRadius: '3px 3px 0 0', background: '#E6E5E0' }} title={`Forecast ${g.forecastMWh} MWh`} />
              <motion.span initial={{ height: 0 }} animate={{ height: `${(g.actualMWh / max) * 72}px` }} transition={{ delay: i * 0.05 + 0.05 }}
                style={{ width: 8, borderRadius: '3px 3px 0 0', background: '#FF6E00' }} title={`Actual ${g.actualMWh} MWh`} />
            </div>
            <span style={{ fontSize: 9.5, color: 'var(--muted)' }}>{g.month}</span>
          </div>
        ))}
      </div>
      <div className="legend" style={{ marginTop: 8 }}>
        <span><i style={{ background: '#FF6E00' }} />Actual MWh</span>
        <span><i style={{ background: '#E6E5E0' }} />Forecast MWh</span>
      </div>
    </Shell>
  )
}

/* ---------- get_environmental_impact ---------- */
export function ImpactCard({ d }: { d: EnvironmentalImpact }) {
  return (
    <Shell icon={Leaf} title="Environmental impact" meta={d}>
      <div className="grid-2" style={{ gap: 6, gridTemplateColumns: '1fr 1fr 1fr' }}>
        <Metric label="Clean energy" value={`${(d.attributableKWh / 1000).toFixed(1)} MWh`} />
        <Metric label="CO₂e avoided" value={`${d.emissionsAvoidedT.toFixed(1)} t`} tone="green" />
        <Metric label="Trees / yr" value={d.treesEquivalent.toLocaleString()} />
      </div>
      <div className="list" style={{ marginTop: 6 }}>
        {d.byProject.map((p) => (
          <div key={p.projectName} className="list-row" style={{ padding: '8px 0', fontSize: 12 }}>
            <TreePine size={14} color="#1F8A5B" />
            <span className="grow" style={{ fontWeight: 600 }}>{p.projectName}</span>
            <span className="num muted">{(p.kWh / 1000).toFixed(1)} MWh · {p.tCO2e.toFixed(1)} t</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 6, lineHeight: 1.45 }}>Method: {d.method}</p>
    </Shell>
  )
}

/* ---------- alerts (shared with the notifications sheet) ---------- */
export const ALERT_META: Record<AlertType, { icon: LucideIcon; label: string }> = {
  contribution_recorded: { icon: BadgeCheck, label: 'Contribution' },
  payout_completed: { icon: HandCoins, label: 'Credit applied' },
  payout_overdue: { icon: CalendarClock, label: 'Credit delayed' },
  low_generation: { icon: AlertTriangle, label: 'Generation' },
  project_outage: { icon: PowerOff, label: 'Outage' },
  funding_milestone: { icon: Flag, label: 'Funding' },
  rewards_milestone: { icon: Star, label: 'Rewards' },
  project_report: { icon: FileText, label: 'Report' },
}
const SEVERITY_CLASS = { info: 'blue', success: 'green', warning: '', critical: 'rose' } as const

export function AlertRow({ a, onClick }: { a: Alert; onClick?: () => void }) {
  const m = ALERT_META[a.type]
  return (
    <button className="list-row" onClick={onClick} style={{ alignItems: 'flex-start', padding: '12px 0' }}>
      <span className={`ic sm ${SEVERITY_CLASS[a.severity]}`} style={{ position: 'relative' }}>
        {createElement(m.icon, { size: 15 })}
        {!a.read && <span style={{ position: 'absolute', top: -1, right: -1, width: 9, height: 9, borderRadius: 5, background: 'var(--brand)', border: '2px solid #fff' }} />}
      </span>
      <div className="grow">
        <div className="row between" style={{ gap: 8 }}>
          <span className="title" style={{ fontSize: 13, fontWeight: a.read ? 600 : 800 }}>{a.title}</span>
          <span style={{ fontSize: 10.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtTime(a.createdAt)}</span>
        </div>
        <div className="desc" style={{ fontSize: 12, lineHeight: 1.45 }}>{a.body}</div>
      </div>
    </button>
  )
}

export function AlertsCard({ d }: { d: Alert[] }) {
  return (
    <Shell icon={Bell} title="Active alerts">
      <div className="list">{d.map((a) => <AlertRow key={a.id} a={a} />)}</div>
    </Shell>
  )
}

export function AttachmentView({ a }: { a: Attachment }) {
  switch (a.kind) {
    case 'portfolio': return <PortfolioCard d={a.data} />
    case 'realized': return <RealizedCard d={a.data} />
    case 'scenarios': return <ScenarioCard d={a.data} />
    case 'performance': return <PerformanceCard d={a.data} />
    case 'impact': return <ImpactCard d={a.data} />
    case 'alerts': return <AlertsCard d={a.data} />
  }
}

/* ---------- tool trace: which approved tools the answer used ---------- */
const TOOL_LABEL: Record<ToolName, string> = {
  get_portfolio_summary: 'Portfolio summary',
  calculate_realized_return: 'Returns received',
  calculate_projected_scenarios: 'Projected scenarios',
  get_project_performance: 'Project performance',
  get_environmental_impact: 'Environmental impact',
  get_active_alerts: 'Active alerts',
}
export function ToolTrace({ calls, live }: { calls: { name: ToolName }[]; live?: boolean }) {
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
      {calls.map((c, i) => (
        <span key={i} className="pill grey" style={{ height: 22, fontSize: 10.5, padding: '0 8px' }}>
          {live ? <Wrench size={11} /> : <Zap size={11} />} {TOOL_LABEL[c.name]}
        </span>
      ))}
    </div>
  )
}
