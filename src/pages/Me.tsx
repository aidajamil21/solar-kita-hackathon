import { motion } from 'framer-motion'
import { Bell, Check, ChevronRight, FileText, Globe2, HelpCircle, Landmark, Leaf, Lock, Map as MapIcon, MapPin, RotateCcw, Shield, Star, Sun, UserRound, Zap } from 'lucide-react'
import { createElement, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Ring } from '../components/Charts'
import { Count, Hero, initials, Page, Progress, Rise, Sheet } from '../components/ui'
import { reloadAlerts } from '../components/AlertsButton'
import { BADGES, KINDS, LEVELS, levelFor, MONTHS, siteById, townshipById, type SiteKind } from '../data'
import { useStore } from '../store'
import { asset } from '../asset'

const KG_PER_KWH = 0.585
const LEVEL_ICONS = [Leaf, UserRound, Sun, Globe2]

export default function Me() {
  const store = useStore()
  const nav = useNavigate()
  const [open, setOpen] = useState<(typeof BADGES)[number] | null>(null)
  const [badge, setBadge] = useState<(typeof BADGES)[number] | null>(null)
  useEffect(() => { if (open) setBadge(open) }, [open])
  const [notif, setNotif] = useState(true)
  const lvl = levelFor(store.lifetime)
  const township = townshipById(store.township)

  // CO2 avoided per calendar year from each subscription's start month
  const now = new Date()
  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()]
  const perYear = years.map((y) =>
    store.subs.reduce((acc, s) => {
      const site = siteById(s.siteId)!
      const [sy, sm] = s.since.split('-').map(Number)
      const from = Math.max(sy * 12 + sm - 1, y * 12)
      const to = Math.min(now.getFullYear() * 12 + now.getMonth(), y * 12 + 12)
      return acc + (s.units.length * site.co2PerUnit * Math.max(0, to - from)) / 12
    }, 0),
  )
  const co2 = perYear.reduce((a, b) => a + b, 0)
  const kwh = (co2 * 1000) / KG_PER_KWH
  const trees = Math.round(co2 / 0.022)
  const kindsJoined = new Set(store.subs.map((s) => siteById(s.siteId)!.kind))
  const allKinds = Object.keys(KINDS) as SiteKind[]
  // points earned per month over the last six months (from activity + a steady baseline)
  const monthsBack = Array.from({ length: 6 }, (_, k) => (now.getMonth() - 5 + k + 12) % 12)
  const pointsPerMonth = monthsBack.map((m, k) => 90 + k * 32 + (m % 3) * 14)

  return (
    <Page>
      <Hero photo={asset('photos/elmina_1.jpg')} eyebrow="Sustainable townships. Brighter tomorrows." title="Progress &" accent="impact" sub="Your journey is powering cleaner communities. Here’s your personal impact so far." />

      <Rise className="section overlap">
        <div className="card pad row">
          <div className="avatar" style={{ width: 56, height: 56, fontSize: 19 }}>{initials(store.name)}</div>
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: 18 }}>{store.name}</div>
            <div className="muted small row" style={{ gap: 4 }}><MapPin size={12} /> {township.name} · Member since Jan 2024</div>
          </div>
          <span className="pill"><Star size={11} fill="currentColor" /> Lv {lvl.cur.level}</span>
        </div>
      </Rise>

      <Rise className="band">
        <h2 className="h2">Your impact</h2>
        <div className="band-sub">Championing cleaner, greener townships</div>
        <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="stat" style={{ alignItems: 'flex-start' }}>
          <span className="ic sm green"><Leaf size={16} /></span>
          <div><div className="l">Carbon savings</div><div className="v"><Count value={co2} decimals={1} /><small>tCO₂e</small></div><div className="s">≈ {trees.toLocaleString()} trees / yr</div></div>
        </div>
        <div className="stat" style={{ alignItems: 'flex-start' }}>
          <span className="ic sm"><Zap size={16} /></span>
          <div><div className="l">Clean energy</div><div className="v"><Count value={Math.round(kwh)} /><small>kWh</small></div><div className="s">Contributed to the grid</div></div>
        </div>
        <div className="stat" style={{ alignItems: 'flex-start' }}>
          <span className="ic sm"><Sun size={16} /></span>
          <div><div className="l">Active projects</div><div className="v">{store.subs.length}</div><div className="s">Across {new Set(store.subs.map((s) => siteById(s.siteId)!.townshipId)).size} township(s)</div></div>
        </div>
        <div className="stat" style={{ alignItems: 'flex-start' }}>
          <span className="ic sm"><Star size={16} /></span>
          <div><div className="l">Community points</div><div className="v"><Count value={store.points} /></div><div className="s">{lvl.next ? `${(lvl.next.min - store.lifetime).toLocaleString()} to next level` : 'Top level'}</div></div>
        </div>
        </div>
      </Rise>

      {/* ---- journey ---- */}
      <Rise className="section">
        <div className="card pad">
          <div className="row between" style={{ marginBottom: 16 }}>
            <h2 className="h2" style={{ fontSize: 16 }}>Your sustainability journey</h2>
          </div>
          <div className="row" style={{ alignItems: 'flex-start', gap: 0 }}>
            {LEVELS.map((l, i) => {
              const done = store.lifetime >= l.min
              const cur = l.level === lvl.cur.level
              return (
                <div key={l.level} className="col" style={{ flex: 1, alignItems: 'center', textAlign: 'center', position: 'relative' }}>
                  {i > 0 && <span style={{ position: 'absolute', top: 17, right: '50%', width: '100%', height: 2, background: done ? 'var(--brand)' : 'transparent', borderTop: done ? 'none' : '2px dashed #DCDCD6' }} />}
                  <span className={`ic ${done ? 'solid' : 'grey'}`} style={{ position: 'relative', width: 36, height: 36, boxShadow: cur ? '0 0 0 4px var(--brand-soft)' : 'none' }}>
                    {createElement(LEVEL_ICONS[i], { size: 16 })}
                  </span>
                  <div className="muted" style={{ fontSize: 10, fontWeight: 600, marginTop: 8 }}>Level {l.level}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: done ? 'var(--ink)' : 'var(--muted)', lineHeight: 1.2 }}>{l.name}</div>
                </div>
              )
            })}
          </div>
          {lvl.next && (
            <div style={{ marginTop: 16, background: '#FAFAF8', border: '1px solid var(--line-2)', borderRadius: 12, padding: '10px 12px' }}>
              <div className="row between small" style={{ marginBottom: 7 }}>
                <span className="muted">{(lvl.next.min - store.lifetime).toLocaleString()} points to next milestone</span>
                <b>{store.lifetime.toLocaleString()} / {lvl.next.min.toLocaleString()}</b>
              </div>
              <Progress value={lvl.progress} />
            </div>
          )}
        </div>
      </Rise>

      {/* ---- charts ---- */}
      <Rise className="section col" style={{ gap: 10 }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="row" style={{ gap: 8 }}><span className="ic sm green" style={{ width: 26, height: 26 }}><Leaf size={13} /></span><span style={{ fontWeight: 700, fontSize: 12.5 }}>Yearly carbon</span></div>
          <div className="muted" style={{ fontSize: 10.5, margin: '4px 0 8px' }}>tCO₂e avoided</div>
          <BarChart data={years.map((y, i) => ({ label: String(y), value: perYear[i], tip: String(y) }))} format={(v) => `${v.toFixed(2)} t`} height={110} color="#FF6E00" />
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="row" style={{ gap: 8 }}><span className="ic sm" style={{ width: 26, height: 26 }}><Star size={13} /></span><span style={{ fontWeight: 700, fontSize: 12.5 }}>Points growth</span></div>
          <div className="muted" style={{ fontSize: 10.5, margin: '4px 0 8px' }}>Earned per month</div>
          <BarChart data={monthsBack.map((m, k) => ({ label: MONTHS[m].slice(0, 3), value: pointsPerMonth[k], tip: MONTHS[m] }))} format={(v) => `+${Math.round(v)} pts`} height={110} color="#FF6E00" />
        </div>
      </Rise>
      <Rise className="section" style={{ marginTop: 10 }}>
        <div className="card pad row">
          <Ring value={kindsJoined.size / allKinds.length} size={78} stroke={9}>
            <span className="num" style={{ fontWeight: 800, fontSize: 17 }}>{Math.round((kindsJoined.size / allKinds.length) * 100)}%</span>
          </Ring>
          <div className="grow">
            <div style={{ fontWeight: 700, fontSize: 14 }}>Participation progress</div>
            <div className="muted small">{kindsJoined.size} of {allKinds.length} initiative types joined</div>
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              {allKinds.map((k) => (
                <span key={k} title={KINDS[k].label} className={`ic sm ${kindsJoined.has(k) ? 'solid' : 'grey'}`} style={{ width: 28, height: 28 }}>
                  {createElement(KINDS[k].icon, { size: 14 })}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Rise>

      {/* ---- achievements ---- */}
      <Rise className="section">
        <div className="section-head"><h2 className="h2">Achievements</h2><span className="muted small">{BADGES.filter((b) => b.earned).length} of {BADGES.length} unlocked</span></div>
        <div className="card" style={{ padding: '16px 8px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', rowGap: 18 }}>
          {BADGES.map((b, i) => (
            <motion.button key={b.id} whileTap={{ scale: 0.94 }} onClick={() => setOpen(b)} className="col" style={{ alignItems: 'center', gap: 8, padding: '0 4px' }}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.04 }}>
              <span className="hex-wrap">
                <span className={`hex${b.earned ? '' : ' locked'}`}>{createElement(b.icon, { size: 24, strokeWidth: 1.8 })}</span>
                <span className={`hex-check${b.earned ? '' : ' lock'}`}>{b.earned ? <Check size={11} strokeWidth={3.5} /> : <Lock size={10} strokeWidth={3} />}</span>
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: 1.25 }}>{b.name}</span>
            </motion.button>
          ))}
        </div>
      </Rise>

      {/* ---- settings ---- */}
      <Rise className="section">
        <div className="section-head"><h2 className="h2">Account</h2></div>
        <div className="card" style={{ padding: '2px 16px' }}>
          <button className="list-row" onClick={() => nav('/explore')}>
            <span className="ic sm"><MapPin size={16} /></span>
            <div className="grow"><div className="title">Home township</div><div className="desc">{township.name}, {township.area}</div></div>
            <ChevronRight size={16} className="muted" />
          </button>
          <button className="list-row" onClick={() => store.toast('Credits are applied to TNB account ••4821')}>
            <span className="ic sm blue"><Landmark size={16} /></span>
            <div className="grow"><div className="title">Credit account</div><div className="desc">TNB electricity account ••4821</div></div>
            <ChevronRight size={16} className="muted" />
          </button>
          <div className="list-row">
            <span className="ic sm rose"><Bell size={16} /></span>
            <div className="grow"><div className="title">Credit & reward alerts</div><div className="desc">{notif ? 'Enabled' : 'Disabled'}</div></div>
            <button role="switch" aria-checked={notif} aria-label="Toggle alerts" onClick={() => setNotif((n) => !n)}
              style={{ width: 46, height: 28, borderRadius: 14, background: notif ? 'var(--brand)' : '#D8D7D2', position: 'relative', transition: 'background .3s' }}>
              <motion.span layout transition={{ type: 'spring', damping: 22, stiffness: 420 }} style={{ position: 'absolute', top: 3, left: notif ? 21 : 3, width: 22, height: 22, borderRadius: 11, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
            </button>
          </div>
          <div className="list-row">
            <span className="ic sm blue"><MapIcon size={16} /></span>
            <div className="grow"><div className="title">3D township map</div><div className="desc">{store.mapMode === '3d' ? 'On · switch off for a lighter 2D map' : 'Off · using the lighter 2D map'}</div></div>
            <button role="switch" aria-checked={store.mapMode === '3d'} aria-label="Toggle 3D map" onClick={() => store.setMapMode(store.mapMode === '3d' ? '2d' : '3d')}
              style={{ width: 46, height: 28, borderRadius: 14, background: store.mapMode === '3d' ? 'var(--brand)' : '#D8D7D2', position: 'relative', transition: 'background .3s' }}>
              <motion.span layout transition={{ type: 'spring', damping: 22, stiffness: 420 }} style={{ position: 'absolute', top: 3, left: store.mapMode === '3d' ? 21 : 3, width: 22, height: 22, borderRadius: 11, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
            </button>
          </div>
          {[
            { icon: FileText, t: 'Statements & tax documents', d: 'Annual statement 2025' },
            { icon: Shield, t: 'Privacy & security', d: 'Biometric login enabled' },
            { icon: HelpCircle, t: 'Help centre', d: 'How subscriptions and returns work' },
          ].map((r) => (
            <button key={r.t} className="list-row" onClick={() => store.toast(`${r.t} opened`)}>
              <span className="ic sm grey"><r.icon size={16} /></span>
              <div className="grow"><div className="title">{r.t}</div><div className="desc">{r.d}</div></div>
              <ChevronRight size={16} className="muted" />
            </button>
          ))}
          <button className="list-row" onClick={() => { store.reset().then(() => { void reloadAlerts(); store.toast('Demo data has been reset') }).catch(() => {}) }}>
            <span className="ic sm grey"><RotateCcw size={16} /></span>
            <div className="grow"><div className="title">Reset demo data</div><div className="desc">Restore the prototype’s starting state</div></div>
          </button>
        </div>
      </Rise>

      <Sheet open={!!open} onClose={() => setOpen(null)} label="Achievement">
        {badge && (
          <div style={{ textAlign: 'center', padding: '4px 0 8px' }}>
            <motion.div key={badge.id} initial={{ rotateY: 120, scale: 0.6 }} animate={{ rotateY: 0, scale: 1 }} transition={{ type: 'spring', damping: 14 }} style={{ display: 'inline-block' }}>
              <span className={`hex${badge.earned ? '' : ' locked'}`} style={{ width: 104, height: 114 }}>{createElement(badge.icon, { size: 42, strokeWidth: 1.6 })}</span>
            </motion.div>
            <h2 className="h2" style={{ fontSize: 21, marginTop: 14 }}>{badge.name}</h2>
            <p className="sub" style={{ marginTop: 4 }}>{badge.desc}</p>
            <span className={`pill ${badge.earned ? 'green' : 'grey'}`} style={{ marginTop: 14 }}>{badge.earned ? <><Check size={12} /> Unlocked</> : <><Lock size={11} /> Locked</>}</span>
          </div>
        )}
      </Sheet>
    </Page>
  )
}
