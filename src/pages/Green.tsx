import { AnimatePresence, motion } from 'framer-motion'
import { Bike, Check, Footprints, Fuel, Gauge, Leaf, MapPin, Navigation, Play, Route, ShieldCheck, Square, Timer, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Coin, Count, Hero, Page, Progress, Rise, Seg, Sheet, SuccessMark } from '../components/ui'
import { asset } from '../asset'
import { townshipById } from '../data'
import { checkTrip, demoRoute, fmtDuration, GREEN, greenPointsToday, haversineKm, type GpsPoint, type Trip, type TripMode } from '../green'
import { useStore, type TripResult } from '../store'
import { Info } from '../components/Info'
import { HELP } from '../help'

const MODES: Record<TripMode, { label: string; icon: typeof Footprints; verb: string }> = {
  walk: { label: 'Walk', icon: Footprints, verb: 'walked' },
  cycle: { label: 'Cycle', icon: Bike, verb: 'cycled' },
}

type Phase = 'idle' | 'tracking' | 'saving'

export default function Green() {
  const store = useStore()
  const town = townshipById(store.township)
  const [mode, setMode] = useState<TripMode>('walk')
  const [phase, setPhase] = useState<Phase>('idle')
  const [source, setSource] = useState<'gps' | 'demo'>('gps')
  const [path, setPath] = useState<GpsPoint[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [startedAt, setStartedAt] = useState(0)
  const [gpsNote, setGpsNote] = useState<string | null>(null)
  const [result, setResult] = useState<TripResult | null>(null)
  const watch = useRef<number | null>(null)
  const replay = useRef<number | null>(null)

  const stopSensors = () => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current)
    if (replay.current !== null) window.clearInterval(replay.current)
    watch.current = null
    replay.current = null
  }
  useEffect(() => stopSensors, [])

  // a ticking clock while recording with GPS
  useEffect(() => {
    if (phase !== 'tracking' || source !== 'gps') return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [phase, source])

  const startGps = () => {
    if (!('geolocation' in navigator)) { store.toast('This device has no GPS. Try the demo route.'); return }
    setSource('gps'); setPath([]); setStartedAt(Date.now()); setNow(Date.now()); setGpsNote('Waiting for GPS…'); setPhase('tracking')
    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.accuracy > 50) { setGpsNote(`Weak GPS signal (±${Math.round(pos.coords.accuracy)} m)`); return }
        setGpsNote(null)
        setPath((p) => [...p, { lat: pos.coords.latitude, lon: pos.coords.longitude, t: pos.timestamp }])
      },
      (err) => {
        stopSensors(); setPhase('idle')
        store.toast(err.code === err.PERMISSION_DENIED ? 'Location permission is off. Allow it to track a trip.' : 'Couldn’t read your location. Try the demo route.')
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    )
  }

  /** replays a realistic loop near the township centre in a few seconds */
  const startDemo = () => {
    const route = demoRoute(town, mode)
    setSource('demo'); setPath([route[0]]); setStartedAt(route[0].t); setGpsNote(null); setPhase('tracking')
    let i = 1
    const step = Math.max(1, Math.ceil(route.length / 80))
    replay.current = window.setInterval(() => {
      i = Math.min(route.length, i + step)
      setPath(route.slice(0, i))
      setNow(route[i - 1].t)
      if (i >= route.length && replay.current !== null) { window.clearInterval(replay.current); replay.current = null }
    }, 60)
  }

  const cancel = () => { stopSensors(); setPhase('idle'); setPath([]) }

  const finish = async () => {
    stopSensors()
    const pts = source === 'gps' && path.length ? [...path, { ...path[path.length - 1], t: Date.now() }] : path
    if (pts.length < 2) { store.toast('No GPS points were recorded yet.'); setPhase('idle'); return }
    setPhase('saving')
    try {
      setResult(await store.logTrip(mode, pts, source))
      setPath([])
      setPhase('idle')
    } catch (err) {
      store.toast(err instanceof Error ? err.message : 'Couldn’t save this trip')
      setPhase('tracking')
    }
  }

  const elapsedPath = source === 'gps' && path.length ? [...path, { ...path[path.length - 1], t: now }] : path
  const live = checkTrip(elapsedPath, mode, town, town.name)
  const elapsedMin = source === 'gps' ? (now - startedAt) / 60_000 : live.minutes
  const today = greenPointsToday(store.trips)
  const capLeft = Math.max(0, GREEN.dailyCap - today)
  const fromCentre = path.length ? haversineKm(path[path.length - 1], town) : null

  const week = useMemo(() => {
    const since = Date.now() - 7 * 86_400_000
    const t = store.trips.filter((x) => x.at >= since)
    return { km: t.reduce((a, x) => a + x.distanceKm, 0), co2: t.reduce((a, x) => a + x.co2Kg, 0), rm: t.reduce((a, x) => a + x.petrolL, 0) * GREEN.petrolPrice, n: t.length }
  }, [store.trips])
  const total = useMemo(() => ({ km: store.trips.reduce((a, x) => a + x.distanceKm, 0), pts: store.trips.reduce((a, x) => a + x.points, 0) }), [store.trips])

  const busy = phase !== 'idle'
  const ModeIcon = MODES[mode].icon

  return (
    <Page>
      <Hero photo={asset('photos/elmina_2.jpg')} eyebrow="Walk & cycle. Skip the car." title="Go" accent="green"
        sub={`Earn points for every kilometre you walk or cycle around ${town.name}. Less petrol, cleaner air.`} />

      {/* ---- today ---- */}
      <Rise className="section overlap">
        <div className="card raised pad">
          <div className="row between">
            <div>
              <div className="muted small" style={{ fontWeight: 600 }}>Green points today<Info size={13}>{HELP.greenDaily}</Info></div>
              <div className="row" style={{ gap: 6, alignItems: 'baseline' }}>
                <span style={{ fontSize: 28, fontWeight: 800 }}><Count value={today} /></span>
                <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>/ {GREEN.dailyCap}</span>
              </div>
            </div>
            <span className="pill green"><Leaf size={12} /> {capLeft ? `${capLeft} left today` : 'Daily max reached'}</span>
          </div>
          <div style={{ marginTop: 10 }}><Progress value={today / GREEN.dailyCap} /></div>
          <div className="grid-3" style={{ marginTop: 14 }}>
            <Mini icon={<Route size={15} />} v={`${week.km.toFixed(1)} km`} l="This week" />
            <Mini icon={<Leaf size={15} />} v={`${week.co2.toFixed(1)} kg`} l={<>CO₂ avoided<Info size={11}>{HELP.greenSavings}</Info></>} />
            <Mini icon={<Fuel size={15} />} v={`RM ${week.rm.toFixed(2)}`} l={<>Petrol saved<Info size={11}>{HELP.greenSavings}</Info></>} />
          </div>
        </div>
      </Rise>

      {/* ---- tracker ---- */}
      <Rise className="section">
        <div className="card raised pad">
          <div className="row between" style={{ gap: 10 }}>
            <h2 className="h2">{busy ? (source === 'demo' ? 'Demo route' : 'Recording') : 'Start a trip'}</h2>
            <div style={{ opacity: busy ? 0.5 : 1, pointerEvents: busy ? 'none' : undefined }}>
              <Seg id="green-mode" options={['Walk', 'Cycle']} value={MODES[mode].label} onChange={(v) => setMode(v === 'Walk' ? 'walk' : 'cycle')} />
            </div>
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            1 point per {GREEN[mode].kmPerPoint} km {mode === 'walk' ? 'walked' : 'cycled'} · up to {GREEN.dailyCap} points a day · within {GREEN.areaRadiusKm} km of {town.name}<Info size={13}>{HELP.greenRate} {HELP.greenArea}</Info>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {!busy ? (
              <motion.div key="idle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="col" style={{ alignItems: 'center', padding: '22px 0 6px' }}>
                <motion.button whileTap={{ scale: 0.94 }} onClick={startGps} aria-label={`Start ${MODES[mode].label.toLowerCase()}`} className="green-go">
                  <ModeIcon size={30} />
                  <span>Start {MODES[mode].label.toLowerCase()}</span>
                </motion.button>
                <div className="muted small" style={{ marginTop: 14, textAlign: 'center' }}>Uses your phone’s GPS. Keep the app open while you go.</div>
                <button className="link" style={{ marginTop: 8 }} onClick={startDemo}><Play size={13} /> No GPS here? Try a demo route<Info size={13}>{HELP.greenDemo}</Info></button>
              </motion.div>
            ) : (
              <motion.div key="live" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="grid-2" style={{ marginTop: 14 }}>
                  <Big icon={<Route size={16} />} v={live.km.toFixed(2)} unit="km" l="Distance" />
                  <Big icon={<Timer size={16} />} v={fmtDuration(elapsedMin)} l="Time" />
                  <Big icon={<Gauge size={16} />} v={live.kmh.toFixed(1)} unit="km/h" l="Avg speed" />
                  <Big icon={<Coin size={16} />} v={String(Math.min(live.points, capLeft))} unit="pts" l={live.points > capLeft ? 'Daily max' : 'Points so far'} />
                </div>
                <RouteView path={path} mode={mode} />
                <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {gpsNote && <span className="pill grey"><Navigation size={12} /> {gpsNote}</span>}
                  {fromCentre !== null && (
                    fromCentre <= GREEN.areaRadiusKm
                      ? <span className="pill green"><MapPin size={12} /> Inside {town.name}<Info size={12}>{HELP.greenArea}</Info></span>
                      : <span className="pill"><MapPin size={12} /> {fromCentre.toFixed(1)} km from {town.name}</span>
                  )}
                  {source === 'demo' && <span className="pill grey"><Play size={12} /> Demo route</span>}
                </div>
                {live.issue && phase === 'tracking' && <div className="muted small" style={{ marginTop: 8 }}>{live.issue}</div>}
                <div className="grid-2" style={{ marginTop: 14 }}>
                  <button className="btn ghost" onClick={cancel} disabled={phase === 'saving'}><X size={16} /> Cancel</button>
                  <button className="btn primary" onClick={finish} disabled={phase === 'saving'}>
                    {phase === 'saving' ? 'Verifying…' : <><Square size={14} fill="#fff" /> Finish &amp; claim</>}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Rise>

      {/* ---- how it works ---- */}
      <Rise className="section">
        <div className="section-head"><h2 className="h2">How it works</h2></div>
        <div className="card" style={{ padding: '4px 16px' }}>
          {[
            { icon: Navigation, t: 'Track your route', d: 'Start a walk or ride and the app records your GPS route.' },
            { icon: ShieldCheck, t: 'Verified on our server', d: `Distance and speed are checked: walking ${GREEN.walk.minKmh}-${GREEN.walk.maxKmh} km/h, cycling ${GREEN.cycle.minKmh}-${GREEN.cycle.maxKmh} km/h, mostly within ${GREEN.areaRadiusKm} km of your township.` },
            { icon: Coin, t: 'Earn points', d: `1 point for every ${GREEN.walk.kmPerPoint} km walked or ${GREEN.cycle.kmPerPoint} km cycled in a trip, up to ${GREEN.dailyCap} a day. Spend them in Rewards.` },
            { icon: Leaf, t: 'See your impact', d: `Each km you don’t drive saves about ${GREEN.co2KgPerKm} kg CO₂ and ${GREEN.petrolLPerKm} L of petrol.` },
          ].map((r) => (
            <div key={r.t} className="list-row" style={{ alignItems: 'flex-start' }}>
              <span className="ic sm green">{r.icon === Coin ? <Coin size={16} /> : <r.icon size={16} />}</span>
              <div className="grow"><div className="title">{r.t}</div><div className="desc">{r.d}</div></div>
            </div>
          ))}
        </div>
      </Rise>

      {/* ---- history ---- */}
      <Rise className="section">
        <div className="section-head">
          <h2 className="h2">Your trips</h2>
          {store.trips.length > 0 && <span className="muted small">{total.km.toFixed(1)} km · {total.pts.toLocaleString()} pts</span>}
        </div>
        {store.trips.length === 0
          ? <div className="card pad muted small" style={{ textAlign: 'center' }}>No trips yet. Your first walk is a great place to start.</div>
          : <div className="card" style={{ padding: '2px 16px' }}>{store.trips.map((t) => <TripRow key={t.id} t={t} />)}</div>}
      </Rise>

      <Sheet open={!!result} onClose={() => setResult(null)} label="Trip saved">
        {result && <ResultView r={result} onDone={() => setResult(null)} />}
      </Sheet>
    </Page>
  )
}

function Mini({ icon, v, l }: { icon: React.ReactNode; v: string; l: React.ReactNode }) {
  return (
    <div className="col" style={{ gap: 4, padding: '10px 8px', borderRadius: 14, background: 'var(--green-soft)', alignItems: 'center', textAlign: 'center' }}>
      <span style={{ color: 'var(--green)' }}>{icon}</span>
      <b style={{ fontSize: 13.5 }}>{v}</b>
      <span className="muted" style={{ fontSize: 10.5, fontWeight: 600 }}>{l}</span>
    </div>
  )
}

function Big({ icon, v, unit, l }: { icon: React.ReactNode; v: string; unit?: string; l: string }) {
  return (
    <div className="stat" style={{ padding: 12 }}>
      <span className="ic sm green">{icon}</span>
      <div>
        <div className="v num">{v}{unit && <small>{unit}</small>}</div>
        <div className="l">{l}</div>
      </div>
    </div>
  )
}

/** the recorded route, scaled to fit */
function RouteView({ path, mode }: { path: GpsPoint[]; mode: TripMode }) {
  const W = 320, H = 150, P = 14
  if (path.length < 2) {
    return <div className="green-route" style={{ display: 'grid', placeItems: 'center' }}><span className="muted small">Your route will appear here</span></div>
  }
  const kx = Math.cos((path[0].lat * Math.PI) / 180)
  const xs = path.map((p) => p.lon * kx), ys = path.map((p) => -p.lat)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const s = Math.min((W - 2 * P) / Math.max(x1 - x0, 1e-6), (H - 2 * P) / Math.max(y1 - y0, 1e-6))
  const ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2
  const pt = (i: number) => [ox + (xs[i] - x0) * s, oy + (ys[i] - y0) * s] as const
  const d = path.map((_, i) => `${i ? 'L' : 'M'}${pt(i)[0].toFixed(1)} ${pt(i)[1].toFixed(1)}`).join('')
  const [sx, sy] = pt(0), [ex, ey] = pt(path.length - 1)
  return (
    <div className="green-route">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" aria-label="Your route">
        <path d={d} fill="none" stroke={mode === 'walk' ? '#1F8A5B' : '#3B6FD8'} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={sx} cy={sy} r={5} fill="#fff" stroke="#1d2127" strokeWidth={2} />
        <circle cx={ex} cy={ey} r={7} fill="#F20000" stroke="#fff" strokeWidth={2.5} />
      </svg>
    </div>
  )
}

function TripRow({ t }: { t: Trip }) {
  const Icon = MODES[t.mode].icon
  const when = new Date(t.at)
  return (
    <div className="list-row">
      <span className={`ic sm ${t.mode === 'walk' ? 'green' : 'blue'}`}><Icon size={16} /></span>
      <div className="grow">
        <div className="title">{MODES[t.mode].label} · {t.distanceKm.toFixed(2)} km{t.source === 'demo' ? <span className="muted" style={{ fontWeight: 600 }}> · demo</span> : null}</div>
        <div className="desc">
          {when.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}, {when.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' })} · {fmtDuration(t.durationMin)} · {t.co2Kg.toFixed(2)} kg CO₂ saved
        </div>
      </div>
      <span className="row" style={{ gap: 4, fontWeight: 800, fontSize: 13, color: t.points ? 'var(--ink)' : 'var(--muted)' }}><Coin size={14} />+{t.points}</span>
    </div>
  )
}

function ResultView({ r, onDone }: { r: TripResult; onDone: () => void }) {
  const t = r.trip
  return (
    <div style={{ textAlign: 'center', paddingBottom: 6 }}>
      <SuccessMark />
      <h2 className="h1" style={{ fontSize: 24, marginTop: 16 }}>+{t.points} points</h2>
      <p className="sub" style={{ marginTop: 6 }}>
        You {MODES[t.mode].verb} <b>{t.distanceKm.toFixed(2)} km</b> in {fmtDuration(t.durationMin)} instead of driving.
      </p>
      {!t.points && !r.capped && <p className="muted small" style={{ marginTop: 6 }}>Points start at {GREEN[t.mode].kmPerPoint} km per trip. This one still counts towards your impact.</p>}
      {r.capped && <p className="muted small" style={{ marginTop: 6 }}>You’ve reached today’s {GREEN.dailyCap}-point limit, so this trip earned {t.points ? 'part of its' : 'no'} points. It still counts towards your impact.</p>}
      <div className="grid-3" style={{ marginTop: 18 }}>
        <Mini icon={<Leaf size={15} />} v={`${t.co2Kg.toFixed(2)} kg`} l="CO₂ avoided" />
        <Mini icon={<Fuel size={15} />} v={`${t.petrolL.toFixed(2)} L`} l="Petrol saved" />
        <Mini icon={<Check size={15} />} v={`RM ${(t.petrolL * GREEN.petrolPrice).toFixed(2)}`} l="Fuel cost saved" />
      </div>
      <button className="btn primary block" style={{ marginTop: 18 }} onClick={onDone}>Done</button>
    </div>
  )
}
