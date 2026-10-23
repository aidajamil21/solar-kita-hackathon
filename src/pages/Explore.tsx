import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, BookOpen, Check, ChevronDown, Compass, CreditCard, Landmark, LayoutGrid, Leaf, MapPin, Minus, Moon, Plus, Search, Star, Sun, Users, Wallet, X, Zap, BatteryCharging } from 'lucide-react'
import { createElement, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ProjectArt, TownPhoto } from '../components/Art'
import type { UnitState } from '../components/map/Sites'
import type { MapApi } from '../components/map/TownshipMap'
import { AlertBack, Coin, Progress, Sheet, SuccessMark, useFromAlert } from '../components/ui'
import { InvestGuide } from '../components/InvestGuide'
import { ProjectFacts } from '../components/ProjectFacts'
import { KINDS, rm, roofOf, siteMeta, SITES, siteById, STATES, TOWNSHIPS, townshipById, unitGridCols, unitLabel, type Site, type SiteKind } from '../data'
import { useStore } from '../store'
import { Info } from '../components/Info'
import { HELP } from '../help'

const TownshipMap = lazy(() => import('../components/map/TownshipMap'))
const Map2D = lazy(() => import('../components/map/Map2D'))

const FILTERS: (SiteKind | 'all')[] = ['all', 'subscription', 'investment', 'rooftop', 'ev']

