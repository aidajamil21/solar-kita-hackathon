import { motion } from 'framer-motion'
import { ArrowDownLeft, CalendarDays, ChevronRight, Coins, Leaf, MapPin, PiggyBank, Plus, Star, TrendingUp } from 'lucide-react'
import { createElement, useEffect, useState } from 'react'
import { backendApi, type PlanSummary } from '../api/backend'
import { Link, useNavigate } from 'react-router-dom'
import { ProjectArt } from '../components/Art'
import { AreaChart } from '../components/Charts'
import { Count, Hero, Page, Progress, Rise } from '../components/ui'
import { KINDS, MONTHS, rm, siteById, townshipById } from '../data'
import { combinedPayouts, interestReceived, investedOf, nextPayoutDate, useStore } from '../store'
import { asset } from '../asset'
import { Info } from '../components/Info'
import { HELP } from '../help'

/** the Solar Builder Plan at a glance (or an invitation to start one) */
function PlanCard() {
  const store = useStore()
  const [plan, setPlan] = useState<PlanSummary | null>(null)
  useEffect(() => { if (store.online) backendApi.getPlan().then(setPlan).catch(() => {}) }, [store.online])
  const p = plan?.plan && plan.plan.status !== 'cancelled' ? plan.plan : null
  const t = plan?.totals
  return (
    <Link to="/plan" className="card pad row" style={{ gap: 14, background: 'linear-gradient(135deg, #fff1ea 0%, #ffffff 70%)' }}>
      <span className="ic lg"><PiggyBank size={22} /></span>
      <div className="grow">
        <div style={{ fontWeight: 800, fontSize: 15 }}>Solar Builder Plan</div>
        <div className="muted small" style={{ marginTop: 2 }}>
          {p && t
            ? <>{rm(p.monthlyAmount)} a month{p.status === 'paused' ? ' (paused)' : ''} · <b style={{ color: 'var(--ink)' }}>{rm(t.received, 2)}</b> back so far{t.nextCredit ? <>, next {rm(t.nextCredit.amount, 2)}</> : null}</>
            : 'Put in a fixed amount each month. It all comes back over 10 years, plus 3% a year and points.'}
        </div>
      </div>
      <ChevronRight size={18} className="muted" />
    </Link>
  )
}

