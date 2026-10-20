import { motion } from 'framer-motion'
import { ArrowDownLeft, CalendarDays, ChevronRight, MapPin, Plus, TrendingUp } from 'lucide-react'
import { createElement } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProjectArt } from '../components/Art'
import { BarChart } from '../components/Charts'
import { Count, Hero, Page, Progress, Rise } from '../components/ui'
import { KINDS, MONTHS, rm, siteById, townshipById } from '../data'
import { combinedPayouts, investedOf, monthlyRof, nextPayoutDate, rofEarned, useStore } from '../store'
import { asset } from '../asset'

export default function Solar() {
  const store = useStore()
  const nav = useNavigate()
  const invested = store.subs.reduce((a, s) => a + investedOf(s), 0)
  const earned = store.subs.reduce((a, s) => a + rofEarned(s), 0)
  const monthly = store.subs.reduce((a, s) => a + monthlyRof(s), 0)
  const payouts = combinedPayouts(store.subs, 12)
  const payout = nextPayoutDate()

  return (
    <Page>
      <Hero photo={asset('photos/solar_farm_golden_hour_2.jpg')} eyebrow="Portfolio" title="My solar" accent="projects" sub="Your subscriptions, Return on Fund (ROF) payouts and performance." />

      <Rise className="section overlap">
        <div className="card raised pad">
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="muted small" style={{ fontWeight: 600 }}>Total ROF earned</div>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15, whiteSpace: 'nowrap' }}><Count value={earned} decimals={2} prefix="RM " /></div>
              <div className="row small" style={{ gap: 4, marginTop: 4, color: 'var(--green)', fontWeight: 700 }}>
                <TrendingUp size={14} /> {((earned / invested) * 100).toFixed(1)}% on {rm(invested)} subscribed
              </div>
            </div>
            <span className="pill green">ROF</span>
          </div>
          <div className="row between small" style={{ marginTop: 18, marginBottom: 8 }}>
            <b>Monthly payouts</b><span className="muted">Last 12 months</span>
          </div>
          <BarChart
            data={payouts.map((p) => ({ label: MONTHS[p.month].slice(0, 3), value: p.amount, tip: `${MONTHS[p.month]} ${p.year}` }))}
            format={(v) => rm(v, 2)}
            color="#FF6E00"
          />
          <div className="divider" />
          <div className="row">
            <span className="ic blue"><CalendarDays size={18} /></span>
            <div className="grow">
              <div style={{ fontWeight: 700 }}>{rm(monthly, 2)} on {payout.toLocaleDateString('en-MY', { day: 'numeric', month: 'long' })}</div>
              <div className="muted small">Next payout to Maybank ••4821</div>
            </div>
          </div>
        </div>
      </Rise>

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
                        ['Subscribed', rm(investedOf(s))],
                        ['ROF earned', rm(rofEarned(s), 2)],
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

      <Rise className="section">
        <div className="section-head"><h2 className="h2">Recent payouts</h2></div>
        <div className="card" style={{ padding: '2px 16px' }}>
          <div className="list">
            {payouts.slice(-4).reverse().map((p) => (
              <div key={p.idx} className="list-row">
                <span className="ic green sm"><ArrowDownLeft size={16} /></span>
                <div className="grow">
                  <div className="title">ROF payout</div>
                  <div className="desc">28 {MONTHS[p.month]} {p.year} · Maybank ••4821</div>
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
