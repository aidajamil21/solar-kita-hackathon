import { config } from './config.js'
import { all, run, supabase } from './db.js'
import { answer as ruleAnswer, SUGGESTIONS } from './assistant.js'
import { alertsFor, ensureProfile, environmentalImpact, portfolioSummary, projectedScenarios, projectPerformance, realizedReturn } from './services.js'
import { MONTHS_LONG, todayKL } from './utils.js'

/**
 * Solar Analyst on a Groq-hosted LLM (OpenAI-compatible tool calling).
 *
 * The model only sees data through the approved, read-only tools below. Every tool runs for the
 * signed-in resident (the model is never given a user id, so it can't ask about anyone else).
 * The model finishes by calling `reply`, which carries its answer plus the interactive parts:
 * data cards (built from the tool results, never from the model's text), follow-up chips and
 * buttons that open a page in the app.
 *
 * Groq's free tier allows ~8,000 tokens a minute per model, so the prompt, tool schemas and tool
 * results are kept compact. If Groq isn't configured, fails or is rate-limited on both models,
 * the rule-based analyst in assistant.js answers instead.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MAX_STEPS = 4
const DEADLINE_MS = 25_000 // stay inside the 30 s Vercel function limit

/* ---------- project catalogue (public data, cached) ---------- */

const KIND = { subscription: 'solar farm', investment: 'grid array', rooftop: 'rooftop', ev: 'EV charging' }
let directory = { at: 0, sites: [] }
async function projects() {
  if (Date.now() - directory.at < 5 * 60_000 && directory.sites.length) return directory.sites
  const [sites, towns, units] = await Promise.all([
    run(supabase.from('sites').select('id, name, kind, township_id, price_per_unit, return_low_pct, return_high_pct, total_units, status').order('id')),
    run(supabase.from('townships').select('id, name')),
    all(() => supabase.from('subscription_units').select('site_id, unit_index').order('site_id').order('unit_index')),
  ])
  const townName = new Map(towns.map((t) => [t.id, t.name]))
  const taken = new Map()
  for (const u of units) taken.set(u.site_id, (taken.get(u.site_id) ?? 0) + 1)
  directory = { at: Date.now(), sites: sites.map((s) => ({ ...s, township: townName.get(s.township_id) ?? s.township_id, taken: taken.get(s.id) ?? 0 })) }
  return directory.sites
}

/** a project from an id or (part of) its name */
function findProject(sites, raw) {
  const q = String(raw ?? '').trim().toLowerCase()
  if (!q) return null
  return sites.find((s) => s.id === q) ?? sites.find((s) => s.name.toLowerCase() === q)
    ?? sites.find((s) => q.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(q)) ?? null
}

/* ---------- the approved tools ---------- */

const PAGES = {
  explore: { label: 'Explore projects', to: '/explore', icon: 'map' },
  my_solar: { label: 'My solar', to: '/solar', icon: 'sun' },
  credits: { label: 'My credits', to: '/solar', icon: 'coins', section: 'credits' },
  project: { label: 'Open project', to: '/solar/', icon: 'sun' },
  builder_plan: { label: 'Solar Builder Plan', to: '/plan', icon: 'calendar' },
  ev_charging: { label: 'Book EV charging', to: '/charge', icon: 'plug' },
  go_green: { label: 'Go Green', to: '/green', icon: 'leaf' },
  rewards: { label: 'Rewards', to: '/rewards', icon: 'gift' },
}

const fn = (name, description, properties = {}, required = []) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
})
const PROJECT = { type: 'string', description: 'Project id or name' }
const TOOLS = [
  fn('get_user_portfolio', 'Resident’s holdings: contributed, credits received (own money returned + extra earned), credits outstanding (booked, unpaid), next credit estimate.'),
  fn('get_project_performance', 'One project’s metered output vs forecast (6 months), availability, status.', { project_id: PROJECT }, ['project_id']),
  fn('calculate_investment_return', 'What the resident has actually got back: credits received = own money returned + extra earned, annualised rate.'),
  fn('compare_investment_scenarios', 'FORECAST for investing an amount over 1-3 durations: money back and extra earned (conservative/base/optimistic).', {
    amount: { type: 'number', description: 'RM' },
    duration_years: { type: 'array', items: { type: 'number' }, description: '1-3 durations, 1-10 years' },
    project_id: { ...PROJECT, description: 'Optional: use this project’s return range' },
  }, ['amount', 'duration_years']),
  fn('get_environmental_impact', 'Resident’s share of clean energy (12 months), CO₂e avoided, tree equivalent.'),
  fn('get_recent_alerts', 'Resident’s recent notifications, newest first, with unread status.', { unread_only: { type: 'boolean' } }),
  fn('find_projects', 'Search the public project catalogue (price per block, return range, blocks left).', {
    query: { type: 'string', description: 'Township, project name or type (solar farm, grid array, rooftop, EV)' },
  }),
]

