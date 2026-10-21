import { Router } from 'express'
import { query } from './db.js'
import { clamp, nowMeta, toMonthLabel } from './utils.js'

const router = Router()

router.post('/demo/seed', async (req, res, next) => {
  try {
    const userId = req.userId
    const requestedConversationId = String(req.body?.conversationId ?? '').trim()

    const sitesResult = await query('select id from public.sites order by created_at asc limit 3')
    const sites = sitesResult.rows.map((r) => r.id)
    const [siteA, siteB, siteC] = [sites[0] ?? null, sites[1] ?? sites[0] ?? null, sites[2] ?? sites[0] ?? null]

    await query(
      `
      insert into public.profiles (id, full_name)
      values ($1, 'Demo Resident')
      on conflict (id) do nothing
      `,
      [userId],
    )

    await query(
      `
      insert into public.notification_preferences (user_id)
      values ($1)
      on conflict (user_id) do nothing
      `,
      [userId],
    )

    const beforeAlerts = await query('select count(*)::int as c from public.alerts where user_id = $1', [userId])
    if (Number(beforeAlerts.rows[0]?.c ?? 0) === 0) {
      const now = new Date()
      const mk = (minsAgo) => new Date(now.getTime() - minsAgo * 60_000).toISOString()
      const rows = [
        ['low_generation', 'warning', 'Low solar generation', 'Simulated alert: generation is below forecast this week.', siteB, 'scheduled_check', mk(90)],
        ['payout_completed', 'success', 'Energy Savings Credit applied', 'Simulated alert: RM40 credit has been applied.', siteA, 'database_event', mk(1600)],
        ['funding_milestone', 'info', 'Funding milestone', 'Simulated alert: project reached 80% funded.', siteA, 'scheduled_check', mk(3000)],
        ['project_report', 'info', 'New project report', 'Simulated alert: a new monthly report is available.', siteC, 'database_event', mk(4200)],
      ]

      for (const r of rows) {
        await query(
          `
          insert into public.alerts (user_id, type, severity, title, body, site_id, detection, created_at)
          values ($1, $2::public.alert_type, $3::public.alert_severity, $4, $5, $6, $7::public.detection_type, $8)
          `,
          [userId, r[0], r[1], r[2], r[3], r[4], r[5], r[6]],
        )
      }
    }

    let conversationId = requestedConversationId
    if (conversationId) {
      await query(
        `
        insert into public.conversations (id, user_id, title)
        values ($1::uuid, $2, 'Demo Chat')
        on conflict (id) do nothing
        `,
        [conversationId, userId],
      )
    } else {
      const existing = await query(
        `
        select id
        from public.conversations
        where user_id = $1
        order by created_at asc
        limit 1
        `,
        [userId],
      )
      if (existing.rows[0]) {
        conversationId = existing.rows[0].id
      } else {
        const insertedConversation = await query(
          `
          insert into public.conversations (user_id, title)
          values ($1, 'Demo Chat')
          returning id
          `,
          [userId],
        )
        conversationId = insertedConversation.rows[0].id
      }
    }

    const msgCount = await query(
      'select count(*)::int as c from public.messages where conversation_id = $1::uuid',
      [conversationId],
    )

    if (Number(msgCount.rows[0]?.c ?? 0) === 0) {
      await query(
        `
        insert into public.messages (conversation_id, role, content, created_at)
        values
          ($1::uuid, 'user', 'How is my portfolio doing?', now() - interval '12 minutes'),
          ($1::uuid, 'assistant', 'I can now read your backend data. Try asking about alerts, returns, or project performance.', now() - interval '11 minutes')
        `,
        [conversationId],
      )
    }

    const afterAlerts = await query('select count(*)::int as c from public.alerts where user_id = $1', [userId])
    const afterMessages = await query('select count(*)::int as c from public.messages where conversation_id = $1::uuid', [conversationId])

    res.json({
      conversationId,
      alerts: Number(afterAlerts.rows[0]?.c ?? 0),
      messages: Number(afterMessages.rows[0]?.c ?? 0),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/health', async (_req, res, next) => {
  try {
    await query('select 1 as ok')
    res.json({ ok: true, at: new Date().toISOString() })
  } catch (err) {
    next(err)
  }
})

router.get('/portfolio/summary', async (req, res, next) => {
  try {
    const userId = req.userId

    const holdingsResult = await query(
      `
      select
        s.id as subscription_id,
        s.site_id as project_id,
        si.name as project_name,
        si.kind,
        t.name as township,
        s.status,
        count(su.unit_index)::int as units,
        (count(su.unit_index) * si.price_per_unit)::numeric as contributed
      from public.subscriptions s
      join public.sites si on si.id = s.site_id
      join public.townships t on t.id = si.township_id
      left join public.subscription_units su on su.subscription_id = s.id
      where s.user_id = $1
      group by s.id, s.site_id, si.name, si.kind, t.name, s.status, si.price_per_unit
      order by s.created_at desc
      `,
      [userId],
    )

    const payoutsBySub = await query(
      `
      select subscription_id, coalesce(sum(amount), 0)::numeric as paid
      from public.payouts
      where user_id = $1 and status = 'completed'
      group by subscription_id
      `,
      [userId],
    )

    const paidMap = new Map(payoutsBySub.rows.map((r) => [r.subscription_id, Number(r.paid)]))

    const totals = await query(
      `
      select
        coalesce(sum(case when status = 'completed' then amount else 0 end), 0)::numeric as total_payouts_received,
        coalesce(sum(case when status in ('pending','processing') then amount else 0 end), 0)::numeric as outstanding_payouts
      from public.payouts
      where user_id = $1
      `,
      [userId],
    )

    const totalContributed = holdingsResult.rows.reduce((acc, h) => acc + Number(h.contributed ?? 0), 0)
    const totalPayoutsReceived = Number(totals.rows[0]?.total_payouts_received ?? 0)
    const outstandingPayouts = Number(totals.rows[0]?.outstanding_payouts ?? 0)

    const nextPayoutRow = await query(
      `
      select due_at, amount
      from public.payouts
      where user_id = $1 and status in ('pending','processing') and due_at is not null
      order by due_at asc
      limit 1
      `,
      [userId],
    )

    const nextPayout = nextPayoutRow.rows[0]
      ? {
          date: new Date(nextPayoutRow.rows[0].due_at).toISOString(),
          estimatedAmount: Number(nextPayoutRow.rows[0].amount),
        }
      : null

    const holdings = holdingsResult.rows.map((h) => ({
      projectId: h.project_id,
      projectName: h.project_name,
      kind: h.kind,
      township: h.township,
      units: Number(h.units ?? 0),
      contributed: Number(h.contributed ?? 0),
      payoutsReceived: paidMap.get(h.subscription_id) ?? 0,
      status: h.status === 'cancelled' ? 'closed' : h.status,
    }))

    res.json({
      ...nowMeta('verified', 'Supabase subscriptions + payouts'),
      totalContributed,
      totalPayoutsReceived,
      outstandingPayouts,
      nextPayout,
      holdings,
    })
  } catch (err) {
    next(err)
  }
})

router.get('/returns/realized', async (req, res, next) => {
  try {
    const userId = req.userId

    const contributions = await query(
      `
      select contributed_at as at, amount, site_id as project_id
      from public.contributions
      where user_id = $1 and status = 'completed'
      `,
      [userId],
    )

    const payouts = await query(
      `
      select coalesce(paid_at, created_at) as at, amount, site_id as project_id
      from public.payouts
      where user_id = $1 and status = 'completed'
      `,
      [userId],
    )

    const contributionSum = contributions.rows.reduce((acc, r) => acc + Number(r.amount), 0)
    const payoutSum = payouts.rows.reduce((acc, r) => acc + Number(r.amount), 0)
    const fees = 0

    const cashFlows = [
      ...contributions.rows.map((r) => ({
        date: new Date(r.at).toISOString(),
        type: 'contribution',
        amount: Number(r.amount),
        projectId: r.project_id,
      })),
      ...payouts.rows.map((r) => ({
        date: new Date(r.at).toISOString(),
        type: 'payout',
        amount: Number(r.amount),
        projectId: r.project_id,
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const realizedReturnPct = contributionSum > 0 ? ((payoutSum - fees) / contributionSum) * 100 : 0

    const firstDate = cashFlows[0] ? new Date(cashFlows[0].date).getTime() : Date.now()
    const years = Math.max((Date.now() - firstDate) / (1000 * 60 * 60 * 24 * 365.25), 1 / 12)
    const annualisedPct = contributionSum > 0 ? (Math.pow(1 + (payoutSum - fees) / contributionSum, 1 / years) - 1) * 100 : 0

    res.json({
      ...nowMeta('verified', 'Supabase contributions + payouts'),
      contributions: contributionSum,
      payouts: payoutSum,
      fees,
      realizedReturnPct,
      annualisedPct,
      cashFlows,
    })
  } catch (err) {
    next(err)
  }
})

router.post('/scenarios/projected', async (req, res, next) => {
  try {
    const amount = Number(req.body?.amount)
    const years = Number(req.body?.years)

    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(years) || years <= 0) {
      return res.status(400).json({ error: 'Invalid amount or years' })
    }

    const model = [
      { name: 'Conservative', annualReturnPct: 3.5 },
      { name: 'Base', annualReturnPct: 5.0 },
      { name: 'Optimistic', annualReturnPct: 6.5 },
    ]

    const scenarios = model.map((m) => {
      const totalPayouts = amount * (m.annualReturnPct / 100) * years
      return {
        name: m.name,
        annualReturnPct: m.annualReturnPct,
        totalPayouts: Number(totalPayouts.toFixed(2)),
        endValue: Number((amount + totalPayouts).toFixed(2)),
      }
    })

    res.json({
      ...nowMeta('forecast', 'Scenario model v1'),
      amount,
      years,
      scenarios,
      assumptions: [
        'Returns are modeled as simple annual percentage over contribution amount.',
        'No compounding assumption is applied.',
        'Project uptime and tariff movement can vary actual outcomes.',
      ],
      risks: [
        'Weather variability can reduce generation and payouts.',
        'Operational downtime can affect payout schedules.',
        'Policy or tariff changes can impact realized returns.',
      ],
    })
  } catch (err) {
    next(err)
  }
})

router.get('/projects/:projectId/performance', async (req, res, next) => {
  try {
    const projectId = req.params.projectId

    const siteRes = await query(
      `
      select id, name, capacity_mw
      from public.sites
      where id = $1
      limit 1
      `,
      [projectId],
    )

    if (!siteRes.rows[0]) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const site = siteRes.rows[0]

    const generationRes = await query(
      `
      with monthly as (
        select
          date_trunc('month', measured_at) as month,
          sum(generation_kwh) / 1000.0 as actual_mwh,
          sum(coalesce(expected_kwh, generation_kwh)) / 1000.0 as forecast_mwh
        from public.solar_readings
        where site_id = $1
        group by 1
      )
      select month, actual_mwh, forecast_mwh
      from monthly
      order by month desc
      limit 6
      `,
      [projectId],
    )

    const points = generationRes.rows
      .slice()
      .reverse()
      .map((r) => ({
        month: toMonthLabel(r.month),
        actualMWh: Number(Number(r.actual_mwh ?? 0).toFixed(3)),
        forecastMWh: Number(Number(r.forecast_mwh ?? 0).toFixed(3)),
      }))

    const latest = points[points.length - 1]
    const forecastDeviationPct = latest && latest.forecastMWh > 0
      ? ((latest.actualMWh - latest.forecastMWh) / latest.forecastMWh) * 100
      : 0

    const availabilityPct = clamp(98 + forecastDeviationPct * 0.05, 80, 100)
    const status = forecastDeviationPct < -15 ? 'underperforming' : 'normal'

    const revenueMonth = Number((site.capacity_mw * 1000 * 30 * 0.45).toFixed(0))
    const operatingCostMonth = Number((revenueMonth * 0.12).toFixed(0))

    res.json({
      ...nowMeta('verified', 'Supabase solar_readings'),
      projectId: site.id,
      projectName: site.name,
      capacityMW: Number(site.capacity_mw ?? 0),
      generation: points,
      forecastDeviationPct,
      availabilityPct,
      revenueMonth,
      operatingCostMonth,
      status,
    })
  } catch (err) {
    next(err)
  }
})

router.get('/impact/environmental', async (req, res, next) => {
  try {
    const userId = req.userId

    const rows = await query(
      `
      with holdings as (
        select
          s.id as subscription_id,
          s.site_id,
          count(su.unit_index)::numeric as units,
          si.total_units::numeric as total_units,
          si.name as project_name
        from public.subscriptions s
        join public.sites si on si.id = s.site_id
        left join public.subscription_units su on su.subscription_id = s.id
        where s.user_id = $1 and s.status in ('active', 'pending')
        group by s.id, s.site_id, si.total_units, si.name
      ),
      gen as (
        select
          sr.site_id,
          sum(sr.generation_kwh) as kwh
        from public.solar_readings sr
        group by sr.site_id
      )
      select
        h.project_name,
        coalesce(g.kwh, 0) * case when h.total_units > 0 then (h.units / h.total_units) else 0 end as attributable_kwh
      from holdings h
      left join gen g on g.site_id = h.site_id
      `,
      [userId],
    )

    const gridFactor = 0.585
    const byProject = rows.rows.map((r) => {
      const kWh = Number(r.attributable_kwh ?? 0)
      const tCO2e = (kWh * gridFactor) / 1000
      return {
        projectName: r.project_name,
        kWh: Number(kWh.toFixed(3)),
        tCO2e: Number(tCO2e.toFixed(3)),
      }
    })

    const attributableKWh = byProject.reduce((acc, p) => acc + p.kWh, 0)
    const emissionsAvoidedT = byProject.reduce((acc, p) => acc + p.tCO2e, 0)
    const treesEquivalent = Number((emissionsAvoidedT / 0.022).toFixed(0))

    res.json({
      ...nowMeta('verified', 'Supabase solar_readings + holdings'),
      attributableKWh: Number(attributableKWh.toFixed(3)),
      emissionsAvoidedT: Number(emissionsAvoidedT.toFixed(3)),
      treesEquivalent,
      method: 'User attributable kWh from metered site output multiplied by grid factor 0.585 kgCO2e/kWh.',
      byProject,
    })
  } catch (err) {
    next(err)
  }
})

router.get('/alerts', async (req, res, next) => {
  try {
    const userId = req.userId

    const result = await query(
      `
      select
        a.id,
        a.type,
        a.severity,
        a.title,
        a.body,
        a.site_id as project_id,
        a.detection,
        a.created_at,
        (ar.alert_id is not null) as read
      from public.alerts a
      left join public.alert_reads ar
        on ar.alert_id = a.id and ar.user_id = $1
      where a.user_id = $1
      order by a.created_at desc
      `,
      [userId],
    )

    const alerts = result.rows
      .filter((r) => r.type !== 'sensor_offline')
      .map((r) => ({
        id: r.id,
        type: r.type,
        severity: r.severity,
        title: r.title,
        body: r.body,
        createdAt: new Date(r.created_at).toISOString(),
        read: Boolean(r.read),
        projectId: r.project_id ?? undefined,
        detection: r.detection,
      }))

    res.json(alerts)
  } catch (err) {
    next(err)
  }
})

router.post('/alerts/:id/read', async (req, res, next) => {
  try {
    const userId = req.userId
    const alertId = req.params.id

    await query(
      `
      insert into public.alert_reads(alert_id, user_id)
      values ($1, $2)
      on conflict (alert_id, user_id) do nothing
      `,
      [alertId, userId],
    )

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

router.get('/conversations/:conversationId/messages', async (req, res, next) => {
  try {
    const userId = req.userId
    const conversationId = req.params.conversationId

    const conversationCheck = await query(
      'select 1 from public.conversations where id = $1 and user_id = $2 limit 1',
      [conversationId, userId],
    )

    if (!conversationCheck.rows[0]) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    const result = await query(
      `
      select id, role, content, created_at, tool_calls, attachments, suggestions
      from public.messages
      where conversation_id = $1
      order by created_at asc
      `,
      [conversationId],
    )

    res.json(result.rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: new Date(m.created_at).toISOString(),
      toolCalls: m.tool_calls ?? undefined,
      attachments: m.attachments ?? undefined,
      suggestions: m.suggestions ?? undefined,
    })))
  } catch (err) {
    next(err)
  }
})

router.post('/conversations/:conversationId/messages', async (req, res, next) => {
  try {
    const userId = req.userId
    const conversationId = req.params.conversationId
    const text = String(req.body?.text ?? '').trim()

    if (!text) {
      return res.status(400).json({ error: 'text is required' })
    }

    const conversationCheck = await query(
      'select 1 from public.conversations where id = $1 and user_id = $2 limit 1',
      [conversationId, userId],
    )

    if (!conversationCheck.rows[0]) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    await query(
      `
      insert into public.messages (conversation_id, role, content)
      values ($1, 'user', $2)
      `,
      [conversationId, text],
    )

    const assistantText = 'I am connected to your backend. AI tool orchestration is not enabled yet, but your message has been recorded.'

    const inserted = await query(
      `
      insert into public.messages (conversation_id, role, content, suggestions)
      values ($1, 'assistant', $2, $3)
      returning id, role, content, created_at, tool_calls, attachments, suggestions
      `,
      [
        conversationId,
        assistantText,
        ['How is my portfolio doing?', 'Any alerts I should know about?', 'What is my environmental impact?'],
      ],
    )

    const m = inserted.rows[0]

    res.json({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: new Date(m.created_at).toISOString(),
      toolCalls: m.tool_calls ?? undefined,
      attachments: m.attachments ?? undefined,
      suggestions: m.suggestions ?? undefined,
    })
  } catch (err) {
    next(err)
  }
})

router.delete('/conversations/:conversationId/messages', async (req, res, next) => {
  try {
    const userId = req.userId
    const conversationId = req.params.conversationId

    const deleted = await query(
      `
      delete from public.messages m
      using public.conversations c
      where m.conversation_id = c.id
        and c.id = $1
        and c.user_id = $2
      `,
      [conversationId, userId],
    )

    if (deleted.rowCount === 0) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
