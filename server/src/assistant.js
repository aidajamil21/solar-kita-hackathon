import { run, supabase } from './db.js'
import { alertsFor, environmentalImpact, holdingsOf, portfolioSummary, projectedScenarios, projectPerformance, realizedReturn } from './services.js'
import { MONTHS_LONG, rm } from './utils.js'

/**
 * Solar Analyst: a rule-based router over the same "tools" the AI design uses.
 * It reads only verified data for the asking resident, keeps forecasts labelled as such,
 * and replies in the app's ChatMessage shape (content + toolCalls + attachments + suggestions).
 */

export const SUGGESTIONS = [
  'How is my portfolio doing?',
  'How much credit have I received so far?',
  'Compare RM 1,000 over 3 vs 5 years',
  'How is Elmina Sunfield performing?',
  'What is my environmental impact?',
  'Any alerts I should know about?',
]

const pct = (n, dp = 1) => `${Number(n).toFixed(dp)}%`
const fmtDate = (iso) => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]}` }
const pick = (list, n = 2) => list.slice(0, n)

/** a site the question names: full name, id, or "<township> <kind word>" */
async function findSite(text) {
  const sites = await run(supabase.from('sites').select('id, name, kind, township_id'))
  const t = text.toLowerCase()
  const byName = sites.filter((s) => t.includes(s.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0]
  if (byName) return byName
  const byId = sites.find((s) => t.includes(s.id))
  if (byId) return byId
  const kindWords = { subscription: /farm|subscription|park|sunfield|meadow/, investment: /array|investment|grid/, rooftop: /roof|homes?/, ev: /ev|charg/ }
  return sites.find((s) => t.includes(s.township_id.replace(/-/g, ' ')) && kindWords[s.kind].test(t)) ?? null
}

function intentOf(t) {
  if (/\b(alert|alerts|notification|warning|issue|problem|outage)\b/.test(t)) return 'alerts'
  if (/impact|co2|co₂|carbon|environment|tree|emission/.test(t)) return 'impact'
  if (/compare|projection|project(ed)?\b.*\b(rm|year)|scenario|what if|could i|would i|\bif i (put|invest)|over \d+ years?/.test(t)) return 'scenarios'
  if (/perform|generat|output|producing|how is .*(farm|array|sunfield|meadow|park|homes|roof|charger|hub)/.test(t)) return 'performance'
  if (/credit|received|payout|paid|earned|return|bill|money back/.test(t)) return 'realized'
  if (/portfolio|doing|holding|summary|overview|my (solar|projects|investments?)|invested|contribut/.test(t)) return 'portfolio'
  if (/^(hi|hello|hey|salam|good (morning|afternoon|evening))\b/.test(t)) return 'hello'
  return 'unknown'
}

function parseScenario(t) {
  const money = t.match(/rm\s?([\d,]+(?:\.\d+)?)\s*(k)?/) ?? t.match(/\b([\d,]{3,})(?:\s*ringgit)?\b/)
  let amount = money ? Number(money[1].replace(/,/g, '')) * (money[2] ? 1000 : 1) : 1000
  if (!Number.isFinite(amount) || amount <= 0) amount = 1000
  const pair = t.match(/(\d+)\s*(?:vs\.?|versus|or|and|,|to)\s*(\d+)\s*(?:years?|yrs?)/)
  const single = [...t.matchAll(/(\d+)\s*(?:years?|yrs?)/g)].map((m) => Number(m[1]))
  const years = (pair ? [Number(pair[1]), Number(pair[2])] : single.length ? single : [5]).filter((y) => y > 0 && y <= 30)
  return { amount, years: years.length ? [...new Set(years)].sort((a, b) => a - b) : [5] }
}

export async function answer(userId, question) {
  const t = question.toLowerCase().trim()
  const intent = intentOf(t)

  if (intent === 'portfolio') {
    const [p, r] = await Promise.all([portfolioSummary(userId), realizedReturn(userId)])
    if (!p.holdings.length) {
      return { content: 'You don’t hold any solar projects yet. Open **Explore** to pick panel rows, rooftops or charger bays in your township.', suggestions: ['Compare RM 1,000 over 3 vs 5 years'] }
    }
    const first = r.cashFlows[0] ? new Date(r.cashFlows[0].date) : null
    const lines = [
      `- You’ve **contributed ${rm(p.totalContributed, 0)}** across ${p.holdings.length} project${p.holdings.length > 1 ? 's' : ''}.`,
      `- You’ve **received ${rm(p.totalPayoutsReceived)} in Energy Savings Credits** on your TNB bill so far.`,
      p.outstandingPayouts > 0 ? `- **${rm(p.outstandingPayouts)}** is booked but not yet paid.` : '- There are **no credits on the way** right now.',
    ]
    let content = `Here’s your portfolio based on **verified ledger data**:\n\n${lines.join('\n')}\n\nThat means you’ve **earned back ${pct(r.realizedReturnPct)}**${first ? ` since ${MONTHS_LONG[first.getUTCMonth()]} ${first.getUTCFullYear()}` : ''} (about ${pct(r.annualisedPct)} a year).`
    if (p.nextPayout) content += ` Your next credit is estimated at ${rm(p.nextPayout.estimatedAmount)} on ${fmtDate(p.nextPayout.date)}. That figure is an estimate, not a guarantee.`
    return {
      content,
      toolCalls: [{ name: 'get_portfolio_summary' }, { name: 'calculate_realized_return' }],
      attachments: [{ kind: 'portfolio', data: p }],
      suggestions: ['How much credit have I received so far?', 'Compare RM 1,000 over 3 vs 5 years'],
    }
  }

  if (intent === 'realized') {
    const r = await realizedReturn(userId)
    if (!r.contributions) {
      return { content: 'There are no completed contributions on your account yet, so there are no credits to report.', toolCalls: [{ name: 'calculate_realized_return' }], suggestions: pick(SUGGESTIONS, 2) }
    }
    const credits = r.cashFlows.filter((c) => c.type === 'payout')
    const last = credits[credits.length - 1]
    return {
      content: `You’ve received **${rm(r.payouts)}** in Energy Savings Credits against **${rm(r.contributions, 0)}** contributed: a **${pct(r.realizedReturnPct)} realised return** so far, or about **${pct(r.annualisedPct)} a year**.\n\nThese are recorded amounts from the credit ledger (${credits.length} credits${last ? `, the latest on ${fmtDate(last.date)}` : ''}), not projections.`,
      toolCalls: [{ name: 'calculate_realized_return' }],
      attachments: [{ kind: 'realized', data: r }],
      suggestions: ['Compare RM 1,000 over 3 vs 5 years', 'How is my portfolio doing?'],
    }
  }

  if (intent === 'scenarios') {
    const { amount, years } = parseScenario(t)
    const site = await findSite(t)
    const range = site
      ? await run(supabase.from('sites').select('return_low_pct, return_high_pct').eq('id', site.id).limit(1)).then(([s]) => {
          const lo = Number(s.return_low_pct), hi = Number(s.return_high_pct)
          return lo && hi ? [lo, (lo + hi) / 2, hi] : undefined
        })
      : undefined
    const sets = years.map((y) => projectedScenarios(amount, y, range))
    const main = sets[sets.length - 1]
    const span = (s) => `${rm(s.scenarios[0].totalPayouts, 0)} to ${rm(s.scenarios[2].totalPayouts, 0)}`
    let content = `These are **projections, not actual results**. Over ${main.years} years, ${rm(amount, 0)}${site ? ` in ${site.name}` : ''} could return roughly **${span(main)}** in total Energy Savings Credits, depending on sunshine and tariffs.`
    if (sets.length > 1) content += ` Over ${sets.slice(0, -1).map((s) => `${s.years} years, that range is about ${span(s)}`).join('; ')}.`
    content += '\n\nThe assumptions and main risks are listed below. No future payout is guaranteed.'
    return {
      content,
      toolCalls: [{ name: 'calculate_projected_scenarios', args: { amount, years: main.years } }],
      attachments: [{ kind: 'scenarios', data: main }],
      suggestions: ['How much credit have I received so far?', 'How is my portfolio doing?'],
    }
  }

  if (intent === 'performance') {
    let site = await findSite(t)
    if (!site) {
      const mine = await holdingsOf(userId)
      if (mine[0]) site = { id: mine[0].site_id }
    }
    if (!site) return { content: 'Which project should I check? Name it, for example “How is Elmina Sunfield performing?”', suggestions: ['How is Elmina Sunfield performing?'] }
    const p = await projectPerformance(site.id)
    const dev = p.forecastDeviationPct
    const status = p.status === 'normal' ? 'running **normally**' : p.status === 'outage' ? 'having an **outage**' : '**below forecast**'
    let content = `${p.projectName} is ${status}. Over the last 30 days it generated **${pct(Math.abs(dev))} ${dev >= 0 ? 'above' : 'below'} forecast**, with ${pct(p.availabilityPct)} availability.`
    if (p.status !== 'normal') content += ` The last 3 days ran ${pct(Math.abs(p.recentDeviationPct))} under forecast, which may slightly reduce this month’s credits.`
    const low = p.generation.filter((g) => g.actualMWh < g.forecastMWh * 0.97).map((g) => g.month)
    if (low.length && low.length < p.generation.length) content += ` ${low.join(' and ')} came in slightly below forecast.`
    return {
      content,
      toolCalls: [{ name: 'get_project_performance', args: { project_id: p.projectId } }],
      attachments: [{ kind: 'performance', data: p }],
      suggestions: ['What is my environmental impact?', 'Any alerts I should know about?'],
    }
  }

  if (intent === 'impact') {
    const i = await environmentalImpact(userId)
    if (!i.byProject.length) return { content: 'You don’t hold any projects yet, so there’s no attributable output to report.', toolCalls: [{ name: 'get_environmental_impact' }], suggestions: pick(SUGGESTIONS, 2) }
    return {
      content: `Your share of the projects’ **metered output** over the last 12 months is about **${i.attributableKWh.toLocaleString('en-MY')} kWh** of renewable electricity. That avoided an estimated **${i.emissionsAvoidedT} tCO₂e**, roughly what ${i.treesEquivalent.toLocaleString('en-MY')} trees absorb in a year.`,
      toolCalls: [{ name: 'get_environmental_impact' }],
      attachments: [{ kind: 'impact', data: i }],
      suggestions: ['Any alerts I should know about?', 'How is my portfolio doing?'],
    }
  }

  if (intent === 'alerts') {
    const alerts = await alertsFor(userId)
    const unread = alerts.filter((a) => !a.read)
    const rank = { critical: 0, warning: 1, info: 2, success: 3 }
    const top = [...unread].sort((a, b) => rank[a.severity] - rank[b.severity])[0]
    const content = !alerts.length
      ? 'You have no alerts. Everything looks quiet.'
      : !unread.length
        ? 'You’re all caught up: **no new alerts**. Your most recent ones are below.'
        : `You have **${unread.length} new alert${unread.length > 1 ? 's' : ''}**. ${top.severity === 'warning' || top.severity === 'critical' ? `The one to watch is **${top.title.toLowerCase()}**: ${top.body}` : `The latest: **${top.title}**. ${top.body}`}`
    return {
      content,
      toolCalls: [{ name: 'get_active_alerts' }],
      attachments: alerts.length ? [{ kind: 'alerts', data: pick(unread.length ? unread : alerts, 3) }] : undefined,
      suggestions: ['How is my portfolio doing?', 'What is my environmental impact?'],
    }
  }

  if (intent === 'hello') {
    return { content: 'Hi! I can check your **portfolio**, **Energy Savings Credits**, **projections**, **project performance**, **environmental impact** and **alerts**, all from verified Solar Kita data. What would you like to know?', suggestions: pick(SUGGESTIONS, 3) }
  }

  return {
    content: 'I can only answer from verified Solar Kita data: your **portfolio**, **Energy Savings Credits**, **projections**, **project performance**, **environmental impact** and **alerts**. I can’t move money or change your records.\n\nTry one of these:',
    suggestions: pick(SUGGESTIONS, 3),
  }
}