/** follow-ups the app offers when the model doesn't suggest any, by the tools it used */
const DEFAULT_SUGGESTIONS = {
  get_user_portfolio: 'How much extra have I earned so far?',
  calculate_investment_return: 'How is my portfolio doing?',
  compare_investment_scenarios: 'Where can I invest near my home?',
  get_project_performance: 'Any alerts I should know about?',
  get_environmental_impact: 'How is my portfolio doing?',
  get_recent_alerts: 'What is my environmental impact?',
}

const round2 = (n) => Math.round(n * 100) / 100
const money = (n) => round2(Number(n))
const day = (iso) => (iso ? String(iso).slice(0, 10) : null)

/** run one approved tool for the signed-in resident: a compact result for the model + the card the app shows */
async function runTool(name, args, ctx) {
  const { userId, sites } = ctx
  switch (name) {
    case 'get_user_portfolio': {
      const [p, r] = await Promise.all([portfolioSummary(userId), realizedReturn(userId)])
      return {
        card: { kind: 'portfolio', data: p },
        result: {
          basis: 'verified', asOf: day(p.asOf),
          contributed: p.totalContributed, creditsReceived: p.totalPayoutsReceived,
          creditsReceivedSplit: { ownMoneyReturned: r.capitalReturned, extraEarned: r.extra, extraPerYearPct: r.annualisedPct },
          outstandingCredits: p.outstandingPayouts,
          nextCredit: p.nextPayout ? { date: day(p.nextPayout.date), estimate: p.nextPayout.estimatedAmount } : null,
          holdings: p.holdings.map((h) => `${h.projectName} [${h.projectId}] · ${h.units} ${h.projectName.startsWith('Solar Builder') ? 'payments' : 'blocks'} · paid RM ${h.contributed} · received RM ${h.payoutsReceived}${h.status === 'active' ? '' : ` · ${h.status}`}`),
        },
      }
    }
    case 'get_project_performance': {
      const site = findProject(sites, args.project_id)
      if (!site) return { result: { error: `No project matches "${args.project_id}". Try find_projects.` } }
      const p = await projectPerformance(site.id)
      return {
        card: { kind: 'performance', data: p },
        args: { project_id: site.id },
        result: {
          basis: 'verified', project: p.projectName, capacityMW: p.capacityMW, status: p.status,
          last30DaysVsForecastPct: p.forecastDeviationPct, last3DaysVsForecastPct: p.recentDeviationPct, availabilityPct: p.availabilityPct,
          monthlyMWh: p.generation.map((g) => `${g.month}: ${g.actualMWh} actual / ${g.forecastMWh} forecast`),
        },
      }
    }
    case 'calculate_investment_return': {
      const r = await realizedReturn(userId)
      const credits = r.cashFlows.filter((c) => c.type === 'payout')
      const first = r.cashFlows.find((c) => c.type === 'contribution')
      const { cashFlows: _flows, ...summary } = r
      return {
        card: { kind: 'realized', data: { ...summary, cashFlows: [] } },
        result: {
          basis: 'verified', contributed: r.contributions, creditsReceived: r.payouts, ownMoneyReturned: r.capitalReturned, extraEarned: r.extra,
          extraPerYearPct: r.annualisedPct, creditsCount: credits.length, firstContribution: day(first?.date), latestCredit: credits.at(-1) ? { date: day(credits.at(-1).date), amount: money(credits.at(-1).amount) } : null,
        },
      }
    }
    case 'compare_investment_scenarios': {
      const amount = Number(args.amount)
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return { result: { error: 'Amount must be a positive number of ringgit.' } }
      const years = [...new Set((Array.isArray(args.duration_years) ? args.duration_years : [args.duration_years]).map(Number))]
        .filter((y) => Number.isFinite(y) && y > 0 && y <= 10).sort((a, b) => a - b).slice(0, 3)
      if (!years.length) return { result: { error: 'Give one to three durations between 1 and 10 years.' } }
      const site = args.project_id ? findProject(sites, args.project_id) : null
      const lo = Number(site?.return_low_pct), hi = Number(site?.return_high_pct)
      const range = lo && hi ? [lo, round2((lo + hi) / 2), hi] : undefined
      const sets = years.map((y) => ({ ...projectedScenarios(amount, y, range), projectName: site?.name }))
      return {
        card: { kind: 'scenarios', data: sets[sets.length - 1], sets },
        args: { amount, duration_years: years, ...(site ? { project_id: site.id } : {}) },
        result: {
          basis: 'FORECAST, not guaranteed', amount, project: site?.name ?? 'any project (2-3% a year)',
          byDuration: sets.map((s) => ({
            years: s.years, moneyBack: s.scenarios[0].moneyBack,
            extraEarned: Object.fromEntries(s.scenarios.map((x) => [`${x.name} ${x.annualReturnPct}%`, x.totalPayouts])),
          })),
          assumptions: sets[0].assumptions, risks: sets[0].risks,
        },
      }
    }
    case 'get_environmental_impact': {
      const i = await environmentalImpact(userId)
      return {
        card: { kind: 'impact', data: i },
        result: {
          basis: 'verified', cleanEnergyKWh: i.attributableKWh, co2eAvoidedTonnes: i.emissionsAvoidedT, treesPerYear: i.treesEquivalent, method: i.method,
          topProjects: [...i.byProject].sort((a, b) => b.kWh - a.kWh).slice(0, 5).map((p) => `${p.projectName}: ${p.kWh} kWh`),
        },
      }
    }
    case 'get_recent_alerts': {
      const all = await alertsFor(userId)
      const unread = all.filter((a) => !a.read)
      const list = args.unread_only ? unread : all
      const rank = { critical: 0, warning: 1, info: 2, success: 3 }
      const show = (unread.length ? [...unread].sort((a, b) => rank[a.severity] - rank[b.severity]) : all).slice(0, 3)
      return {
        card: show.length ? { kind: 'alerts', data: show } : undefined,
        result: { total: all.length, unread: unread.length, alerts: list.slice(0, 6).map((a) => `${day(a.createdAt)} ${a.severity}${a.read ? '' : ' UNREAD'}: ${a.title}. ${a.body}`) },
      }
    }
    case 'find_projects': {
      const q = String(args.query ?? '').toLowerCase().trim()
      const words = q.split(/\s+/).filter((w) => w.length > 2)
      const kindOf = (s) => KIND[s.kind] ?? s.kind
      const matches = q
        ? sites.filter((s) => words.some((w) => `${s.name} ${s.township} ${kindOf(s)} ${s.id}`.toLowerCase().includes(w)))
        : sites
      return {
        result: {
          count: matches.length,
          projects: matches.slice(0, 10).map((s) => `${s.name} [${s.id}] · ${s.township} · ${kindOf(s)} · RM ${Number(s.price_per_unit)}/block · ${Number(s.return_low_pct)}-${Number(s.return_high_pct)}% a year · ${Math.max(0, s.total_units - s.taken)} of ${s.total_units} blocks left`),
        },
      }
    }
    default:
      return { result: { error: `Unknown tool ${name}` } }
  }
}

