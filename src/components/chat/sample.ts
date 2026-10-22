/**
 * Static sample content that shows every chat card and alert type until the backend is
 * connected. Shapes follow src/api/types.ts, so swapping in live responses needs no UI change.
 */
import type { Alert, ChatMessage } from '../../api/types'

const t = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString()

export const SUGGESTIONS = [
  'How is my portfolio doing?',
  'How much credit have I received so far?',
  'Compare RM 1,000 over 3 vs 5 years',
  'How is Elmina Sunfield performing?',
  'What is my environmental impact?',
  'Any alerts I should know about?',
]

export const SAMPLE_ALERTS: Alert[] = [
  { id: 'al1', type: 'low_generation', severity: 'warning', detection: 'scheduled_check', createdAt: t(90), read: false, projectId: 'serenia-subscription',
    title: 'Low solar generation', body: 'Serenia Sunrise Farm has been 12% below forecast for 3 days due to heavy cloud cover.' },
  { id: 'al2', type: 'payout_completed', severity: 'success', detection: 'database_event', createdAt: t(60 * 26), read: false,
    title: 'Energy Savings Credit applied', body: 'Your September credit of RM 88.48 was applied to your TNB bill (account ••4821).' },
  { id: 'al3', type: 'funding_milestone', severity: 'info', detection: 'scheduled_check', createdAt: t(60 * 50), read: false, projectId: 'elmina-investment',
    title: 'Funding milestone', body: 'Elmina Grid Array is 80% funded. Subscriptions close in 14 days.' },
  { id: 'al4', type: 'project_report', severity: 'info', detection: 'database_event', createdAt: t(60 * 74), read: true, projectId: 'elmina-subscription',
    title: 'New project report', body: 'The September generation report for Elmina Sunfield is now available.' },
  { id: 'al5', type: 'rewards_milestone', severity: 'success', detection: 'database_event', createdAt: t(60 * 120), read: true,
    title: 'Rewards milestone', body: 'You reached 1,250 points and unlocked Level 2 · Solar Supporter.' },
  { id: 'al6', type: 'contribution_recorded', severity: 'success', detection: 'database_event', createdAt: t(60 * 220), read: true, projectId: 'elmina-rooftop',
    title: 'Contribution recorded', body: 'Your RM 8,000 contribution to Elmina West Homes has been verified.' },
  { id: 'al7', type: 'payout_overdue', severity: 'critical', detection: 'scheduled_check', createdAt: t(60 * 400), read: true,
    title: 'Credit delayed (resolved)', body: 'The July credit for Elmina West Homes was 2 days late and has since been applied.' },
  { id: 'al8', type: 'project_outage', severity: 'critical', detection: 'monitoring_rule', createdAt: t(60 * 700), read: true, projectId: 'elmina-ev',
    title: 'Project outage (resolved)', body: 'Elmina Hub Chargers were offline for 4 hours for inverter maintenance.' },
]

const asOf = t(5)