export default function Solar() {
  const store = useStore()
  const nav = useNavigate()
  const invested = store.subs.reduce((a, s) => a + investedOf(s), 0)
  // extra earned on top of your own money coming back
  const earned = store.subs.reduce((a, s) => a + interestReceived(s), 0)
  const payouts = combinedPayouts(store.subs, 12)
  const payout = nextPayoutDate()
  const points = store.subs.reduce((a, s) => a + s.units.length * (siteById(s.siteId)?.pointsPerUnit ?? 0), 0)
  const co2 = store.subs.reduce((a, s) => a + s.units.length * (siteById(s.siteId)?.co2PerUnit ?? 0), 0)
  // estimated value over the last 12 months: entry amount so far + extra earned so far
  const before = earned - payouts.reduce((a, p) => a + p.interest, 0)
  let cum = before
  const valueSeries = payouts.map((p) => {
    cum += p.interest
    const entry = store.subs.reduce((a, s) => { const [y, m] = s.since.split('-').map(Number); return y * 12 + m - 1 <= p.idx ? a + investedOf(s) : a }, 0)
    return { label: MONTHS[p.month].slice(0, 3), value: entry + cum, tip: `${MONTHS[p.month]} ${p.year}` }
  })

  return (
    <Page>
      <Hero photo={asset('photos/solar_farm_golden_hour_2.jpg')} eyebrow="Portfolio" title="My solar" accent="projects" sub="Your solar subscriptions, estimated value and performance." />

      <Rise className="section overlap">
        <div className="card raised pad">
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="muted small" style={{ fontWeight: 600 }}>Estimated portfolio value<Info size={13}>{HELP.portfolioValue}</Info></div>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15, whiteSpace: 'nowrap' }}><Count value={invested + earned} decimals={2} prefix="RM " /></div>
              <div className="row small" style={{ gap: 4, marginTop: 4, color: 'var(--green)', fontWeight: 700 }}>
                <TrendingUp size={14} /> +{invested ? ((earned / invested) * 100).toFixed(1) : '0.0'}% extra on {rm(invested)} entry
              </div>
            </div>
            <span className="pill green"><span className="live-dot" style={{ width: 6, height: 6 }} /> {store.subs.length} active</span>
          </div>
          <div style={{ marginTop: 16 }}>
            <AreaChart data={valueSeries} format={(v) => rm(v, 2)} height={130} />
          </div>
          <div className="kv" style={{ marginTop: 14 }}>
            <div><span className="ic sm gold"><Coins size={15} /></span><div><div className="k">Total entry amount<Info size={12}>{HELP.entryTotal}</Info></div><div className="v">{rm(invested)}</div></div></div>
            <div><span className="ic sm gold"><Star size={15} /></span><div><div className="k">Points earned</div><div className="v">+{points.toLocaleString()}</div></div></div>
            <div><span className="ic sm gold"><Leaf size={15} /></span><div><div className="k">Carbon savings</div><div className="v">~{co2.toFixed(1)} t <small>/ yr</small></div></div></div>
            <div><span className="ic sm gold"><CalendarDays size={15} /></span><div><div className="k">Next credit<Info size={12}>{HELP.nextCredit}</Info></div><div className="v">{payout.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}</div></div></div>
          </div>
        </div>
      </Rise>

      <Rise className="section" style={{ marginTop: 14 }}><PlanCard /></Rise>

      <Rise className="section">
        <div className="section-head">
          <h2 className="h2">Active subscriptions <span className="muted" style={{ fontWeight: 600 }}>({store.subs.length})</span></h2>
        </div>
        <div className="col" style={{ gap: 12 }}>
          {store.subs.map((s, i) => {
            const site = siteById(s.siteId)!
            const meta = KINDS[site.kind]
            return (
              <motion.div key={s.siteId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.06 }}>
                <Link to={`/solar/${site.id}`} className="card tap" style={{ overflow: 'hidden' }}>
                  <div style={{ height: 110, position: 'relative' }}>
                    <ProjectArt kind={site.kind} hero />
                    <span className="pill glass" style={{ position: 'absolute', left: 12, top: 12 }}>{createElement(meta.icon, { size: 12 })} {meta.label}</span>
                    <span className="pill green" style={{ position: 'absolute', right: 12, top: 12 }}><span className="live-dot" style={{ width: 6, height: 6 }} /> Active</span>
                  </div>
                  <div className="pad" style={{ paddingTop: 14 }}>
                    <div className="row">
                      <div className="grow">
                        <div style={{ fontWeight: 800, fontSize: 16 }}>{site.name}</div>
                        <div className="muted small row" style={{ gap: 4 }}><MapPin size={12} /> {townshipById(site.townshipId).name} · {s.units.length} {meta.unitName}{s.units.length > 1 ? 's' : ''}</div>
                      </div>
                      <ChevronRight size={18} className="muted" />
                    </div>
                    <div className="row" style={{ marginTop: 12, gap: 8 }}>
                      {[
                        ['Entry amount', rm(investedOf(s))],
                        ['Est. value', rm(investedOf(s) + interestReceived(s))],
                        ['Expected', `${site.returnLow}–${site.returnHigh}%`],
                      ].map(([k, v]) => (
                        <div key={k} style={{ flex: 1, background: '#FAFAF8', border: '1px solid var(--line-2)', borderRadius: 12, padding: '8px 10px' }}>
                          <div className="muted" style={{ fontSize: 10.5, fontWeight: 600 }}>{k}</div>
                          <div className="num" style={{ fontWeight: 800, fontSize: 13.5 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div className="row between small" style={{ marginBottom: 6 }}>
                        <span className="muted" style={{ fontWeight: 600 }}>Current output</span>
                        <b>{site.outputPct}% of capacity</b>
                      </div>
                      <Progress value={site.outputPct / 100} />
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
          <button className="btn outline block" onClick={() => nav('/explore')}><Plus size={18} /> Find more projects on the map</button>
        </div>
      </Rise>

      <Rise className="section" id="credits">
        <div className="section-head"><h2 className="h2">Recent energy savings credits<Info>{HELP.energyCredit}</Info></h2></div>
        <div className="card" style={{ padding: '2px 16px' }}>
          <div className="list">
            {payouts.slice(-4).reverse().map((p) => (
              <div key={p.idx} className="list-row">
                <span className="ic green sm"><ArrowDownLeft size={16} /></span>
                <div className="grow">
                  <div className="title">Energy Savings Credit</div>
                  <div className="desc">28 {MONTHS[p.month]} {p.year} · TNB bill ••4821</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontWeight: 800 }}>+{rm(p.amount, 2)}</div>
                  <div className="small" style={{ color: 'var(--green)', fontWeight: 600 }}>Paid</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Rise>
    </Page>
  )
}
