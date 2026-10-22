import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Bike, Check, ChevronRight, Footprints, Leaf, Map, Star } from 'lucide-react'
import { createElement, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProjectArt, TownPhoto } from '../components/Art'
import { Count, Hero, Page, Progress, Rise } from '../components/ui'
import { KINDS, levelFor, SITES, TOWNSHIPS, townshipById } from '../data'
import { InitiativeStrip, ProjectFacts } from '../components/ProjectFacts'
import { useStore } from '../store'
import { asset } from '../asset'

export default function Home() {
  const store = useStore()
  const nav = useNavigate()
  const township = townshipById(store.township)
  const lvl = levelFor(store.lifetime)
  const sites = useMemo(() => SITES.filter((s) => s.townshipId === township.id), [township.id])
  const [featuredId, setFeaturedId] = useState<string | null>(null)
  const featured = sites.find((s) => s.id === featuredId) ?? sites.find((s) => s.kind === 'subscription') ?? sites[0]
  const meta = KINDS[featured.kind]

  return (
    <Page>
      <Hero photo={asset('photos/solar_farm_golden_hour_2.jpg')} eyebrow="Sustainable townships. Brighter tomorrows." title="Choose your solar" accent="journey" sub="Explore solar initiatives in your township, earn rewards and help build net-zero communities." />

      {/* ---- select your township ---- */}
      <Rise className="section overlap">
        <div className="card raised" style={{ padding: '14px 0 12px' }}>
          <div className="row between" style={{ padding: '0 16px', marginBottom: 10 }}>
            <h2 className="h2" style={{ fontSize: 14 }}>Select your township</h2>
            <span className="muted small">{TOWNSHIPS.length} townships</span>
          </div>
          <div className="hscroll" style={{ margin: 0, padding: '2px 16px 4px', gap: 8 }}>
            {TOWNSHIPS.map((t) => {
              const on = t.id === township.id
              return (
                <motion.button key={t.id} whileTap={{ scale: 0.95 }} onClick={() => { store.setTownship(t.id); setFeaturedId(null) }}
                  className="col" style={{ width: 104, padding: 5, borderRadius: 16, border: `1.5px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : '#fff', textAlign: 'left', position: 'relative' }}>
                  <div style={{ height: 58, borderRadius: 11, overflow: 'hidden' }}><TownPhoto township={t} /></div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.2, padding: '6px 3px 2px', minHeight: 34 }}>{t.name}</span>
                  {on && <span className="ic solid" style={{ position: 'absolute', top: 9, right: 9, width: 20, height: 20 }}><Check size={12} strokeWidth={3.5} /></span>}
                </motion.button>
              )
            })}
          </div>
        </div>
      </Rise>

      {/* ---- 3D map preview ---- */}
      <Rise className="section" style={{ marginTop: 14 }}>
        <motion.button whileTap={{ scale: 0.985 }} onClick={() => nav('/explore')} className="card tap" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ height: 230, position: 'relative', background: '#EEF0EC' }}>
            <AnimatePresence mode="popLayout">
              <motion.img key={township.id} src={asset(`previews/${township.id}.jpg`)} alt={`3D map of ${township.name}`} className="photo"
                initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} />
            </AnimatePresence>
            <span className="pill glass" style={{ position: 'absolute', left: 12, top: 12 }}><Map size={12} /> Interactive 3D map</span>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '28px 14px 12px', background: 'linear-gradient(transparent, rgba(255,255,255,.96) 55%)' }} className="row between">
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{township.name}</div>
                <div className="muted small">{township.area}, {township.state} · {sites.length} solar sites</div>
              </div>
              <span className="btn pill red sm">Explore <ArrowRight size={14} /></span>
            </div>
          </div>
        </motion.button>
      </Rise>

      {/* ---- featured solar project ---- */}
      <Rise className="section" style={{ marginTop: 14 }}>
        <div className="card raised pad">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={featured.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25 }}>
              <button className="row" style={{ alignItems: 'flex-start', width: '100%', textAlign: 'left' }} onClick={() => nav(`/explore?site=${featured.id}`)}>
                <div className="cushion" style={{ width: 104, height: 92, flexShrink: 0 }}><ProjectArt kind={featured.kind} /></div>
                <div className="grow">
                  <span className="pill">{createElement(meta.icon, { size: 12 })} Solar project</span>
                  <div style={{ fontWeight: 800, fontSize: 16, marginTop: 6, lineHeight: 1.2 }}>{meta.label}</div>
                  <div className="muted small" style={{ marginTop: 3 }}>{featured.name}</div>
                </div>
                <ChevronRight size={18} className="muted" />
              </button>
              <p className="sub" style={{ fontSize: 13, marginTop: 12 }}>{meta.blurb}</p>
              <div style={{ marginTop: 6 }}><ProjectFacts site={featured} /></div>
            </motion.div>
          </AnimatePresence>
          <div className="grid-2" style={{ marginTop: 12 }}>
            <button className="btn ghost" onClick={() => nav(`/explore?site=${featured.id}`)}>View details</button>
            <button className="btn primary" onClick={() => nav(`/explore?site=${featured.id}`)}>Participate <ArrowRight size={17} /></button>
          </div>
        </div>
      </Rise>

      {/* ---- every initiative in this township ---- */}
      {sites.length > 1 && (
        <Rise className="section">
          <div className="section-head">
            <div>
              <h2 className="h2">Earn points across every initiative</h2>
              <div className="muted small" style={{ marginTop: 2 }}>The more you contribute, the more you’re rewarded.</div>
            </div>
          </div>
          <InitiativeStrip sites={sites} activeId={featured.id} onPick={(s) => setFeaturedId(s.id)} />
        </Rise>
      )}

      {/* ---- go green ---- */}
      <Rise className="section" style={{ marginTop: 14 }}>
        <Link to="/green" className="card pad row" style={{ gap: 14, background: 'linear-gradient(135deg, #e9f6ee 0%, #ffffff 70%)' }}>
          <span className="ic lg green" style={{ position: 'relative' }}><Footprints size={22} /><Bike size={15} style={{ position: 'absolute', right: -4, bottom: -2, background: '#fff', borderRadius: 6, padding: 1 }} /></span>
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: 15 }}>Go Green: walk or cycle</div>
            <div className="muted small" style={{ marginTop: 2 }}>Skip the car around {township.name}. Earn points for every kilometre and see the petrol you saved.</div>
          </div>
          <ChevronRight size={18} className="muted" />
        </Link>
      </Rise>

      {/* ---- points ---- */}
      <Rise className="section" style={{ marginTop: 14 }}>
        <Link to="/rewards" className="card pad" style={{ display: 'block' }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <span className="ic lg solid"><Star size={24} fill="#fff" /></span>
            <div className="grow">
              <div className="muted small" style={{ fontWeight: 600 }}>Your Community Energy Points</div>
              <div className="row" style={{ gap: 6, alignItems: 'baseline' }}>
                <span style={{ fontSize: 28, fontWeight: 800 }}><Count value={store.points} /></span>
                <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>points</span>
              </div>
            </div>
            <ChevronRight size={18} className="muted" />
          </div>
          {lvl.next && (
            <div style={{ marginTop: 12 }}>
              <Progress value={lvl.progress} />
              <div className="row between" style={{ marginTop: 7, fontSize: 11.5 }}>
                <span className="muted"><b style={{ color: 'var(--ink)' }}>{(lvl.next.min - store.lifetime).toLocaleString()}</b> points to next reward</span>
                <span className="muted">Level {lvl.cur.level} · {lvl.cur.name}</span>
              </div>
            </div>
          )}
          <div className="row" style={{ marginTop: 14, padding: '10px 12px', borderRadius: 14, background: 'var(--green-soft)', gap: 10 }}>
            <Leaf size={18} color="#1F8A5B" />
            <div className="small"><span className="muted">Our 2030 commitment</span><br /><b>Net-Zero Ready Townships</b></div>
          </div>
        </Link>
      </Rise>
    </Page>
  )
}
