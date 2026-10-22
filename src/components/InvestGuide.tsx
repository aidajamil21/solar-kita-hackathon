import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, BadgeCheck, CalendarDays, Coins, CreditCard, Footprints, Gift, Grid3x3, MapPin, PiggyBank, Repeat, Sparkles, type LucideIcon } from 'lucide-react'
import { createElement, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { asset } from '../asset'
import { KIND_PHOTOS, KINDS, rm, SITES, type SiteKind } from '../data'
import { GREEN } from '../green'
import { HELP } from '../help'
import { PLAN, totalBack } from '../plan'
import { Info } from './Info'

type MethodId = SiteKind | 'plan' | 'green'
interface Method {
  id: MethodId
  icon: LucideIcon
  photo: string
  name: string
  tag: string
  tint: string
  pitch: string
  stats: { label: string; value: string; help?: string }[]
  steps: string[]
  notes: string[]
  /** compare-table cells */
  compare: { pay: string; ret: string; money: string; points: string }
}

const BLOCK_STEPS = (unit: string) => [
  'Open a site on the map in your township.',
  `Pick one or more free ${unit}s (1a, 1b, 1c…).`,
  'Pay once by FPX, card or the Solar Kita wallet.',
  'From next month, 1/120 of what you paid comes back every month for 10 years, plus the project’s return, on your TNB bill every 28th.',
]

function methods(): Method[] {
  const site = (k: SiteKind) => SITES.find((s) => s.kind === k)
  const block = (k: SiteKind, extra: Partial<Method> & Pick<Method, 'pitch' | 'notes'>): Method => {
    const s = site(k)!
    const meta = KINDS[k]
    return {
      id: k,
      icon: meta.icon,
      photo: KIND_PHOTOS[k].hero,
      name: meta.label,
      tag: 'One-off',
      tint: meta.tint,
      stats: [
        { label: `Per ${meta.unitName}`, value: rm(s.pricePerUnit), help: HELP.entryCost(meta.unitName) },
        { label: 'Your money', value: 'Back over 10 years', help: HELP.moneyBack },
        { label: 'Plus a return of', value: `${s.returnLow}–${s.returnHigh}% a year`, help: HELP.expectedReturn },
        { label: 'Points', value: `+${s.pointsPerUnit} per ${meta.unitName}`, help: HELP.rewardPoints(meta.unitName) },
      ],
      steps: BLOCK_STEPS(meta.unitName),
      compare: { pay: `${rm(s.pricePerUnit)} once`, ret: `${s.returnLow}–${s.returnHigh}% on what’s left`, money: 'Back over 10 years', points: `+${s.pointsPerUnit}` },
      ...extra,
    }
  }
  return [
    block('subscription', {
      pitch: 'The easiest way in. Own blocks of a community solar farm and get monthly credits from the electricity they save.',
      notes: ['Lowest entry price: start with a single block. RM 250 comes back as about RM 280.', 'The return follows the sunshine, so wetter months pay a little less.', 'Sime Darby Property runs and maintains the farm for you.'],
    }),
    block('investment', {
      pitch: 'Back a utility-scale array that feeds the township’s substation. Bigger blocks, longer horizon.',
      notes: ['For larger amounts you’re happy to leave for many years.', 'Returns slightly higher than the community farm, still capped at 3% a year.', 'Credits paid monthly like every other project.'],
    }),
    block('rooftop', {
      pitch: 'Help a neighbour’s home go solar. You fund a section of their roof and share the savings.',
      notes: ['Each home is split into two sections you can fund separately.', 'Makes clean energy visible right in your neighbourhood.', 'Credits paid monthly on your TNB bill.'],
    }),
    block('ev', {
      pitch: 'Fund a solar canopy over a township EV charging bay. Every bay powers real drives around town.',
      notes: ['Charger bays are whole units (not split into blocks).', 'Highest points per unit: +300 for every bay.', 'Returns are lower because chargers share their output with drivers.'],
    }),
    {
      id: 'plan',
      icon: PiggyBank,
      photo: asset('photos/solar_farm_golden_hour.jpg'),
      name: 'Solar Builder Plan',
      tag: 'Monthly',
      tint: '#F20000',
      pitch: 'Put aside a fixed amount every month. Every payment comes back to you over 10 years, plus 3% a year.',
      stats: [
        { label: 'Monthly amount', value: `RM ${PLAN.presets[0]}–${PLAN.presets[PLAN.presets.length - 1].toLocaleString()}`, help: HELP.planAmount },
        { label: 'RM 300 comes back as', value: rm(totalBack(300), 2), help: HELP.planComesBack(300) },
        { label: 'Points', value: `1 per RM ${PLAN.rmPerPoint} + streaks`, help: HELP.planPoints },
        { label: 'Flexible', value: 'Pause or stop anytime', help: HELP.planStop },
      ],
      steps: [
        'Choose a monthly amount and a solar farm in your township to support.',
        'Your first payment is taken today, then on the same day every month.',
        `From next month, each payment returns 1/${PLAN.months} a month for 10 years, plus 3% a year on what’s left.`,
        'Credits grow every month as more payments start coming back.',
      ],
      notes: ['Your own money comes back in full, with about 15% extra over 10 years.', 'Stopping only ends future payments; earlier ones keep coming back.', 'Pay 6 months in a row for a +50 points streak bonus.'],
      compare: { pay: `RM ${PLAN.presets[0]}+ a month`, ret: '3% on what’s left', money: 'Back over 10 years', points: `1 per RM ${PLAN.rmPerPoint}` },
    },
    {
      id: 'green',
      icon: Footprints,
      photo: asset('photos/elmina_1.jpg'),
      name: 'Go Green: walk or cycle',
      tag: 'Free',
      tint: '#1F8A5B',
      pitch: 'No money needed. Leave the car at home and earn points for every kilometre you walk or cycle in your township.',
      stats: [
        { label: 'Walking', value: `1 point / ${GREEN.walk.kmPerPoint} km`, help: HELP.greenRate },
        { label: 'Cycling', value: `1 point / ${GREEN.cycle.kmPerPoint} km`, help: HELP.greenRate },
        { label: 'Daily maximum', value: `${GREEN.dailyCap} points`, help: HELP.greenDaily },
        { label: 'Where', value: `Within ${GREEN.areaRadiusKm} km of home`, help: HELP.greenArea },
      ],
      steps: ['Tap Start walk or Start ride on the Go Green page.', 'Keep the app open while you go; it records your route.', 'Tap Finish & claim. The server checks your route and adds your points.'],
      notes: ['See the CO₂ and petrol money you saved on every trip.', 'Points add to the same balance as your solar rewards.'],
      compare: { pay: 'Free', ret: '—', money: '—', points: `1 per ${GREEN.walk.kmPerPoint} km walked` },
    },
  ]
}

const JOURNEY: { icon: LucideIcon; t: string; d: string }[] = [
  { icon: MapPin, t: 'Choose your township', d: 'Every township has its own solar sites.' },
  { icon: Grid3x3, t: 'Pick a project', d: 'Blocks on the map, or a monthly plan.' },
  { icon: CreditCard, t: 'Pay securely', d: 'FPX, card or the Solar Kita wallet.' },
  { icon: CalendarDays, t: 'Get monthly credits', d: 'On your TNB bill every 28th.' },
  { icon: Gift, t: 'Collect rewards', d: 'Spend points on vouchers and more.' },
]

/** "How to invest?" guide for the Explore page */
export function InvestGuide({ township, kindsHere, onShowKind, onChangeTown, onClose }: {
  township: string
  kindsHere: Set<SiteKind>
  onShowKind: (k: SiteKind) => void
  onChangeTown: () => void
  onClose: () => void
}) {
  const nav = useNavigate()
  const all = methods()
  const [pick, setPick] = useState<MethodId>('subscription')
  const m = all.find((x) => x.id === pick)!
  const isKind = m.id !== 'plan' && m.id !== 'green'
  const here = isKind ? kindsHere.has(m.id as SiteKind) : true

  const go = () => {
    if (m.id === 'plan') { onClose(); nav('/plan') }
    else if (m.id === 'green') { onClose(); nav('/green') }
    else if (here) { onShowKind(m.id as SiteKind); onClose() }
    else onChangeTown()
  }

  return (
    <div className="guide">
      <div className="eyebrow">Ways to take part</div>
      <h2 className="guide-title">How to <em>invest</em></h2>
      <p className="sub" style={{ marginTop: 6 }}>Six ways to grow clean energy in {township}, from a single RM 250 block to walking to the shops. Pick one to see how it works.</p>

      {/* method picker */}
      <div className="guide-pick" role="tablist" aria-label="Ways to take part">
        {all.map((x) => (
          <button key={x.id} role="tab" aria-selected={pick === x.id} className={pick === x.id ? 'on' : ''} onClick={() => setPick(x.id)} style={{ ['--tint' as string]: x.tint }}>
            <span className="gi">{createElement(x.icon, { size: 17 })}</span>
            <span className="gn">{x.name.replace('Solar Farm ', '').replace(': walk or cycle', '')}</span>
            <span className="gt">{x.tag}</span>
          </button>
        ))}
      </div>

      {/* the chosen method */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={m.id} className="guide-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
          <div className="guide-hero">
            <img src={m.photo} alt="" />
            <div className="guide-hero-text">
              <span className="pill glass">{createElement(m.icon, { size: 12 })} {m.tag}</span>
              <h3>{m.name}</h3>
            </div>
          </div>
          <div className="guide-body">
            <p className="guide-pitch">{m.pitch}</p>
            <div className="guide-stats">
              {m.stats.map((s) => (
                <div key={s.label}>
                  <div className="l">{s.label}{s.help && <Info size={11}>{s.help}</Info>}</div>
                  <div className="v">{s.value}</div>
                </div>
              ))}
            </div>

            <div className="eyebrow" style={{ marginTop: 18 }}>How it works</div>
            <ol className="guide-steps">
              {m.steps.map((s, i) => <li key={i}><span>{i + 1}</span>{s}</li>)}
            </ol>

            <div className="guide-notes">
              {m.notes.map((n) => <div key={n}><BadgeCheck size={15} /> {n}</div>)}
            </div>

            <button className="btn primary block" style={{ marginTop: 16 }} onClick={go}>
              {m.id === 'plan' ? <>Set up a monthly plan <ArrowRight size={17} /></>
                : m.id === 'green' ? <>Start walking or cycling <ArrowRight size={17} /></>
                  : here ? <>See {KINDS[m.id as SiteKind].short.toLowerCase()} sites in {township} <ArrowRight size={17} /></>
                    : <>Not in {township} yet · choose another township</>}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* side-by-side */}
      <div className="eyebrow" style={{ marginTop: 22 }}>Compare at a glance</div>
      <div className="guide-compare">
        <div className="h"><span>Method</span><span>You pay</span><span>Return a year</span><span>Your money</span><span>Points</span></div>
        {all.map((x) => (
          <button key={x.id} className={pick === x.id ? 'on' : ''} onClick={() => setPick(x.id)}>
            <span className="n">{createElement(x.icon, { size: 14, color: x.tint })}{x.name.replace('Solar Farm ', '').replace(': walk or cycle', '')}</span>
            <span>{x.compare.pay}</span><span>{x.compare.ret}</span><span>{x.compare.money}</span><span>{x.compare.points}</span>
          </button>
        ))}
      </div>

      {/* the journey */}
      <div className="eyebrow" style={{ marginTop: 22 }}>Your journey</div>
      <div className="guide-journey">
        {JOURNEY.map((j, i) => (
          <div key={j.t}>
            <span className="ji">{createElement(j.icon, { size: 16 })}</span>
            <div><b>{i + 1}. {j.t}</b><span>{j.d}</span></div>
          </div>
        ))}
      </div>

      <div className="guide-foot">
        <Sparkles size={15} /> <span>Not sure where to start? Ask the <b>Solar Analyst</b> to compare amounts for you.</span>
        <button className="pill-link" onClick={() => { onClose(); nav('/assistant') }}>Ask AI</button>
      </div>
      <p className="muted" style={{ fontSize: 11, marginTop: 12, lineHeight: 1.5 }}>
        <Coins size={11} style={{ verticalAlign: -1 }} /> Returns are estimates from projected energy savings, capped at 3% a year and not guaranteed. <Repeat size={11} style={{ verticalAlign: -1 }} /> Prototype: no real money moves.
      </p>
    </div>
  )
}