export const SAMPLE_CONVERSATION: ChatMessage[] = [
  { id: 's1', role: 'user', createdAt: t(12), content: 'How is my portfolio doing?' },
  {
    id: 's2', role: 'assistant', createdAt: t(12),
    toolCalls: [{ name: 'get_portfolio_summary' }, { name: 'calculate_realized_return' }],
    content: 'Here’s your portfolio based on **verified ledger data**:\n\n- You’ve **contributed RM 9,000** across 2 projects.\n- You’ve **received RM 2,752.23 in Energy Savings Credits** on your TNB bill so far.\n- **RM 87.63** is booked but not yet paid.\n\nOf what’s come back, **RM 2,266.66 is your own money returned** and **RM 485.57 is extra** earned since January 2024 (about 2.5% a year on the money still out). The rest of what you paid keeps coming back monthly over 10 years. Your next credit is estimated at RM 87.63 on 28 October. That figure is an estimate, not a guarantee.',
    attachments: [
      { kind: 'portfolio', data: {
        basis: 'verified', asOf, source: 'Credit ledger', totalContributed: 9000, totalPayoutsReceived: 2752.23, outstandingPayouts: 87.63,
        nextPayout: { date: new Date(new Date().getFullYear(), new Date().getMonth(), 28).toISOString(), estimatedAmount: 87.63 },
        holdings: [
          { projectId: 'elmina-subscription', projectName: 'Elmina Sunfield', kind: 'subscription', township: 'City of Elmina', units: 4, contributed: 1000, payoutsReceived: 323.49, status: 'active' },
          { projectId: 'elmina-rooftop', projectName: 'Elmina West Homes', kind: 'rooftop', township: 'City of Elmina', units: 2, contributed: 8000, payoutsReceived: 2428.74, status: 'active' },
        ],
      } },
    ],
    suggestions: ['How much credit have I received so far?', 'Compare RM 1,000 over 3 vs 5 years'],
  },
  { id: 's3', role: 'user', createdAt: t(10), content: 'Compare RM 1,000 over 3 vs 5 years' },
  {
    id: 's4', role: 'assistant', createdAt: t(10),
    toolCalls: [{ name: 'calculate_projected_scenarios', args: { amount: 1000, years: 5 } }],
    content: 'These are **projections, not actual results**. Your RM 1,000 comes back to you over 10 years. Over 5 years, **RM 500 of it is back** and you’d earn roughly **RM 75 to RM 113 extra**, depending on sunshine and tariffs. Over 3 years: RM 300 back plus about RM 51 to RM 77 extra.\n\nThe assumptions and main risks are listed below. No future payout is guaranteed.',
    attachments: [
      { kind: 'scenarios', data: {
        basis: 'forecast', asOf, source: 'Scenario model', amount: 1000, years: 5,
        scenarios: [
          { name: 'Conservative', annualReturnPct: 2, totalPayouts: 75.42, endValue: 1075.42, moneyBack: 500 },
          { name: 'Base', annualReturnPct: 2.5, totalPayouts: 94.27, endValue: 1094.27, moneyBack: 500 },
          { name: 'Optimistic', annualReturnPct: 3, totalPayouts: 113.13, endValue: 1113.13, moneyBack: 500 },
        ],
        assumptions: ['Your money comes back in equal monthly parts over 10 years.', 'The return is earned on the part not yet returned.', 'Output follows the long-run Klang Valley sunshine pattern.'],
        risks: ['Cloudy months or outages reduce the return.', 'Tariff or regulatory changes.', 'Returns are estimates and not guaranteed.'],
      } },
    ],
  },
  { id: 's5', role: 'user', createdAt: t(8), content: 'How is Elmina Sunfield performing?' },
  {
    id: 's6', role: 'assistant', createdAt: t(8),
    toolCalls: [{ name: 'get_project_performance', args: { project_id: 'elmina-subscription' } }],
    content: 'Elmina Sunfield is running **normally**. Last month it generated **2.4% above forecast**, with 98.6% availability. Generation in July and August dipped slightly below forecast during the haze season.',
    attachments: [
      { kind: 'performance', data: {
        basis: 'verified', asOf, source: 'Inverter telemetry (OpenEMS)', projectId: 'elmina-subscription', projectName: 'Elmina Sunfield', capacityMW: 5,
        generation: [
          { month: 'Apr', actualMWh: 668, forecastMWh: 668 }, { month: 'May', actualMWh: 641, forecastMWh: 630 },
          { month: 'Jun', actualMWh: 602, forecastMWh: 611 }, { month: 'Jul', actualMWh: 611, forecastMWh: 636 },
          { month: 'Aug', actualMWh: 598, forecastMWh: 624 }, { month: 'Sep', actualMWh: 614, forecastMWh: 599 },
        ],
        forecastDeviationPct: 2.4, availabilityPct: 98.6, revenueMonth: 245600, operatingCostMonth: 9000, status: 'normal',
      } },
    ],
  },
  { id: 's7', role: 'user', createdAt: t(6), content: 'What is my environmental impact?' },
  {
    id: 's8', role: 'assistant', createdAt: t(6),
    toolCalls: [{ name: 'get_environmental_impact' }],
    content: 'Your share of the projects’ **metered output** is about **19,330 kWh** of renewable electricity. That avoided an estimated **11.3 tCO₂e**, roughly what 514 trees absorb in a year.',
    attachments: [
      { kind: 'impact', data: {
        basis: 'verified', asOf, source: 'Metered generation', attributableKWh: 19330, emissionsAvoidedT: 11.3, treesEquivalent: 514,
        method: 'Your share of each project’s metered output × grid factor 0.585 kgCO₂e/kWh.',
        byProject: [{ projectName: 'Elmina Sunfield', kWh: 5640, tCO2e: 3.3 }, { projectName: 'Elmina West Homes', kWh: 13690, tCO2e: 8.0 }],
      } },
    ],
  },
  { id: 's9', role: 'user', createdAt: t(4), content: 'Any alerts I should know about?' },
  {
    id: 's10', role: 'assistant', createdAt: t(4),
    toolCalls: [{ name: 'get_active_alerts' }],
    content: 'You have **3 new alerts**. The one to watch is **low generation at Serenia Sunrise Farm**, caused by cloud cover. It may slightly reduce this month’s credits there.',
    attachments: [{ kind: 'alerts', data: SAMPLE_ALERTS.slice(0, 3) }],
    suggestions: ['How is my portfolio doing?', 'What is my environmental impact?'],
  },
]
