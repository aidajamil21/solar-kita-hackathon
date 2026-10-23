import { AnimatePresence, motion } from 'framer-motion'
import { CalendarClock, Check, CircleStop, CreditCard, FastForward, Flame, Gift, Landmark, Pause, PiggyBank, Play, RefreshCw, Repeat, ShieldCheck, Sun, Wallet } from 'lucide-react'
import { createElement, useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, backendApi, type PlanSummary } from '../api/backend'
import { asset } from '../asset'
import { Coin, Hero, Page, Progress, Rise, Sheet, SuccessMark } from '../components/ui'
import { KINDS, MONTHS, rm, siteMeta, SITES, townshipById } from '../data'
import { PLAN, pointsFor, projection, totalBack } from '../plan'
import { useStore } from '../store'
import { Info } from '../components/Info'
import { HELP } from '../help'

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`

export default function Plan() {
  const store = useStore()
  const town = townshipById(store.township)
  const farms = useMemo(() => SITES.filter((s) => s.townshipId === town.id && (s.kind === 'subscription' || s.kind === 'investment')), [town.id])

  const [data, setData] = useState<PlanSummary | null>(null)
  const [loading, setLoading] = useState(store.online)
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState<null | 'start' | 'amount' | 'stop'>(null)

  const load = useCallback(() => {
    if (!store.online) return
    setLoading(true)
    backendApi.getPlan().then(setData).catch((err) => store.toast(err instanceof Error ? err.message : 'Couldn’t load your plan')).finally(() => setLoading(false))
  }, [store])
  useEffect(() => { load() }, [load])

  /** run a plan change and apply what the server sent back */
  const change = async (fn: () => ReturnType<typeof backendApi.updatePlan>, done?: string) => {
    setBusy(true)
    try {
      const res = await fn()
      setData(res)
      store.applyMe(res.me)
      if (done) store.toast(done)
      return true
    } catch (err) {
      store.toast(err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong')
      return false
    } finally {
      setBusy(false)
    }
  }

  const plan = data?.plan && data.plan.status !== 'cancelled' ? data.plan : null
  const hasHistory = !!data?.payments?.length

  return (
    <Page>
      <Hero photo={asset('photos/solar_farm_golden_hour.jpg')} eyebrow="Monthly Solar Builder" title="Build your" accent="solar share"
        sub="Put aside a fixed amount each month to support your township’s solar farm. It comes back to you over 10 years, plus 3% a year, and earns points along the way." />

      {loading && <Rise className="section overlap"><div className="card pad muted small" style={{ textAlign: 'center' }}>Loading your plan…</div></Rise>}

      {!loading && data && !data.setup && (
        <Rise className="section overlap"><div className="card pad small">The Solar Builder Plan isn’t set up on the database yet. Run <b>server/plan.sql</b> in the Supabase SQL Editor, then reload.</div></Rise>
      )}

      {!loading && plan && data?.totals && (
        <PlanStatus data={data} busy={busy}
          onAmount={() => setSheet('amount')}
          onPause={() => change(() => backendApi.updatePlan({ status: plan.status === 'active' ? 'paused' : 'active' }), plan.status === 'active' ? 'Plan paused. No payments until you resume.' : 'Plan resumed')}
          onStop={() => setSheet('stop')}
          onSkip={() => change(() => backendApi.skipPlanMonth(), 'A month has passed (demo)')} />
      )}

      {!loading && !plan && (data?.setup !== false) && (
        <>
          {hasHistory && data?.totals && <PastPlan data={data} />}
          <Setup farms={farms} town={town.name} onStart={() => (store.online ? setSheet('start') : store.toast('Connect to the Solar Kita server to start a plan'))} />
        </>
      )}

      {/* ---- how it works ---- */}
      <Rise className="section">
        <div className="section-head"><h2 className="h2">How it works</h2></div>
        <div className="card" style={{ padding: '4px 16px' }}>
          {[
            { icon: Repeat, t: 'Pay a fixed amount monthly', d: `Choose RM ${PLAN.presets[0]}–${PLAN.presets[PLAN.presets.length - 1].toLocaleString()} a month. It supports building and maintaining your township’s solar farm.` },
            { icon: RefreshCw, t: 'Every payment comes back', d: `Starting the month after you pay, each payment returns 1/${PLAN.months} every month for 10 years, so the full amount comes back.` },
            { icon: Sun, t: 'Plus 3% a year', d: `On top, you earn ${PLAN.ratePct}% a year on the part not yet returned. Every RM 300 brings back about ${rm(totalBack(300), 2)} in Energy Savings Credits on your TNB bill.` },
            { icon: Gift, t: 'Points and streaks', d: `1 point for every RM ${PLAN.rmPerPoint} you pay, +${PLAN.streakBonuses[0].points} bonus after ${PLAN.streakBonuses[0].at} months in a row and +${PLAN.yearlyBonus} every 12.` },
            { icon: Pause, t: 'Change, pause or stop anytime', d: 'Stopping ends future payments only. Everything you’ve already paid keeps coming back on schedule.' },
          ].map((r) => (
            <div key={r.t} className="list-row" style={{ alignItems: 'flex-start' }}>
              <span className="ic sm">{createElement(r.icon, { size: 16 })}</span>
              <div className="grow"><div className="title">{r.t}</div><div className="desc">{r.d}</div></div>
            </div>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 10, lineHeight: 1.5 }}>
          Prototype: payments and credits are simulated. Credits depend on the solar farm operating as planned; final terms are subject to Sime Darby Property’s approval.
        </p>
      </Rise>

      {data?.payments && data.payments.length > 0 && (
        <Rise className="section">
          <div className="section-head"><h2 className="h2">Payments</h2><span className="muted small">{data.payments.length} so far</span></div>
          <div className="card" style={{ padding: '2px 16px' }}>
            {data.payments.slice(0, 24).map((p) => (
              <div key={p.id} className="list-row">
                <span className="ic sm green"><Check size={15} /></span>
                <div className="grow"><div className="title">Payment #{p.seq}</div><div className="desc">{fmtDay(p.paidAt)} · comes back as {rm(totalBack(p.amount), 2)} over 10 years</div></div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{rm(p.amount)}</div>
                  <div className="row" style={{ gap: 3, fontSize: 11, color: 'var(--muted)', justifyContent: 'flex-end' }}><Coin size={11} />+{p.points}</div>
                </div>
              </div>
            ))}
          </div>
        </Rise>
      )}

      <Sheet open={sheet === 'start'} onClose={() => setSheet(null)} label="Start your plan">
        {sheet === 'start' && <StartSheet farms={farms} onDone={() => setSheet(null)} change={change} />}
      </Sheet>
      <Sheet open={sheet === 'amount'} onClose={() => setSheet(null)} label="Change monthly amount">
        {sheet === 'amount' && plan && <AmountSheet current={plan.monthlyAmount} busy={busy} onSave={async (a) => { if (await change(() => backendApi.updatePlan({ monthlyAmount: a }), `Monthly amount changed to ${rm(a)}`)) setSheet(null) }} />}
      </Sheet>
      <Sheet open={sheet === 'stop'} onClose={() => setSheet(null)} label="Stop your plan">
        {sheet === 'stop' && data?.totals && (
          <div>
            <h2 className="h2" style={{ fontSize: 19 }}>Stop your plan?</h2>
            <p className="sub" style={{ marginTop: 8 }}>No more monthly payments will be taken. The {rm(data.totals.paid)} you’ve paid keeps coming back on schedule: {rm(data.totals.expectedTotal - data.totals.received, 2)} still to come over the next years.</p>
            <div className="grid-2" style={{ marginTop: 18 }}>
              <button className="btn ghost" onClick={() => setSheet(null)}>Keep my plan</button>
              <button className="btn primary" disabled={busy} onClick={async () => { if (await change(() => backendApi.stopPlan(), 'Plan stopped. Your payments keep coming back.')) setSheet(null) }}>Stop plan</button>
            </div>
          </div>
        )}
      </Sheet>
    </Page>
  )
}

/* ---------- running plan ---------- */
function PlanStatus({ data, busy, onAmount, onPause, onStop, onSkip }: { data: PlanSummary; busy: boolean; onAmount: () => void; onPause: () => void; onStop: () => void; onSkip: () => void }) {
  const plan = data.plan!
  const t = data.totals!
  const credits = data.credits ?? []
  const max = Math.max(1, ...credits.map((c) => c.amount))
  return (
    <>
      <Rise className="section overlap">
        <div className="card raised pad">
          <div className="row between">
            <span className={`pill ${plan.status === 'active' ? 'green' : 'grey'}`}>{plan.status === 'active' ? <><Play size={11} /> Active</> : <><Pause size={11} /> Paused</>}</span>
            {plan.streak > 0 && <span className="pill"><Flame size={12} /> {plan.streak} month{plan.streak > 1 ? 's' : ''} in a row<Info size={12}>{HELP.planStreak}</Info></span>}
          </div>
          <div style={{ marginTop: 12 }}>
            <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>{rm(plan.monthlyAmount)}</span>
            <span className="muted" style={{ fontWeight: 600 }}> / month</span>
          </div>
          <div className="muted small" style={{ marginTop: 2 }}>Supporting <b style={{ color: 'var(--ink)' }}>{plan.siteName}</b></div>
          <div className="row" style={{ gap: 8, marginTop: 12, padding: '10px 12px', borderRadius: 14, background: 'var(--line-2)' }}>
            <CalendarClock size={16} color="var(--ink-2)" />
            <span className="small">{plan.status === 'active' && plan.nextChargeAt ? <>Next payment <b>{fmtDay(plan.nextChargeAt)}</b> · +{pointsFor(plan.monthlyAmount)} points</> : 'Paused: no payments are being taken'}</span>
          </div>
          <div className="grid-3" style={{ marginTop: 12 }}>
            <button className="btn ghost sm" onClick={onAmount} disabled={busy}>Change amount<Info size={12}>{HELP.planAmount}</Info></button>
            <button className="btn ghost sm" onClick={onPause} disabled={busy}>{plan.status === 'active' ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Resume</>}<Info size={12}>{HELP.planPause}</Info></button>
            <button className="btn ghost sm" onClick={onStop} disabled={busy}><CircleStop size={13} /> Stop<Info size={12}>{HELP.planStop}</Info></button>
          </div>
        </div>
      </Rise>

      <Rise className="section">
        <div className="card pad">
          <div className="row between">
            <h2 className="h2" style={{ fontSize: 16 }}>Your money</h2>
            {t.nextCredit && <span className="small muted">Next credit <b style={{ color: 'var(--ink)' }}>{rm(t.nextCredit.amount, 2)}</b> on {fmtDay(t.nextCredit.date)}</span>}
          </div>
          <div className="grid-2" style={{ marginTop: 12 }}>
            <Stat l="Paid in" v={rm(t.paid)} />
            <Stat l={<>Back to you so far<Info size={12}>{HELP.planReceived}</Info></>} v={rm(t.received, 2)} />
            <Stat l={<>Still to come back<Info size={12}>{HELP.planStillToCome}</Info></>} v={rm(t.expectedTotal - t.received, 2)} />
            <Stat l={<>Extra earned (3% a year)<Info size={12}>{HELP.planExtra}</Info></>} v={rm(t.extra, 2)} />
          </div>
          <div style={{ marginTop: 14 }}>
            <Progress value={t.expectedTotal ? t.received / t.expectedTotal : 0} />
            <div className="row between muted" style={{ marginTop: 6, fontSize: 11.5 }}>
              <span>{rm(t.received, 2)} of {rm(t.expectedTotal, 2)} returned</span>
              <span>{t.expectedTotal ? Math.round((t.received / t.expectedTotal) * 100) : 0}%</span>
            </div>
          </div>
          {credits.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginTop: 18 }}>Monthly credits<Info size={12}>{HELP.energyCredit}</Info></div>
              <div className="plan-bars">
                {credits.map((c) => (
                  <div key={c.month} className={`plan-bar${c.upcoming ? ' upcoming' : ''}`} title={`${monthLabel(c.month)}: ${rm(c.amount, 2)}`}>
                    <span className="v">{c.amount >= 100 ? Math.round(c.amount) : c.amount.toFixed(c.amount < 10 ? 2 : 0)}</span>
                    <i style={{ height: `${Math.max(6, (c.amount / max) * 100)}%` }} />
                    <span className="m">{monthLabel(c.month)}</span>
                  </div>
                ))}
              </div>
              <div className="muted small" style={{ marginTop: 6 }}>Credits grow every month as your payments add up. Lighter bar = upcoming.</div>
            </>
          )}
          <button className="link" style={{ marginTop: 14 }} onClick={onSkip} disabled={busy}><FastForward size={13} /> Prototype: skip to next month<Info size={13}>{HELP.planSkip}</Info></button>
        </div>
      </Rise>
    </>
  )
}

function Stat({ l, v }: { l: React.ReactNode; v: string }) {
  return <div className="stat" style={{ padding: 12, display: 'block' }}><div className="l">{l}</div><div className="v num" style={{ fontSize: 16 }}>{v}</div></div>
}

/** a stopped plan still repaying */
function PastPlan({ data }: { data: PlanSummary }) {
  const t = data.totals!
  return (
    <Rise className="section overlap">
      <div className="card pad">
        <span className="pill grey">Plan stopped</span>
        <p className="sub" style={{ marginTop: 10 }}>Your earlier payments are still coming back: <b>{rm(t.received, 2)}</b> returned so far, <b>{rm(t.expectedTotal - t.received, 2)}</b> still to come{t.nextCredit ? <>, next credit {rm(t.nextCredit.amount, 2)} on {fmtDay(t.nextCredit.date)}</> : null}.</p>
      </div>
    </Rise>
  )
}

/* ---------- set up a new plan ---------- */
function AmountPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="plan-amounts">
      {PLAN.presets.map((a) => (
        <button key={a} className={value === a ? 'on' : ''} onClick={() => onChange(a)}>RM {a.toLocaleString()}</button>
      ))}
    </div>
  )
}

function Projection({ amount }: { amount: number }) {
  const rows = [1, 3, 5, 10].map((y) => ({ y, ...projection(amount, y * 12) }))
  return (
    <div className="plan-table">
      <div className="h"><span>Keep paying for</span><span>Paid in</span><span>Back so far</span><span>Monthly credit then</span></div>
      {rows.map((r) => (
        <div key={r.y}><span>{r.y} year{r.y > 1 ? 's' : ''}</span><span>{rm(r.paid)}</span><span>{rm(r.received)}</span><span><b>{rm(r.monthlyNow, 2)}</b></span></div>
      ))}
    </div>
  )
}

let startAmount = 300
let startFarm = ''

function Setup({ farms, town, onStart }: { farms: typeof SITES; town: string; onStart: () => void }) {
  const [amount, setAmount] = useState(startAmount)
  const [farmId, setFarmId] = useState(startFarm && farms.some((f) => f.id === startFarm) ? startFarm : farms[0]?.id ?? '')
  useEffect(() => { startAmount = amount; startFarm = farmId }, [amount, farmId])
  const back = totalBack(amount)
  return (
    <Rise className="section overlap">
      <div className="card raised pad">
        <h2 className="h2">Start your monthly plan</h2>
        <div className="muted small" style={{ marginTop: 4 }}>How much would you like to put in each month?</div>
        <div style={{ marginTop: 12 }}><AmountPicker value={amount} onChange={setAmount} /></div>

        <div className="plan-headline">
          <div><div className="l">Each payment comes back as<Info size={11}>{HELP.planComesBack(amount)}</Info></div><div className="v">{rm(back, 2)}</div><div className="s">over 10 years ({rm(back - amount, 2)} extra)</div></div>
          <div><div className="l">First month back<Info size={11}>{HELP.planFirstMonth}</Info></div><div className="v">{rm(projection(amount, 1, 1).monthlyNow, 2)}</div><div className="s">then growing each month</div></div>
          <div><div className="l">Points<Info size={11}>{HELP.planPoints}</Info></div><div className="v row" style={{ gap: 4 }}><Coin size={16} />+{pointsFor(amount)}</div><div className="s">every month + streak bonus</div></div>
        </div>

        <div className="eyebrow" style={{ marginTop: 18 }}>If you keep paying {rm(amount)} a month</div>
        <Projection amount={amount} />

        <div className="eyebrow" style={{ marginTop: 18 }}>Solar farm to support in {town}</div>
        {farms.length === 0
          ? <div className="muted small" style={{ marginTop: 8 }}>There’s no solar farm in {town} yet. Choose another home township on the Home page.</div>
          : (
            <div className="col" style={{ gap: 8, marginTop: 8 }}>
              {farms.map((f) => (
                <button key={f.id} className={`plan-farm${farmId === f.id ? ' on' : ''}`} onClick={() => setFarmId(f.id)}>
                  <span className="ic sm">{createElement(KINDS[f.kind].icon, { size: 15 })}</span>
                  <span className="grow" style={{ textAlign: 'left' }}><b>{f.name}</b><br /><span className="muted" style={{ fontSize: 11.5 }}>{siteMeta(f).label} · {f.capacityMW} MW</span></span>
                  {farmId === f.id && <Check size={17} color="var(--brand)" />}
                </button>
              ))}
            </div>
          )}

        <button className="btn primary block" style={{ marginTop: 18 }} disabled={!farmId}
          onClick={() => { startAmount = amount; startFarm = farmId; onStart() }}>
          <PiggyBank size={18} /> Start plan · {rm(amount)} a month
        </button>
      </div>
    </Rise>
  )
}

function StartSheet({ farms, onDone, change }: { farms: typeof SITES; onDone: () => void; change: (fn: () => ReturnType<typeof backendApi.startPlan>, done?: string) => Promise<boolean> }) {
  const amount = startAmount
  const farm = farms.find((f) => f.id === startFarm) ?? farms[0]
  const [method, setMethod] = useState('fpx')
  const [agree, setAgree] = useState(false)
  const [phase, setPhase] = useState<'confirm' | 'paying' | 'done'>('confirm')
  const methods = [
    { id: 'fpx', label: 'FPX Online Banking', icon: Landmark },
    { id: 'card', label: 'Debit / Credit Card', icon: CreditCard },
    { id: 'wallet', label: 'Solar Kita Wallet', icon: Wallet },
  ]
  const day = Math.min(28, new Date().getDate())

  if (phase === 'done') {
    return (
      <div style={{ textAlign: 'center', paddingBottom: 6 }}>
        <SuccessMark />
        <h2 className="h1" style={{ fontSize: 24, marginTop: 16 }}>You’re building solar</h2>
        <p className="sub" style={{ marginTop: 6 }}>First payment of <b>{rm(amount)}</b> received for {farm?.name}. You earned <b>+{pointsFor(amount)} points</b>, and your first credit arrives on the 28th of next month.</p>
        <button className="btn primary block" style={{ marginTop: 18 }} onClick={onDone}>See my plan</button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="h2" style={{ fontSize: 19 }}>Confirm your plan</h2>
      <div className="card" style={{ padding: '4px 14px', marginTop: 14 }}>
        {[
          ['Monthly amount', rm(amount)],
          ['Supporting', farm?.name ?? ''],
          ['Paid', `today, then on the ${day}${['th', 'st', 'nd', 'rd'][day % 10 > 3 || Math.floor(day / 10) === 1 ? 0 : day % 10]} of every month`],
          ['Each payment returns', `${rm(totalBack(amount), 2)} over 10 years`],
          ['Points', `+${pointsFor(amount)} per payment`],
        ].map(([k, v]) => <div key={k} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)', fontSize: 13 }}><span className="muted">{k}</span><b style={{ textAlign: 'right' }}>{v}</b></div>)}
      </div>
      <div className="eyebrow" style={{ marginTop: 16 }}>Pay with</div>
      <div className="col" style={{ gap: 8, marginTop: 8 }}>
        {methods.map((m) => (
          <button key={m.id} className={`plan-farm${method === m.id ? ' on' : ''}`} onClick={() => setMethod(m.id)}>
            <span className="ic sm grey">{createElement(m.icon, { size: 15 })}</span>
            <span className="grow" style={{ textAlign: 'left', fontWeight: 700 }}>{m.label}</span>
            {method === m.id && <Check size={17} color="var(--brand)" />}
          </button>
        ))}
      </div>
      <label className="row" style={{ gap: 10, marginTop: 16, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--ink-2)', cursor: 'pointer' }}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2 }} />
        <span>I understand each payment comes back gradually over 10 years (plus 3% a year), not straight away.</span>
      </label>
      <AnimatePresence>
        <motion.button className="btn primary block" style={{ marginTop: 16 }} disabled={!agree || phase === 'paying' || !farm}
          onClick={async () => {
            setPhase('paying')
            const ok = await change(() => backendApi.startPlan(amount, farm!.id))
            setPhase(ok ? 'done' : 'confirm')
          }}>
          {phase === 'paying' ? 'Processing payment…' : <><ShieldCheck size={17} /> Pay {rm(amount)} &amp; start plan</>}
        </motion.button>
      </AnimatePresence>
      <p className="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 10 }}>Prototype: no real money is charged.</p>
    </div>
  )
}

function AmountSheet({ current, busy, onSave }: { current: number; busy: boolean; onSave: (amount: number) => void }) {
  const [amount, setAmount] = useState(current)
  return (
    <div>
      <h2 className="h2" style={{ fontSize: 19 }}>Change monthly amount</h2>
      <p className="sub" style={{ marginTop: 6 }}>Applies from your next payment. Payments already made are unchanged.</p>
      <div style={{ marginTop: 14 }}><AmountPicker value={amount} onChange={setAmount} /></div>
      <p className="muted small" style={{ marginTop: 10 }}>{rm(amount)} a month comes back as {rm(totalBack(amount), 2)} per payment and earns +{pointsFor(amount)} points.</p>
      <button className="btn primary block" style={{ marginTop: 16 }} disabled={busy || amount === current} onClick={() => onSave(amount)}>Save {rm(amount)} a month</button>
    </div>
  )
}