/* ---------- prompt ---------- */

function systemPrompt({ name, township }) {
  const today = new Date(`${todayKL()}T12:00:00+08:00`)
  return `You are the Solar Investment Analyst for Solar Kita, a community solar investment platform for residents of Sime Darby Property townships in Malaysia. You are talking to ${name || 'a resident'}${township ? ` from ${township}` : ''}. Today is ${today.getUTCDate()} ${MONTHS_LONG[today.getUTCMonth()]} ${today.getUTCFullYear()}.

Your responsibilities:
1. Explain portfolio performance clearly.
2. Use only verified data returned by approved tools.
3. Distinguish actual results from forecasts.
4. Explain assumptions and relevant risks.
5. State when data is missing or outdated.
6. Never claim that a future payout is guaranteed.
7. Never invent investment balances, project output, returns, or environmental impact.
8. Do not provide another resident's private information.
9. Do not make investment transactions or change financial records.
10. Explain financial concepts in accessible language.

When analysing performance, distinguish: contributions made; payouts actually received; outstanding payout obligations; realized returns; projected returns.

How Solar Kita works (general facts, not the resident's data):
- Residents buy blocks of a solar farm, grid array, rooftop or EV charging station. Money comes back as monthly Energy Savings Credits on their TNB bill (on the 28th, from the month after paying): 1/120 of it each month for 10 years, plus the project's return (max 3% a year) on the part not yet returned.
- Solar Builder Plan: fixed monthly payment (RM 50-10,000); each payment comes back the same way plus 3% a year. 1 point per RM 5, +50 at a 6-month streak, +100 every 12.
- Points also from Go Green (1 per 3 km walked / 5 km cycled in the township, max 20 a day), EV charging (RM 1.20/kWh paid after charging; 2 points/kWh 11am-3pm, 0.5 otherwise) and daily check-in (+10).

How to answer:
- Fetch every figure with the tools, even if mentioned before. Use find_projects to look up projects.
- Quote figures exactly as the tools give them. Never calculate your own percentages, returns or totals. Credits received are mostly the resident's own money coming back, not profit; the return is extraEarned / extraPerYearPct.
- Write 2-6 short sentences or "- " bullets for a phone chat, **bold** key figures, RM with 2 decimals. No tables or headings. The app shows a data card for each tool used, so summarise rather than list everything.
- Label forecasts as estimates with the main assumption; never guaranteed. If data is missing or a tool errors, say so.
- Outside Solar Kita topics: say briefly what you can help with.
- Reply in the resident's language (English or Malay).
- End with these two lines (they become tap buttons, the resident doesn't see the tags):
<suggest>2-3 follow-up questions in the resident's voice, under 60 characters, separated by |</suggest>
<actions>0-2 of: ${Object.keys(PAGES).filter((p) => p !== 'project').join(', ')}, project:<project id>; separated by commas</actions>
Only add actions that help the resident act on the answer (e.g. explore to invest, project:<id> for a project they hold).`
}

