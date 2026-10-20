import { ArrowDownLeft, ArrowUpRight, BarChart3, CalendarDays, ChevronLeft, ChevronRight, Coins, Download, FileText, House, Leaf, Map, MapPin, Plus, Receipt, Star, TreePine, TrendingUp, Users, Zap } from 'lucide-react'
import { createElement, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ProjectArt } from '../components/Art'
import { AreaChart, BarChart } from '../components/Charts'
import { Coin, Page, Progress, Rise, Seg, Sheet } from '../components/ui'
import { KINDS, MONTHS, rm, siteById, townshipById } from '../data'
import { investedOf, monthlyRof, nextPayoutDate, rofEarned, rofHistory, useStore } from '../store'

type Range = '6M' | '1Y' | '3Y' | 'All'
type Doc = 'tx' | 'schedule' | 'docs' | null

export default function SolarDetail() {
  const { siteId } = useParams()
  const store = useStore()
  const nav = useNavigate()
  const site = siteById(siteId ?? '')
  const sub = store.subs.find((s) => s.siteId === siteId)
  const [range, setRange] = useState<Range>('1Y')
  const [doc, setDoc] = useState<Doc>(null)

  const history = useMemo(() => (sub ? rofHistory(sub) : []), [sub])
  const series = useMemo(() => {
    if (!sub) return []
    const invested = investedOf(sub)
    let cum = 0
    const pts = [{ label: 'Start', value: invested, tip: sub.since }]
    for (const h of history) {
      cum += h.amount
      pts.push({ label: MONTHS[h.month].slice(0, 3), value: invested + cum, tip: `${MONTHS[h.month]} ${h.year}` })
    }
    const take = range === '6M' ? 7 : range === '1Y' ? 13 : range === '3Y' ? 37 : pts.length
    return pts.slice(-take)
  }, [sub, history, range])

  if (!site || !sub) {
    return (
      <Page>
        <div className="empty" style={{ marginTop: 100 }}>
          <span className="ic lg" style={{ margin: '0 auto' }}><Map size={24} /></span>
          <p style={{ marginTop: 14 }}>You haven’t subscribed to this project yet.</p>
          <button className="btn primary" style={{ marginTop: 16 }} onClick={() => nav(`/explore?site=${siteId}`)}>View on the map</button>
        </div>
      </Page>
    )
  }

  const meta = KINDS[site.kind]
  const township = townshipById(site.townshipId)
  const invested = investedOf(sub)
  const earned = rofEarned(sub)
  const value = invested + earned
  const first = series[0]?.value ?? invested
  const change = value - first
  const payout = nextPayoutDate()
  const since = `${MONTHS[Number(sub.since.slice(5)) - 1]} ${sub.since.slice(0, 4)}`

  return (
    <Page>
      <Rise>
        <div className="row between" style={{ padding: '8px 0 14px' }}>
          <Link to="/solar" className="row" style={{ gap: 6, fontWeight: 600, fontSize: 14 }}><ChevronLeft size={20} /> Back to Projects</Link>
          <span className="pill green"><Leaf size={12} /> Active</span>
        </div>
      </Rise>

      {/* ---- hero ---- */}
      <Rise>
        <div className="card raised" style={{ overflow: 'hidden' }}>
          <div className="cushion" style={{ height: 180, position: 'relative', margin: '10px 10px 0' }}>
            <ProjectArt kind={site.kind} hero />
            <span className="pill glass" style={{ position: 'absolute', left: 14, top: 14 }}>{createElement(meta.icon, { size: 12 })} {meta.short}</span>
          </div>
          <div className="pad">
            <div className="eyebrow">{meta.label}</div>
            <h1 className="h1" style={{ fontSize: 26, marginTop: 4 }}>{site.name}</h1>
            <div className="row small muted" style={{ gap: 4, marginTop: 4 }}><MapPin size={13} /> {township.name}, {township.area}</div>
            <p className="sub" style={{ marginTop: 10, fontSize: 13.5 }}>{site.description}</p>
          </div>
        </div>
      </Rise>

      <Rise className="section grid-2" style={{ marginTop: 12 }}>
        <Stat icon={Coins} v={rm(invested)} l="Your entry amount" />
        <Stat icon={BarChart3} v={`${site.returnLow}–${site.returnHigh}%`} l="Expected return p.a." />
        <Stat icon={Star} v={`+${sub.units.length * site.pointsPerUnit}`} l="Points earned" />
        <Stat icon={Leaf} v={`${(sub.units.length * site.co2PerUnit).toFixed(1)} t`} l="CO₂e saved / year" />
      </Rise>

      {/* ---- performance ---- */}
      <Rise className="section">
        <div className="card pad">
          <div className="row between">
            <div className="row" style={{ gap: 10 }}><span className="ic sm"><BarChart3 size={16} /></span><h2 className="h2" style={{ fontSize: 16 }}>Performance</h2></div>
            <Seg id="range" options={['6M', '1Y', '3Y', 'All'] as Range[]} value={range} onChange={setRange} />
          </div>
          <div className="grid-2" style={{ marginTop: 16 }}>
            <div>
              <div className="muted small" style={{ fontWeight: 600 }}>Estimated value</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{rm(value, 2)}</div>
              <div className="row small" style={{ gap: 3, color: 'var(--green)', fontWeight: 700 }}><TrendingUp size={13} /> +{((change / first) * 100).toFixed(1)}% ({rm(change, 0)})</div>
            </div>
            <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 14 }}>
              <div className="muted small" style={{ fontWeight: 600 }}>Total rewards earned</div>
              <div className="row" style={{ gap: 6 }}><Coin size={20} /><span className="num" style={{ fontSize: 22, fontWeight: 800 }}>{sub.units.length * site.pointsPerUnit}</span></div>
              <div className="muted small">points</div>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <AreaChart data={series} format={(v) => rm(v, 2)} />
          </div>
          <div className="divider" />
          <div className="grid-2">
            <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span className="ic sm"><CalendarDays size={16} /></span>
              <div>
                <div className="muted" style={{ fontSize: 11, fontWeight: 600 }}>Project status</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Generating clean energy</div>
                <div className="muted" style={{ fontSize: 11 }}>Since {site.since}</div>
              </div>
            </div>
            <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span className="ic sm"><Zap size={16} /></span>
              <div className="grow">
                <div className="muted" style={{ fontSize: 11, fontWeight: 600 }}>Current output</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{(site.capacityMW * site.outputPct / 100).toFixed(site.capacityMW < 1 ? 3 : 1)} MW <span className="muted" style={{ fontWeight: 500 }}>of {site.capacityMW}</span></div>
                <div style={{ marginTop: 5 }}><Progress value={site.outputPct / 100} /></div>
              </div>
            </div>
          </div>
        </div>
      </Rise>

      {/* ---- ROF ---- */}
      <Rise className="section">
        <div className="card pad">
          <div className="row between">
            <div>
              <h2 className="h2" style={{ fontSize: 16 }}>Return on Fund (ROF)</h2>
              <div className="muted small">Paid monthly since {since}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="num" style={{ fontWeight: 800, fontSize: 19 }}>{rm(earned, 2)}</div>
              <div className="muted small">earned to date</div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <BarChart data={history.slice(-12).map((h) => ({ label: MONTHS[h.month].slice(0, 1), value: h.amount, tip: `${MONTHS[h.month]} ${h.year}` }))} format={(v) => rm(v, 2)} color="#FF6E00" />
          </div>
          <div className="row" style={{ marginTop: 14, background: 'var(--brand-soft)', padding: '10px 12px', borderRadius: 12 }}>
            <CalendarDays size={17} color="#E60000" />
            <span className="small grow">Next payout <b>{rm(monthlyRof(sub), 2)}</b> on {payout.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </Rise>

      {/* ---- your units ---- */}
      <Rise className="section">
        <div className="card pad">
          <div className="row between">
            <h2 className="h2" style={{ fontSize: 16 }}>Your {meta.unitName}s</h2>
            <Link to={`/explore?site=${site.id}`} className="pill-link"><Map size={13} />&nbsp;View on map</Link>
          </div>
          <div className="units" style={{ gridTemplateColumns: `repeat(${site.cols === 2 ? 4 : site.cols}, 1fr)`, marginTop: 12 }}>
            {Array.from({ length: site.units }, (_, i) => {
              const mine = sub.units.includes(i)
              return (
                <div key={i} className={`unit ${mine ? 'mine' : site.taken.includes(i) ? 'taken' : ''}`} style={{ height: 34, opacity: mine ? 1 : 0.5 }}>
                  <span>{mine ? <Leaf size={14} /> : i + 1}</span>
                </div>
              )
            })}
          </div>
          <p className="muted small" style={{ marginTop: 10 }}>
            You own {meta.unitName}{sub.units.length > 1 ? 's' : ''} #{sub.units.map((u) => u + 1).join(', #')} · {sub.units.length * site.kwpPerUnit} kWp installed capacity
          </p>
        </div>
      </Rise>

      <Rise className="section">
        <div className="card" style={{ padding: '2px 16px' }}>
          {[
            { id: 'tx' as Doc, icon: Receipt, title: 'Transaction history', desc: 'View your investments, rewards and payouts' },
            { id: 'schedule' as Doc, icon: CalendarDays, title: 'Payout schedule', desc: 'See upcoming and past distributions' },
            { id: 'docs' as Doc, icon: FileText, title: 'Project documents', desc: 'Reports, agreements and key information' },
          ].map((r) => (
            <button key={r.title} className="list-row" onClick={() => setDoc(r.id)}>
              <span className="ic grey sm"><r.icon size={16} /></span>
              <div className="grow"><div className="title">{r.title}</div><div className="desc">{r.desc}</div></div>
              <ChevronRight size={17} className="muted" />
            </button>
          ))}
        </div>
      </Rise>

      <Rise className="section">
        <div className="card pad">
          <div className="row" style={{ gap: 10, marginBottom: 14 }}><span className="ic green sm"><Leaf size={16} /></span><h2 className="h2" style={{ fontSize: 16 }}>Community impact</h2></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
            {[
              { icon: Users, v: site.homesPowered ? site.homesPowered.toLocaleString() : '120+', l: site.homesPowered ? 'Homes powered' : 'EV drives / week' },
              { icon: TreePine, v: `${Math.round(site.capacityMW * 370).toLocaleString()} t`, l: 'Lifetime CO₂e saved' },
              { icon: House, v: String(site.taken.length + sub.units.length), l: 'Co-owners' },
            ].map((x, i) => (
              <div key={x.l} style={{ paddingLeft: i ? 12 : 0, borderLeft: i ? '1px solid var(--line)' : 'none' }}>
                <x.icon size={18} color="#E60000" />
                <div className="num" style={{ fontWeight: 800, fontSize: 16, marginTop: 6 }}>{x.v}</div>
                <div className="muted" style={{ fontSize: 10.5 }}>{x.l}</div>
              </div>
            ))}
          </div>
        </div>
      </Rise>

      <Rise className="section grid-2">
        <button className="btn outline" onClick={() => nav(`/explore?site=${site.id}`)}><Plus size={17} /> Add units</button>
        <button className="btn primary" onClick={() => setDoc('docs')}><FileText size={17} /> Documents</button>
      </Rise>

      <Sheet open={doc !== null} onClose={() => setDoc(null)} label="Details">
        {doc === 'tx' && (
          <>
            <h2 className="h2" style={{ fontSize: 19 }}>Transaction history</h2>
            <div className="list" style={{ marginTop: 6 }}>
              {history.slice(-6).reverse().map((h) => (
                <div key={h.idx} className="list-row">
                  <span className="ic green sm"><ArrowDownLeft size={16} /></span>
                  <div className="grow"><div className="title">ROF payout</div><div className="desc">28 {MONTHS[h.month]} {h.year}</div></div>
                  <b className="num">+{rm(h.amount, 2)}</b>
                </div>
              ))}
              <div className="list-row">
                <span className="ic sm"><ArrowUpRight size={16} /></span>
                <div className="grow"><div className="title">Subscription · {sub.units.length} {meta.unitName}s</div><div className="desc">{since}</div></div>
                <b className="num">−{rm(invested)}</b>
              </div>
            </div>
          </>
        )}
        {doc === 'schedule' && (
          <>
            <h2 className="h2" style={{ fontSize: 19 }}>Payout schedule</h2>
            <p className="sub" style={{ marginTop: 4 }}>ROF is distributed on the 28th of every month.</p>
            <div className="list" style={{ marginTop: 6 }}>
              {Array.from({ length: 6 }, (_, k) => {
                const d = new Date(payout.getFullYear(), payout.getMonth() + k, 28)
                return (
                  <div key={k} className="list-row">
                    <span className="ic blue sm"><CalendarDays size={16} /></span>
                    <div className="grow"><div className="title">{d.toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}</div><div className="desc">{k === 0 ? 'Next payout' : 'Projected'}</div></div>
                    <b className="num">{rm(monthlyRof(sub), 2)}</b>
                  </div>
                )
              })}
            </div>
          </>
        )}
        {doc === 'docs' && (
          <>
            <h2 className="h2" style={{ fontSize: 19 }}>Project documents</h2>
            <div className="list" style={{ marginTop: 6 }}>
              {['Subscription agreement', 'Monthly generation report — Sep 2026', 'Renewable energy certificate', 'Project prospectus'].map((f) => (
                <button key={f} className="list-row" onClick={() => store.toast(`Downloading “${f}”`)}>
                  <span className="ic rose sm"><FileText size={16} /></span>
                  <div className="grow"><div className="title">{f}</div><div className="desc">PDF · {Math.round(f.length * 13)} KB</div></div>
                  <Download size={16} className="muted" />
                </button>
              ))}
            </div>
          </>
        )}
      </Sheet>
    </Page>
  )
}

function Stat({ icon, v, l }: { icon: typeof Coins; v: string; l: string }) {
  return (
    <div className="stat">
      <span className="ic sm">{createElement(icon, { size: 16 })}</span>
      <div><div className="v" style={{ fontSize: 16 }}>{v}</div><div className="l">{l}</div></div>
    </div>
  )
}