export default function Explore() {
  const store = useStore()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const township = townshipById(store.township)
  const mode = store.mapMode
  const fromAlert = useFromAlert()
  const loc = useLocation()
  const sites = useMemo(() => SITES.filter((s) => s.townshipId === township.id), [township.id])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selection, setSelection] = useState<number[]>([])
  const [filter, setFilter] = useState<SiteKind | 'all'>('all')
  const [night, setNight] = useState(false)
  const [flow, setFlow] = useState(false)
  const [interacted, setInteracted] = useState(false)
  const [full, setFull] = useState(false)
  const [townOpen, setTownOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const api = useRef<MapApi | null>(null)
  const idleTimer = useRef<number | undefined>(undefined)

  const selected = selectedId ? siteById(selectedId) ?? null : null

  // deep-link: /explore?site=elmina-subscription
  useEffect(() => {
    const id = params.get('site')
    const s = id && siteById(id)
    if (s) {
      if (s.townshipId !== store.township) store.setTownship(s.townshipId)
      setSelectedId(s.id)
      setParams({}, { replace: true, state: loc.state })
    }
  }, [params, setParams, store, loc.state])

  // fly the camera to whatever is selected
  const hadSelection = useRef(false)
  useEffect(() => {
    setSelection([])
    setFull(false)
    const t = setTimeout(() => {
      if (selected) { api.current?.focus(selected); hadSelection.current = true }
      else if (hadSelection.current) { api.current?.reset(); hadSelection.current = false }
    }, 60)
    return () => clearTimeout(t)
  }, [selected])

  const onInteract = useCallback(() => {
    setInteracted(true)
    window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => setInteracted(false), 12000)
  }, [])
  useEffect(() => () => window.clearTimeout(idleTimer.current), [])

  const unitState = useCallback((site: Site, i: number): UnitState => {
    if (store.mineFor(site).has(i)) return 'mine'
    if (site.taken.includes(i)) return 'taken'
    if (site.id === selectedId && selection.includes(i)) return 'sel'
    return 'free'
  }, [store, selectedId, selection])

  const toggleUnit = useCallback((site: Site, i: number) => {
    const st = unitState(site, i)
    const label = `${KINDS[site.kind].unitName} ${unitLabel(site, i)}`
    if (st === 'mine') return store.toast(`You already own ${label}`)
    if (st === 'taken') return store.toast(`${label} is already subscribed`)
    setSelection((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))
  }, [store, unitState])

  const quickPick = (delta: 1 | -1) => {
    if (!selected) return
    if (delta < 0) return setSelection((s) => s.slice(0, -1))
    const next = Array.from({ length: selected.units }, (_, i) => i).find((i) => unitState(selected, i) === 'free')
    if (next === undefined) store.toast('No more units available at this site')
    else setSelection((s) => [...s, next])
  }

  const switchTown = (id: string) => {
    setSelectedId(null)
    store.setTownship(id)
    setTownOpen(false)
    setTimeout(() => api.current?.reset(), 80)
  }

  return (
    <div className={`map-page${night ? ' night-ui' : ''}`}>
      <Suspense fallback={<MapLoading mode={mode} />}>
        {mode === '2d' ? (
          <Map2D
            township={township}
            sites={sites}
            selectedId={selectedId}
            filter={filter}
            night={night}
            mineCount={(s) => store.mineFor(s).size}
            onSelect={setSelectedId}
            onInteract={onInteract}
            api={api}
          />
        ) : (
          <TownshipMap
            township={township}
            sites={sites}
            selectedId={selectedId}
            filter={filter}
            night={night}
            flow={flow}
            autoRotate={!selectedId && !interacted}
            unitState={unitState}
            mineCount={(s) => store.mineFor(s).size}
            onSelect={setSelectedId}
            onUnit={(s, i) => (s.id === selectedId ? toggleUnit(s, i) : setSelectedId(s.id))}
            onInteract={onInteract}
            api={api}
          />
        )}
      </Suspense>

      {/* ---- top overlay ---- */}
      <div className="map-top">
        {fromAlert && <AlertBack inline from={fromAlert} />}
        <button className="glass-card town-btn" onClick={() => setTownOpen(true)}>
          <span className="town-thumb"><TownPhoto township={township} /></span>
          <span className="grow">
            <span className="eyebrow" style={{ fontSize: 9.5, display: 'block' }}>Select your township</span>
            <span style={{ display: 'block', fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>{township.name}</span>
          </span>
          <span className="small muted" style={{ fontWeight: 600 }}>{sites.length} sites</span>
          <ChevronDown size={18} />
        </button>
        <div className="map-row">
        <button className="guide-btn" onClick={() => setGuideOpen(true)}><BookOpen size={15} /> How to invest?</button>
        <div className="map-mode" role="group" aria-label="Map view">
          {(['3d', '2d'] as const).map((m) => (
            <button key={m} className={mode === m ? 'active' : ''} aria-pressed={mode === m}
              onClick={() => { if (mode !== m) { store.setMapMode(m); store.toast(m === '2d' ? '2D map on — lighter on your device' : '3D map on') } }}>
              {m.toUpperCase()}
            </button>
          ))}
          <Info light={night}>{HELP.mapMode}</Info>
        </div>
        </div>
        <div className="chips" style={{ marginTop: 4 }}>
          {FILTERS.map((f) => {
            const count = f === 'all' ? sites.length : sites.filter((s) => s.kind === f).length
            if (f !== 'all' && count === 0) return null
            return (
              <button key={f} className={`chip${filter === f ? ' active' : ''}`} onClick={() => { setFilter(f); if (selected && f !== 'all' && selected.kind !== f) setSelectedId(null) }}>
                {createElement(f === 'all' ? LayoutGrid : KINDS[f].icon, { size: 14 })}
                {f === 'all' ? 'All sites' : KINDS[f].short}
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {!selected && (
          <motion.div className="map-ctrl" style={{ top: fromAlert ? 220 : 176 }} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
            <button title={HELP.night} aria-label={night ? 'Switch to day' : 'Switch to night'} className={night ? 'on' : ''} onClick={() => setNight((n) => !n)}>
              {night ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            {mode === '3d' && <button title={HELP.energyFlow} aria-label="Toggle energy flow" className={flow ? 'on' : ''} onClick={() => { setFlow((f) => !f); store.toast(flow ? 'Energy flow hidden' : 'Showing live energy flow') }}>
              <Zap size={18} />
            </button>}
            <div className="stack">
              <button aria-label="Zoom in" onClick={() => api.current?.zoom(0.75)}><Plus size={18} /></button>
              <button aria-label="Zoom out" onClick={() => api.current?.zoom(1.33)}><Minus size={18} /></button>
            </div>
            <button aria-label="Recenter" onClick={() => api.current?.reset()}><Compass size={18} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- site carousel ---- */}
      <AnimatePresence>
        {!selected && (
          <motion.div
            className="site-carousel"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          >
            <div className="hscroll" style={{ margin: 0, padding: '2px 16px 8px' }}>
              {sites.filter((s) => filter === 'all' || s.kind === filter).map((s) => <SiteCard key={s.id} site={s} onClick={() => setSelectedId(s.id)} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- site sheet ---- */}
      <AnimatePresence>
        {selected && (
          <SiteSheet
            key={selected.id}
            site={selected}
            full={full}
            setFull={setFull}
            selection={selection}
            unitState={(i) => unitState(selected, i)}
            onToggle={(i) => toggleUnit(selected, i)}
            onQuick={quickPick}
            onClear={() => setSelection([])}
            onClose={() => setSelectedId(null)}
            onSubscribe={() => setConfirmOpen(true)}
          />
        )}
      </AnimatePresence>

      <TownshipPicker open={townOpen} onClose={() => setTownOpen(false)} current={township.id} onPick={switchTown} />

      <Sheet open={guideOpen} onClose={() => setGuideOpen(false)} label="How to invest">
        {guideOpen && (
          <InvestGuide
            township={township.name}
            kindsHere={new Set(sites.map((s) => s.kind))}
            onShowKind={(k) => { setSelectedId(null); setFilter(k) }}
            onChangeTown={() => { setGuideOpen(false); setTownOpen(true) }}
            onClose={() => setGuideOpen(false)}
          />
        )}
      </Sheet>

      {selected && (
        <ConfirmSheet
          open={confirmOpen}
          site={selected}
          units={selection}
          onClose={() => setConfirmOpen(false)}
          onDone={(go) => {
            setConfirmOpen(false)
            setSelection([])
            if (go) nav(`/solar/${selected.id}`)
          }}
        />
      )}
    </div>
  )
}

function MapLoading({ mode }: { mode: '3d' | '2d' }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      <div className="col" style={{ alignItems: 'center', gap: 12 }}>
        <div className="spinner" />
        <p className="sub">{`Loading ${mode === '3d' ? '3D' : '2D'} township…`}</p>
      </div>
    </div>
  )
}

/* ---------- carousel card ---------- */
function SiteCard({ site, onClick }: { site: Site; onClick: () => void }) {
  const store = useStore()
  const meta = siteMeta(site)
  const mine = store.mineFor(site).size
  const free = site.units - site.taken.length - mine
  return (
    <motion.button whileTap={{ scale: 0.98 }} className="card tap" style={{ width: 286, padding: 10, borderRadius: 18, boxShadow: '0 10px 30px -14px rgba(16,24,40,.35)' }} onClick={onClick}>
      <div className="row" style={{ gap: 10 }}>
        <div className="cushion" style={{ width: 74, height: 64, flexShrink: 0 }}><ProjectArt kind={site.kind} on={roofOf(site)} /></div>
        <div className="grow">
          <div className="row" style={{ gap: 6 }}>
            <span className="pill" style={{ height: 20, fontSize: 10, padding: '0 7px' }}>{createElement(meta.icon, { size: 10 })} {meta.short}</span>
            {mine > 0 && <span className="pill green" style={{ height: 20, fontSize: 10, padding: '0 7px' }}>Yours</span>}
          </div>
          <div style={{ fontWeight: 800, fontSize: 14.5, marginTop: 5 }} className="ellipsis">{site.name}</div>
          <div className="row" style={{ gap: 10, fontSize: 11.5, marginTop: 2 }}>
            <span className="muted">From <b style={{ color: 'var(--ink)' }}>{rm(site.pricePerUnit)}</b></span>
            <span className="muted"><b style={{ color: 'var(--ink)' }}>{site.returnLow}–{site.returnHigh}%</b> p.a.</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, padding: '0 2px' }}>
        <Progress value={(site.units - free) / site.units} />
        <div className="row between" style={{ fontSize: 10.5, marginTop: 5 }}>
          <span className="muted">{free} of {site.units} {meta.unitName}s available</span>
          <span className="row" style={{ gap: 3, fontWeight: 700 }}><Coin size={12} />+{site.pointsPerUnit}</span>
        </div>
      </div>
    </motion.button>
  )
}

/* ---------- site detail sheet (non-modal, map stays live above) ---------- */
function SiteSheet(props: {
  site: Site; full: boolean; setFull: (f: boolean) => void; selection: number[]
  unitState: (i: number) => UnitState; onToggle: (i: number) => void; onQuick: (d: 1 | -1) => void
  onClear: () => void; onClose: () => void; onSubscribe: () => void
}) {
  const { site, selection } = props
  const nav = useNavigate()
  const store = useStore()
  const meta = siteMeta(site)
  const township = townshipById(site.townshipId)
  const mine = store.mineFor(site).size
  const n = selection.length
  const total = n * site.pricePerUnit
  const gridRef = useRef<HTMLDivElement>(null)

  return (
    <motion.div
      className="sheet"
      style={{ zIndex: 45 }}
      initial={{ y: '100%' }}
      animate={{ y: 0, height: props.full ? '86%' : '54%' }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 32, stiffness: 300 }}
    >
      <motion.div
        className="sheet-grab"
        onPanEnd={(_, i) => {
          if (i.offset.y < -30) props.setFull(true)
          else if (i.offset.y > 30) (props.full ? props.setFull(false) : props.onClose())
        }}
        onTap={() => props.setFull(!props.full)}
      >
        <i />
      </motion.div>
      <button className="sheet-close" aria-label="Close" onClick={props.onClose}><X size={16} /></button>

      <div className="sheet-body" style={{ flex: 1, paddingBottom: 12 }}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="cushion" style={{ width: 104, height: 90, flexShrink: 0 }}><ProjectArt kind={site.kind} on={roofOf(site)} /></div>
          <div className="grow">
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <span className="pill">{createElement(meta.icon, { size: 12 })} {meta.label}</span>
              {mine > 0 && <span className="pill green"><Leaf size={11} /> You own {mine}</span>}
            </div>
            <h2 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 6 }}>{site.name}</h2>
            <div className="row small muted" style={{ gap: 4, marginTop: 2 }}><MapPin size={12} /> {township.name}, {township.area}, {township.state}</div>
          </div>
        </div>
        <p className="sub" style={{ marginTop: 12, fontSize: 13.5 }}>{site.description}</p>

        <div className="row" style={{ marginTop: 12, background: 'var(--green-soft)', borderRadius: 12, padding: '9px 12px', gap: 10 }}>
          <span className="live-dot" />
          <div className="grow small"><b>Generating now</b> · {(site.capacityMW * site.outputPct / 100).toFixed(site.capacityMW < 1 ? 3 : 1)} of {site.capacityMW} MW</div>
          <span className="small muted">Since {site.since}</span>
        </div>

        <div style={{ marginTop: 12 }}><ProjectFacts site={site} layout="grid" /></div>
        {site.kind === 'ev' && (
          <button className="btn outline block" style={{ marginTop: 12 }} onClick={() => { props.onClose(); nav('/charge') }}>
            <BatteryCharging size={17} /> Book a charging slot here
          </button>
        )}

        <div className="section" style={{ marginTop: 22, scrollMarginTop: 8 }} ref={gridRef}>
          <div className="row between" style={{ marginBottom: 4 }}>
            <h3 className="h2" style={{ fontSize: 16 }}>Select your {meta.unitName}s{site.blocks > 1 && <Info>{HELP.blocks}</Info>}</h3>
            <div className="stepper" aria-label="Quick pick">
              <button aria-label="Remove one" onClick={() => props.onQuick(-1)}><Minus size={15} /></button>
              <b>{n}</b>
              <button aria-label="Add one" onClick={() => props.onQuick(1)}><Plus size={15} /></button>
            </div>
          </div>
          <p className="muted small" style={{ marginBottom: 12 }}>
            Tap a unit here or on the map. Each {meta.unitName} is a {site.kwpPerUnit} kWp share of the site, about {Math.round(site.kwpPerUnit * 1300).toLocaleString()} kWh a year.<Info size={13}>{HELP.kwp}</Info>
          </p>
          <div className="units" style={{ gridTemplateColumns: `repeat(${unitGridCols(site)}, 1fr)` }}>
            {Array.from({ length: site.units }, (_, i) => {
              const st = props.unitState(i)
              return (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.92 }}
                  className={`unit ${st === 'free' ? '' : st}`}
                  aria-pressed={st === 'sel'}
                  aria-label={`${meta.unitName} ${unitLabel(site, i)}, ${st === 'free' ? 'available' : st === 'sel' ? 'selected' : st === 'mine' ? 'yours' : 'taken'}`}
                  onClick={() => props.onToggle(i)}
                >
                  <span>{st === 'sel' ? <Check size={15} strokeWidth={3} /> : st === 'mine' ? <Leaf size={14} /> : unitLabel(site, i)}</span>
                </motion.button>
              )
            })}
          </div>
          <div className="legend" style={{ marginTop: 12 }}>
            <span><i style={{ background: '#22385F' }} />Available</span>
            <span><i style={{ background: '#FF3100' }} />Selected</span>
            <span><i style={{ background: '#1F8A5B' }} />Yours</span>
            <span><i style={{ background: 'repeating-linear-gradient(45deg,#dddcd6 0 3px,#f2f2ee 3px 6px)' }} />Subscribed</span>
          </div>
        </div>

        <div className="row" style={{ marginTop: 20, gap: 10 }}>
          <div className="stat" style={{ flex: 1, padding: 12 }}><span className="ic sm green"><Users size={15} /></span><div><div className="v" style={{ fontSize: 15 }}>{site.homesPowered ? site.homesPowered.toLocaleString() : '120+'}</div><div className="l">{site.homesPowered ? <>Homes powered<Info size={12}>{HELP.homesPowered}</Info></> : 'EV drives / week'}</div></div></div>
          <div className="stat" style={{ flex: 1, padding: 12 }}><span className="ic sm"><Zap size={15} /></span><div><div className="v" style={{ fontSize: 15 }}>{site.outputPct}%</div><div className="l">Capacity today<Info size={12}>{HELP.capacityToday}</Info></div></div></div>
        </div>
      </div>

      {/* sticky summary */}
      <div style={{ padding: '12px 18px calc(16px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--line)', background: '#fff' }}>
        <AnimatePresence initial={false} mode="wait">
          {n > 0 ? (
            <motion.div key="sum" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="row between" style={{ marginBottom: 10, fontSize: 12.5 }}>
              <span><b>{n}</b> × {rm(site.pricePerUnit)}</span>
              <span className="muted">Est. return <b style={{ color: 'var(--ink)' }}>{site.returnLow}–{site.returnHigh}%</b> p.a.</span>
              <span className="row" style={{ gap: 4 }}><Coin size={14} /><b>+{n * site.pointsPerUnit}</b></span>
            </motion.div>
          ) : (
            <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="muted small" style={{ marginBottom: 10, textAlign: 'center' }}>
              Select at least one {meta.unitName} to participate
            </motion.div>
          )}
        </AnimatePresence>
        <div className="row" style={{ gap: 8 }}>
          {n > 0 && <button className="btn ghost" style={{ width: 50, padding: 0 }} aria-label="Clear selection" onClick={props.onClear}><X size={18} /></button>}
          <button className="btn primary grow" onClick={() => {
            if (n > 0) return props.onSubscribe()
            props.setFull(true)
            setTimeout(() => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250)
          }}>
            {n > 0 ? <>Participate · {rm(total)} <ArrowRight size={17} /></> : <>Choose your {meta.unitName}s <ArrowRight size={17} /></>}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

/* ---------- township picker ---------- */
function TownshipPicker({ open, onClose, current, onPick }: { open: boolean; onClose: () => void; current: string; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const match = (t: (typeof TOWNSHIPS)[number]) => !q || `${t.name} ${t.area} ${t.state}`.toLowerCase().includes(q.toLowerCase())
  return (
    <Sheet open={open} onClose={onClose} label="Select your township">
      <div className="eyebrow">Sime Darby Property</div>
      <h2 className="h2" style={{ fontSize: 18, marginTop: 4 }}>Select your township</h2>
      <p className="sub" style={{ marginTop: 4, marginBottom: 12, fontSize: 13 }}>{TOWNSHIPS.length} townships, each mapped from its real streets.</p>
      <label className="row" style={{ gap: 8, height: 44, padding: '0 14px', borderRadius: 999, border: '1.5px solid var(--line)', background: '#FAFAF8', marginBottom: 14 }}>
        <Search size={16} className="muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search township or area" style={{ border: 0, outline: 0, background: 'transparent', font: 'inherit', fontSize: 14, flex: 1, minWidth: 0 }} />
      </label>
      {STATES.map((st) => {
        const list = TOWNSHIPS.filter((t) => t.state === st && match(t))
        if (!list.length) return null
        return (
          <div key={st} style={{ marginBottom: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>{st}</div>
            <div className="col" style={{ gap: 8 }}>
              {list.map((t) => {
                const n = SITES.filter((s) => s.townshipId === t.id).length
                const on = t.id === current
                return (
                  <motion.button key={t.id} whileTap={{ scale: 0.985 }} onClick={() => onPick(t.id)} className="card tap"
                    style={{ padding: 8, borderColor: on ? 'var(--brand)' : undefined, boxShadow: on ? '0 0 0 1.5px var(--brand)' : undefined }}>
                    <div className="row">
                      <div className="cushion" style={{ width: 78, height: 58, flexShrink: 0 }}><TownPhoto township={t} /></div>
                      <div className="grow">
                        <div style={{ fontWeight: 800, fontSize: 14.5 }}>{t.name}</div>
                        <div className="muted small">{t.area}, {t.state}</div>
                        <div className="row" style={{ gap: 12, marginTop: 4, fontSize: 11, color: 'var(--ink-2)', fontWeight: 600 }}>
                          <span className="row" style={{ gap: 4 }}><Sun size={12} color="#E60000" /> {n} sites</span>
                          <span className="row" style={{ gap: 4 }}><Zap size={12} color="#E60000" /> {t.communityMWh} MWh/wk</span>
                        </div>
                      </div>
                      {on && <span className="ic sm solid"><Check size={15} strokeWidth={3} /></span>}
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </div>
        )
      })}
    </Sheet>
  )
}

/* ---------- confirm + success ---------- */
function ConfirmSheet({ open, site, units, onClose, onDone }: { open: boolean; site: Site; units: number[]; onClose: () => void; onDone: (go: boolean) => void }) {
  const store = useStore()
  const meta = siteMeta(site)
  const [method, setMethod] = useState('fpx')
  const [agree, setAgree] = useState(true)
  const [phase, setPhase] = useState<'review' | 'paying' | 'done'>('review')
  const [earned, setEarned] = useState(0)
  useEffect(() => { if (open) setPhase('review') }, [open])

  const total = units.length * site.pricePerUnit
  const pay = () => {
    setPhase('paying')
    setTimeout(() => {
      setEarned(store.subscribe(site.id, units))
      setPhase('done')
    }, 1100)
  }
  const methods = [
    { id: 'fpx', label: 'FPX Online Banking', icon: Landmark },
    { id: 'card', label: 'Debit / Credit Card', icon: CreditCard },
    { id: 'wallet', label: 'Solar Kita Wallet', icon: Wallet },
  ]

  return (
    <Sheet open={open} onClose={phase === 'done' ? () => onDone(false) : onClose} label="Confirm subscription">
      {phase === 'done' ? (
        <div style={{ textAlign: 'center', padding: '6px 0 4px' }}>
          <SuccessMark />
          <h2 className="h1" style={{ fontSize: 24, marginTop: 20 }}>Subscription confirmed</h2>
          <p className="sub" style={{ marginTop: 6 }}>
            You now own {units.length} {meta.unitName}{units.length > 1 ? 's' : ''} at <b>{site.name}</b>. They’re highlighted in green on the map.
          </p>
          <div className="kv" style={{ marginTop: 18, textAlign: 'left' }}>
            <div><span className="ic sm"><Star size={15} /></span><div><div className="k">Points earned</div><div className="v">+{earned}</div></div></div>
            <div><span className="ic sm green"><Leaf size={15} /></span><div><div className="k">Carbon savings</div><div className="v">{(units.length * site.co2PerUnit).toFixed(1)} t / yr</div></div></div>
          </div>
          <div className="col" style={{ gap: 10, marginTop: 20 }}>
            <button className="btn primary block" onClick={() => onDone(true)}>View my project <ArrowRight size={17} /></button>
            <button className="btn ghost block" onClick={() => onDone(false)}>Continue exploring</button>
          </div>
        </div>
      ) : (
        <>
          <h2 className="h2" style={{ fontSize: 20 }}>Review & confirm</h2>
          <div className="card" style={{ marginTop: 14, overflow: 'hidden' }}>
            <div className="row" style={{ padding: 12 }}>
              <div className="cushion" style={{ width: 62, height: 54, flexShrink: 0 }}><ProjectArt kind={site.kind} on={roofOf(site)} /></div>
              <div className="grow">
                <div style={{ fontWeight: 800 }}>{site.name}</div>
                <div className="muted small">{meta.label} · {meta.unitName}s {units.map((u) => unitLabel(site, u)).join(', ')}</div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--line)', padding: '6px 14px 8px', background: '#FCFCFA' }}>
              {[
                ['Subscription amount', rm(total)],
                ['Expected return', `${site.returnLow}–${site.returnHigh}% p.a.`],
                ['Reward points', `+${units.length * site.pointsPerUnit}`],
                ['Carbon savings', `~${(units.length * site.co2PerUnit).toFixed(1)} tCO₂e / yr`],
              ].map(([k, v]) => (
                <div key={k} className="row between" style={{ fontSize: 13, padding: '6px 0' }}>
                  <span className="muted">{k}</span><b>{v}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="eyebrow" style={{ margin: '20px 0 10px' }}>Payment method</div>
          <div className="col" style={{ gap: 8 }}>
            {methods.map((m) => (
              <button key={m.id} onClick={() => setMethod(m.id)} className="row" style={{ padding: 12, borderRadius: 14, border: `1.5px solid ${method === m.id ? 'var(--brand)' : 'var(--line)'}`, background: method === m.id ? '#FFF6F3' : '#fff', textAlign: 'left' }}>
                <span className="ic sm grey"><m.icon size={16} /></span>
                <span className="grow" style={{ fontWeight: 600, fontSize: 14 }}>{m.label}</span>
                <span style={{ width: 20, height: 20, borderRadius: 10, border: '2px solid', borderColor: method === m.id ? 'var(--brand)' : '#cfcfca', display: 'grid', placeItems: 'center' }}>
                  {method === m.id && <span style={{ width: 10, height: 10, borderRadius: 5, background: 'var(--brand)' }} />}
                </span>
              </button>
            ))}
          </div>
          <label className="row small" style={{ marginTop: 16, gap: 10, color: 'var(--ink-2)', cursor: 'pointer', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#E60000', marginTop: 0 }} />
            I agree to the subscription terms. Returns are projected based on energy savings and are not guaranteed.
          </label>
          <button className="btn primary block" style={{ marginTop: 16 }} disabled={!agree || phase === 'paying'} onClick={pay}>
            {phase === 'paying' ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2.5, borderColor: 'rgba(255,255,255,.3)', borderTopColor: '#fff' }} /> : <>Confirm & pay {rm(total)}</>}
          </button>
        </>
      )}
    </Sheet>
  )
}