/* ---------- Groq ---------- */

async function groq(body, model, deadline) {
  const reasoning = /gpt-oss/.test(model) ? { reasoning_effort: 'low', include_reasoning: false } : {}
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.groqApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0.3, max_completion_tokens: 900, ...reasoning, ...body }),
    signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`Groq ${res.status}: ${text.slice(0, 200)}`)
    err.groq = res.status
    throw err
  }
  const json = await res.json()
  if (process.env.ANALYST_DEBUG) console.log(`[analyst] ${model} tokens: ${json.usage?.prompt_tokens} in + ${json.usage?.completion_tokens} out`)
  return json.choices?.[0]?.message
}

const parseArgs = (raw) => { try { return JSON.parse(raw || '{}') ?? {} } catch { return {} } }

/** the tool-calling loop for one model; returns the reply in the app's ChatMessage shape */
async function converse(model, userId, question, history, deadline) {
  const [profile, sites] = await Promise.all([ensureProfile(userId), projects()])
  const township = sites.find((s) => s.township_id === profile.township_id)?.township
  const ctx = { userId, sites }

  const messages = [
    { role: 'system', content: systemPrompt({ name: profile.full_name, township }) },
    ...history.slice(-6).map((m) => ({ role: m.role, content: String(m.content).slice(0, 600) })),
    { role: 'user', content: question },
  ]
  const calls = []
  const cards = []
  let text = null

  for (let step = 0; step < MAX_STEPS && text === null; step++) {
    // the last step must answer with what it has
    const msg = await groq({ messages, tools: TOOLS, tool_choice: step === MAX_STEPS - 1 ? 'none' : 'auto' }, model, deadline)
    if (!msg) throw new Error('Groq returned no message')
    const toolCalls = msg.tool_calls ?? []
    if (!toolCalls.length) { text = msg.content ?? ''; break }

    messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: toolCalls })
    for (const c of toolCalls) {
      const args = parseArgs(c.function?.arguments)
      let out
      try {
        out = await runTool(c.function?.name, args, ctx)
      } catch (err) {
        out = { result: { error: err?.status && err.status < 500 ? err.message : 'The data could not be loaded just now.' } }
        console.error(`analyst tool ${c.function?.name} failed`, err)
      }
      if (out.card || out.args) {
        // record only the arguments the tool declares (the model sometimes adds extras, e.g. user_id)
        const declared = Object.keys(TOOLS.find((t) => t.function.name === c.function.name)?.function.parameters.properties ?? {})
        const kept = out.args ?? Object.fromEntries(Object.entries(args).filter(([k, v]) => declared.includes(k) && v !== null && v !== undefined))
        calls.push({ name: c.function.name, args: Object.keys(kept).length ? kept : undefined })
      }
      if (out.card) cards.push(out.card)
      messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(out.result) })
    }
  }

  return shape(text, { calls, cards, sites })
}

