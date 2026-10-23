import { AnimatePresence, motion } from 'framer-motion'
import { BatteryCharging, CalendarClock, Check, ChevronDown, CircleX, Clock, MapPin, PlugZap, Sun, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { backendApi, type EvAvailability, type EvBooking } from '../api/backend'
import { asset } from '../asset'
import { Info } from '../components/Info'
import { Coin, Hero, Page, Rise } from '../components/ui'
import { KIND_PHOTOS, rm, SITES, TOWNSHIPS, townshipById } from '../data'
import { bookableDates, dayLabel, estimate, EV, fmtHour, hourKL, isPeak } from '../ev'
import { HELP } from '../help'
import { useStore } from '../store'

const STATUS: Record<EvBooking['status'], { label: string; tone: string }> = {
  booked: { label: 'Booked', tone: 'blue' },
  charging: { label: 'Charging', tone: 'green' },
  awaiting_payment: { label: 'Payment due', tone: '' },
  paid: { label: 'Paid', tone: 'grey' },
  cancelled: { label: 'Cancelled', tone: 'grey' },
  missed: { label: 'Missed', tone: 'grey' },
}

const whenLabel = (b: EvBooking) => {
  const d = new Date(b.startsAt)
  const day = d.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kuala_Lumpur' })
  const h = hourKL(b.startsAt)
  return `${day} · ${fmtHour(h)}–${fmtHour(h + b.hours)}`
}

export default function Charge() {
  const store = useStore()
  const dates = useMemo(() => bookableDates(), [])
  const [townId, setTownId] = useState(store.township)
  const stations = useMemo(() => SITES.filter((s) => s.kind === 'ev' && s.townshipId === townId), [townId])
  const [siteId, setSiteId] = useState('')
  const [date, setDate] = useState(dates[0])
  const [hours, setHours] = useState(2)
  const [startHour, setStartHour] = useState<number | null>(null)
  const [avail, setAvail] = useState<EvAvailability | null>(null)
  const [bookings, setBookings] = useState<EvBooking[]>([])
  const [setup, setSetup] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const station = stations.find((s) => s.id === siteId) ?? stations[0]
  useEffect(() => { setSiteId(stations[0]?.id ?? ''); setStartHour(null) }, [stations])

  const loadBookings = useCallback(() => {
    if (!store.online) return
    backendApi.evBookings().then((r) => { setSetup(r.setup); setBookings(r.bookings) }).catch(() => {})
  }, [store.online])
  useEffect(() => { loadBookings() }, [loadBookings])

  const loadAvail = useCallback(() => {
    if (!store.online || !station) { setAvail(null); return }
    backendApi.evAvailability(station.id, date).then(setAvail).catch((err) => { setAvail(null); if (/ev\.sql/.test(String(err?.message))) setSetup(false) })
  }, [store.online, station, date])
  useEffect(() => { loadAvail() }, [loadAvail])
  useEffect(() => { setStartHour(null) }, [date, siteId, hours])

  /** a start hour works if every hour of the booking has a free bay and is still ahead */
  const canStart = (h: number) => {
    if (!avail || h + hours > EV.closeHour) return false
    for (let i = 0; i < hours; i++) {
      const slot = avail.hours.find((x) => x.hour === h + i)
      if (!slot || slot.free === 0 || slot.past) return false
    }
    return true
  }

  const est = startHour !== null ? estimate(startHour, hours) : null

  const act = async (key: string, fn: () => Promise<{ bookings: EvBooking[]; me: Parameters<typeof store.applyMe>[0] }>, done: string) => {
    setBusy(key)
    try {
      const res = await fn()
      setBookings(res.bookings)
      store.applyMe(res.me)
      store.toast(done)
      loadAvail()
      return true
    } catch (err) {
      store.toast(err instanceof Error ? err.message : 'Something went wrong')
      return false
    } finally {
      setBusy(null)
    }
  }

  const book = async () => {
    if (!station || startHour === null) return
    if (await act('book', () => backendApi.evBook(station.id, date, startHour, hours), `Booked ${fmtHour(startHour)}–${fmtHour(startHour + hours)} at ${station.name}`)) {
      setStartHour(null)
      document.getElementById('bookings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const active = bookings.filter((b) => b.status === 'booked' || b.status === 'charging' || b.status === 'awaiting_payment')
  const past = bookings.filter((b) => !active.includes(b))

  return (
    <Page>
      <Hero photo={asset('photos/solar/ev_charger.jpg')} eyebrow="Solar EV charging" title="Charge with the" accent="sun"
        sub={`Book a bay at your township’s solar-powered EV station. One price all day, ${rm(EV.pricePerKwh, 2)} per kWh, and extra points when you charge in the solar peak.`} />

      {!store.online && <Rise className="section overlap"><div className="card pad small">EV bookings need the Solar Kita server. Sign in with the server running to book a bay.</div></Rise>}
      {store.online && !setup && <Rise className="section overlap"><div className="card pad small">EV charging isn’t set up on the database yet. Run <b>server/ev.sql</b> in the Supabase SQL Editor, then reload.</div></Rise>}

      {store.online && setup && (
        <Rise className="section overlap">
          <div className="card raised pad">
            <h2 className="h2">Book a charging bay</h2>

            {/* where */}
            <div className="ev-label"><MapPin size={13} /> Where you live</div>
            <div className="field-box" style={{ height: 46 }}>
              <MapPin size={16} />
              <select aria-label="Township" value={townId} onChange={(e) => setTownId(e.target.value)}>
                {TOWNSHIPS.map((t) => <option key={t.id} value={t.id}>{t.name}{SITES.some((s) => s.kind === 'ev' && s.townshipId === t.id) ? '' : ' (no station yet)'}</option>)}
              </select>
              <ChevronDown size={16} />
            </div>

            <div className="ev-label">Station</div>
            {stations.length === 0
              ? <div className="muted small">{townshipById(townId).name} doesn’t have an EV station yet. Choose a nearby township.</div>
              : (
                <div className="col" style={{ gap: 8 }}>
                  {stations.map((s) => (
                    <button key={s.id} className={`ev-station${station?.id === s.id ? ' on' : ''}`} onClick={() => setSiteId(s.id)}>
                      <img src={KIND_PHOTOS.ev.thumb} alt="" />
                      <span className="grow" style={{ textAlign: 'left' }}>
                        <b>{s.name}</b>
                        <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>{s.units} bays · {EV.chargerKw} kW AC · solar canopy<Info size={11}>{HELP.evBay}</Info></span>
                      </span>
                      {station?.id === s.id && <Check size={18} color="var(--brand)" />}
                    </button>
                  ))}
                </div>
              )}

            {station && (
              <>
                {/* when */}
                <div className="ev-label"><CalendarClock size={13} /> Day</div>
                <div className="hscroll" style={{ margin: 0, padding: '2px 0 6px', gap: 6 }}>
                  {dates.map((d, i) => (
                    <button key={d} className={`ev-chip${date === d ? ' on' : ''}`} onClick={() => setDate(d)}>{dayLabel(d, i)}</button>
                  ))}
                </div>

                <div className="ev-label"><Clock size={13} /> How long</div>
                <div className="row" style={{ gap: 6 }}>
                  {Array.from({ length: EV.maxHours }, (_, i) => i + 1).map((h) => (
                    <button key={h} className={`ev-chip${hours === h ? ' on' : ''}`} onClick={() => setHours(h)}>{h} hour{h > 1 ? 's' : ''}</button>
                  ))}
                </div>

                <div className="ev-label" style={{ justifyContent: 'space-between' }}>
                  <span className="row" style={{ gap: 5 }}><Zap size={13} /> Start time</span>
                  <span className="ev-peak-key"><Sun size={12} /> Solar peak · {EV.peakPointsPerKwh / EV.offPeakPointsPerKwh}× points<Info size={11}>{HELP.evPeak}</Info></span>
                </div>
                <div className="ev-hours">
                  {(avail?.hours ?? []).map((x) => {
                    const ok = canStart(x.hour)
                    const inSel = startHour !== null && x.hour >= startHour && x.hour < startHour + hours
                    return (
                      <button key={x.hour} disabled={!ok} onClick={() => setStartHour(x.hour)}
                        className={`ev-hour${x.peak ? ' peak' : ''}${inSel ? ' on' : ''}${startHour === x.hour ? ' first' : ''}`}>
                        <b>{fmtHour(x.hour)}</b>
                        <span>{x.past ? 'Passed' : x.free === 0 ? 'Full' : `${x.free} free`}</span>
                        {x.peak && <Sun size={11} className="sun" />}
                      </button>
                    )
                  })}
                  {!avail && <div className="muted small">Loading times…</div>}
                </div>

                {/* summary */}
                <AnimatePresence>
                  {est && startHour !== null && (
                    <motion.div className="ev-summary" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <div className="row between" style={{ alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{dayLabel(date, dates.indexOf(date))} · {fmtHour(startHour)}–{fmtHour(startHour + hours)}</div>
                          <div className="muted small">{station.name}</div>
                        </div>
                        {est.peakKwh > 0 && <span className="pill gold-pill"><Sun size={11} /> Solar peak</span>}
                      </div>
                      <div className="grid-3" style={{ marginTop: 12 }}>
                        <div className="ev-est"><span>Energy<Info size={11}>{HELP.evEstimate}</Info></span><b>~{est.kwh} kWh</b></div>
                        <div className="ev-est"><span>Cost<Info size={11}>{HELP.evPrice}</Info></span><b>~{rm(est.cost, 2)}</b></div>
                        <div className="ev-est"><span>Points</span><b className="row" style={{ gap: 4 }}><Coin size={14} />~{est.points}</b></div>
                      </div>
                      <p className="muted small" style={{ marginTop: 10 }}>No payment now. You pay after charging for the energy actually used.<Info size={12}>{HELP.evPayAfter}</Info></p>
                      <button className="btn primary block" style={{ marginTop: 12 }} disabled={busy === 'book'} onClick={book}>
                        <PlugZap size={17} /> {busy === 'book' ? 'Booking…' : 'Book this bay'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
                {startHour === null && avail && <p className="muted small" style={{ marginTop: 10 }}>Pick a start time. Hours with a <Sun size={11} style={{ verticalAlign: -1 }} /> are the solar peak, when charging earns the most points.</p>}
              </>
            )}
          </div>
        </Rise>
      )}

      {/* ---- bookings ---- */}
      {store.online && setup && (
        <Rise className="section" id="bookings">
          <div className="section-head"><h2 className="h2">Your bookings</h2>{active.length > 0 && <span className="muted small">{active.length} active</span>}</div>
          {active.length === 0 && <div className="card pad muted small" style={{ textAlign: 'center' }}>No upcoming bookings. Book a bay above.</div>}
          <div className="col" style={{ gap: 10 }}>
            {active.map((b) => <BookingCard key={b.id} b={b} busy={busy} act={act} />)}
          </div>
          {past.length > 0 && (
            <>
              <div className="eyebrow" style={{ margin: '18px 0 8px' }}>History</div>
              <div className="card" style={{ padding: '2px 16px' }}>
                {past.map((b) => (
                  <div key={b.id} className="list-row">
                    <span className={`ic sm ${b.status === 'paid' ? 'green' : 'grey'}`}>{b.status === 'paid' ? <Check size={15} /> : <CircleX size={15} />}</span>
                    <div className="grow">
                      <div className="title">{b.siteName}</div>
                      <div className="desc">{whenLabel(b)} · {b.status === 'paid' ? `${b.energyKwh?.toFixed(1)} kWh · ${rm(b.amount ?? 0, 2)}` : STATUS[b.status].label}</div>
                    </div>
                    {b.status === 'paid' && <span className="row" style={{ gap: 4, fontWeight: 800, fontSize: 13 }}><Coin size={14} />+{b.points}</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </Rise>
      )}

      {/* ---- how it works ---- */}
      <Rise className="section">
        <div className="section-head"><h2 className="h2">How it works</h2></div>
        <div className="card" style={{ padding: '4px 16px' }}>
          {[
            { icon: MapPin, t: 'Pick your station', d: 'Choose where you live and one of its solar-powered EV stations.' },
            { icon: CalendarClock, t: 'Book a time', d: `Up to ${EV.daysAhead} days ahead, 1 to ${EV.maxHours} hours, ${fmtHour(EV.openHour)}–${fmtHour(EV.closeHour)}. A free bay is held for you.` },
            { icon: BatteryCharging, t: 'Charge', d: 'Tap Start charging when you plug in (from 15 minutes before your slot), and Finish when you’re done.' },
            { icon: Coin, t: 'Pay after, earn points', d: `${rm(EV.pricePerKwh, 2)} per kWh at any hour. ${EV.peakPointsPerKwh} points per kWh in the solar peak (${fmtHour(EV.peakStart)}–${fmtHour(EV.peakEnd)}), 1 per ${1 / EV.offPeakPointsPerKwh} kWh otherwise.` },
          ].map((r) => (
            <div key={r.t} className="list-row" style={{ alignItems: 'flex-start' }}>
              <span className="ic sm">{r.icon === Coin ? <Coin size={16} /> : <r.icon size={16} />}</span>
              <div className="grow"><div className="title">{r.t}</div><div className="desc">{r.d}</div></div>
            </div>
          ))}
        </div>
      </Rise>
    </Page>
  )
}

function BookingCard({ b, busy, act }: {
  b: EvBooking
  busy: string | null
  act: (key: string, fn: () => ReturnType<typeof backendApi.evAction>, done: string) => Promise<boolean>
}) {
  const start = new Date(b.startsAt).getTime()
  const canStartNow = Date.now() >= start - 15 * 60_000
  const s = STATUS[b.status]
  const peakHours = Array.from({ length: b.hours }, (_, i) => hourKL(b.startsAt) + i).filter(isPeak).length
  return (
    <motion.div layout className={`card pad ev-booking ${b.status}`}>
      <div className="row between">
        <span className={`pill ${s.tone}`}>{b.status === 'charging' ? <><span className="live-dot" style={{ width: 6, height: 6 }} /> Charging</> : s.label}</span>
        <span className="muted small">Bay {b.bay}</span>
      </div>
      <div style={{ fontWeight: 800, fontSize: 15, marginTop: 10 }}>{b.siteName}</div>
      <div className="muted small">{whenLabel(b)}{peakHours > 0 && <> · <Sun size={11} style={{ verticalAlign: -1, color: '#E08600' }} /> {peakHours} solar-peak hour{peakHours > 1 ? 's' : ''}</>}</div>

      {b.status === 'awaiting_payment' && (
        <div className="grid-3" style={{ marginTop: 12 }}>
          <div className="ev-est"><span>Energy</span><b>{b.energyKwh?.toFixed(1)} kWh</b></div>
          <div className="ev-est"><span>Bill</span><b>{rm(b.amount ?? 0, 2)}</b></div>
          <div className="ev-est"><span>Points</span><b className="row" style={{ gap: 4 }}><Coin size={14} />+{b.points}</b></div>
        </div>
      )}

      <div className="row" style={{ gap: 8, marginTop: 14 }}>
        {b.status === 'booked' && (
          <>
            <button className="btn ghost sm" disabled={busy === b.id} onClick={() => act(b.id, () => backendApi.evAction(b.id, 'cancel'), 'Booking cancelled')}>Cancel</button>
            {canStartNow
              ? <button className="btn primary sm grow" disabled={busy === b.id} onClick={() => act(b.id, () => backendApi.evAction(b.id, 'start'), 'Charging started')}><BatteryCharging size={15} /> Start charging</button>
              : <button className="btn dark sm grow" disabled={busy === b.id} onClick={() => act(b.id, () => backendApi.evAction(b.id, 'start', true), 'Charging started (demo)')} title="Prototype: start before your slot"><BatteryCharging size={15} /> Start now (demo)</button>}
          </>
        )}
        {b.status === 'charging' && (
          <button className="btn primary sm grow" disabled={busy === b.id} onClick={() => act(b.id, () => backendApi.evAction(b.id, 'finish'), 'Charging finished')}><Check size={15} /> Finish charging</button>
        )}
        {b.status === 'awaiting_payment' && (
          <button className="btn primary sm grow" disabled={busy === b.id} onClick={() => act(b.id, () => backendApi.evAction(b.id, 'pay'), `Paid ${rm(b.amount ?? 0, 2)} · +${b.points} points`)}>Pay {rm(b.amount ?? 0, 2)}</button>
        )}
      </div>
      {b.status === 'charging' && <div className="ev-charging-bar"><i /></div>}
    </motion.div>
  )
}