/** turn the model's text into the message the app renders: text, data cards, buttons, follow-ups */
function shape(raw, { calls, cards, sites }) {
  let text = String(raw ?? '').replace(/\r\n/g, '\n')
  const tag = (name) => {
    const m = text.match(new RegExp(`<${name}>([\\s\\S]*?)(?:</${name}>|$)`, 'i'))
    if (m) text = text.replace(m[0], '')
    return m?.[1].trim() ?? ''
  }
  const suggestTag = tag('suggest')
  const actionsTag = tag('actions')
  const message = text.replace(/<\/?(suggest|actions)>/gi, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 4000)
  if (!message) throw new Error('empty reply')

  // cards come from the tool results, never from the model's text; one per kind, latest wins
  const byKind = new Map()
  for (const c of cards) byKind.set(c.kind, c)
  const attachments = [...byKind.values()].map((c) => (c.sets?.length > 1 ? { kind: c.kind, data: c.data, sets: c.sets } : { kind: c.kind, data: c.data }))

  // page buttons: only known pages and real projects
  const links = []
  for (const raw of actionsTag.split(/[,;\n]/).map((a) => a.trim().toLowerCase()).filter(Boolean).slice(0, 2)) {
    const [page, id] = raw.split(':').map((x) => x.trim())
    if (page === 'project') {
      const site = findProject(sites, id)
      if (site) links.push({ label: site.name, to: `/solar/${site.id}`, icon: site.kind === 'ev' ? 'plug' : 'sun', siteId: site.id })
    } else if (PAGES[page] && page !== 'project') {
      const p = PAGES[page]
      links.push({ label: p.label, to: p.to, icon: p.icon, ...(p.section ? { section: p.section } : {}) })
    }
  }
  const unique = links.filter((l, i) => links.findIndex((x) => x.to === l.to && x.section === l.section) === i)
  if (unique.length) attachments.push({ kind: 'links', data: unique })

  let suggestions = suggestTag.split('|').map((s) => s.replace(/^[-*\d.\s"]+|"$/g, '').trim()).filter((s) => s && s.length <= 90).slice(0, 3)
  if (!suggestions.length) suggestions = [...new Set(calls.map((c) => DEFAULT_SUGGESTIONS[c.name]).filter(Boolean))].slice(0, 2)
  if (!suggestions.length) suggestions = SUGGESTIONS.slice(0, 3)

  return {
    content: message,
    toolCalls: calls.length ? calls : undefined,
    attachments: attachments.length ? attachments : undefined,
    suggestions: suggestions.length ? suggestions : undefined,
  }
}

/** answer a resident's question: Groq LLM with the approved tools, or the rule-based analyst */
export async function analyst(userId, question, history = []) {
  if (!config.groqApiKey) return ruleAnswer(userId, question)
  const deadline = Date.now() + DEADLINE_MS
  const models = [config.groqModel, config.groqFallbackModel].filter((m, i, list) => m && list.indexOf(m) === i)
  for (const model of models) {
    try {
      return await converse(model, userId, question, history, deadline)
    } catch (err) {
      if (!err?.groq && err?.status === 401) throw err // signed-out resident, not a Groq problem
      console.error(`Solar Analyst (${model}) failed, ${model === models.at(-1) ? 'using the rule-based analyst' : 'trying the fallback model'}:`, err?.message ?? err)
      if (Date.now() > deadline - 3000) break
    }
  }
  return ruleAnswer(userId, question)
}
