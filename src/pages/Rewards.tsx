import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Bike, CalendarCheck, ChevronRight, Clock, Copy, Footprints, Gift, History, Lock, PiggyBank, Star, Sun, TrendingUp, type LucideIcon, PlugZap, BatteryCharging } from 'lucide-react'
import { createElement, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { VoucherArt } from '../components/Art'
import { Coin, Count, Hero, Page, Progress, Rise, Sheet, SuccessMark } from '../components/ui'
import { EARN_WAYS, levelFor, REWARD_CATS, REWARDS, type Reward, type RewardCat } from '../data'
import { useStore, type ActivityType } from '../store'
import { asset } from '../asset'
import { Info } from '../components/Info'
import { HELP } from '../help'

const BANNERS = [
  { id: 'sdp50', eyebrow: 'Featured reward', title: ['Sime Darby Property', 'Shopping Voucher'], body: 'Redeem 1,000 points for a RM50 voucher. Shop, dine and live greener.', photo: null },
  { id: 'tree', eyebrow: 'Limited time reward', title: ['Plant a greener', 'tomorrow'], body: 'Redeem 1,000 points to plant a tree in Sime Darby Property townships.', photo: asset('photos/seeding_hands_2.jpg') },
  { id: 'ev20', eyebrow: 'Clean mobility', title: ['Charge up', 'for less'], body: 'RM20 EV charging credit for 800 points.', photo: asset('photos/ev_charger.jpg') },
]

const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  subscribe: Sun, redeem: Gift, bonus: Star, event: CalendarCheck, quiz: TrendingUp, checkin: CalendarCheck, walk: Footprints, cycle: Bike, plan: PiggyBank, charge: PlugZap,
}

export default function Rewards() {
  const store = useStore()
  const nav = useNavigate()
  const [cat, setCat] = useState<RewardCat | 'all'>('all')
  const [banner, setBanner] = useState(0)
  const [active, setActive] = useState<Reward | null>(null)
  const [histOpen, setHistOpen] = useState(false)
  const lvl = levelFor(store.lifetime)

  useEffect(() => {
    const t = setInterval(() => setBanner((b) => (b + 1) % BANNERS.length), 5000)
    return () => clearInterval(t)
  }, [])

  const list = REWARDS.filter((r) => cat === 'all' || r.cat === cat)
  const b = BANNERS[banner]

  return (
    <Page>
      <Hero photo={asset('photos/seedling_hands.jpg')} eyebrow="Sustainable actions. Greater rewards." title="Rewards" accent="marketplace" sub="Redeem your points for rewards that support a cleaner, greener tomorrow.">
      </Hero>

      {/* ---- points ---- */}
      <Rise className="section overlap" id="points">
        <div className="card raised pad">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <span className="ic lg solid"><Star size={24} fill="#fff" /></span>
            <div className="grow">
              <div className="muted small" style={{ fontWeight: 600 }}>Your Community Energy Points<Info size={13}>{HELP.pointsBalance}</Info></div>
              <div className="row" style={{ gap: 6, alignItems: 'baseline' }}>
                <span style={{ fontSize: 30, fontWeight: 800 }}><Count value={store.points} /></span>
                <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>points</span>
              </div>
            </div>
            <button className="btn ghost sm" onClick={() => setHistOpen(true)}><History size={14} /> History</button>
          </div>
          {lvl.next && (
            <div style={{ marginTop: 14 }}>
              <Progress value={lvl.progress} />
              <div className="row between" style={{ marginTop: 7, fontSize: 11.5 }}>
                <span className="muted">Level {lvl.cur.level} · <b style={{ color: 'var(--ink)' }}>{lvl.cur.name}</b><Info size={12}>{HELP.level}</Info></span>
                <span className="muted">{(lvl.next.min - store.lifetime).toLocaleString()} to {lvl.next.name}</span>
              </div>
            </div>
          )}
        </div>
      </Rise>

      {/* ---- categories ---- */}
      <Rise className="section" style={{ marginTop: 18 }}>
        <div className="cats" role="tablist">
          {REWARD_CATS.map((c) => (
            <button key={c.id} role="tab" aria-selected={cat === c.id} className={`cat${cat === c.id ? ' on' : ''}`} onClick={() => setCat(c.id)}>
              <span className="ic">{createElement(c.icon, { size: 18 })}</span>
              {c.label}
              {cat === c.id && <motion.span layoutId="cat-bar" className="cat-bar" />}
            </button>
          ))}
        </div>
      </Rise>

      {/* ---- featured ---- */}
      <Rise className="section" style={{ marginTop: 16 }}>
        <div className="card" style={{ overflow: 'hidden', height: 182, border: 0 }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={b.id}
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 240 }}
              style={{ position: 'absolute', inset: 0, color: '#fff', padding: 18, overflow: 'hidden' }}
            >
              <div style={{ position: 'absolute', inset: 0 }}>
                {b.photo ? <img src={b.photo} alt="" className="photo" /> : <VoucherArt />}
              </div>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(20,8,6,.88) 0%, rgba(20,8,6,.62) 50%, rgba(20,8,6,0) 80%)' }} />
              <div style={{ position: 'relative', maxWidth: 210 }}>
                <span className="pill" style={{ background: '#F20000', color: '#fff' }}><Clock size={12} /> {b.eyebrow}</span>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.15, marginTop: 10, textTransform: 'uppercase' }}>
                  {b.title[0]}<br /><span style={{ color: '#FFC24D' }}>{b.title[1]}</span>
                </div>
                <div className="small" style={{ marginTop: 6, opacity: 0.85 }}>{b.body}</div>
              </div>
            </motion.div>
          </AnimatePresence>
          <button className="btn pill sm" style={{ position: 'absolute', right: 14, bottom: 14, zIndex: 2 }} onClick={() => setActive(REWARDS.find((r) => r.id === b.id)!)}>
            Redeem <ArrowRight size={14} />
          </button>
          <div className="row" style={{ position: 'absolute', bottom: 24, left: 18, gap: 5, zIndex: 2 }}>
            {BANNERS.map((x, i) => (
              <button key={x.id} aria-label={`Banner ${i + 1}`} onClick={() => setBanner(i)} style={{ width: i === banner ? 16 : 6, height: 6, borderRadius: 3, background: i === banner ? '#FFA300' : 'rgba(255,255,255,.4)', transition: 'all .3s' }} />
            ))}
          </div>
        </div>
      </Rise>

      {/* ---- catalogue ---- */}
      <Rise className="section">
        <div className="section-head">
          <h2 className="h2">Rewards catalogue</h2>
          <span className="muted small">{list.length} rewards</span>
        </div>
        <motion.div layout className="grid-2">
          <AnimatePresence mode="popLayout">
            {list.map((r) => {
              const can = store.points >= r.cost
              return (
                <motion.div key={r.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <div className="reward">
                    <button onClick={() => setActive(r)} style={{ textAlign: 'left' }}>
                      <RewardArt r={r} />
                      <div className="reward-body">
                        <div className="reward-title">{r.title}</div>
                        <div className="reward-desc">{r.detail}</div>
                        <span className="cost" style={{ marginTop: 6 }}><Coin size={15} /> {r.cost.toLocaleString()} <span className="muted" style={{ fontWeight: 600, fontSize: 11 }}>points</span></span>
                      </div>
                    </button>
                    <div style={{ padding: '0 12px 12px' }}>
                      <button className={`btn sm block ${can ? 'primary' : 'ghost'}`} onClick={() => setActive(r)}>
                        {can ? 'Redeem' : <><Lock size={13} /> Locked</>}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
          <motion.div layout key="history">
            <button className="reward" onClick={() => setHistOpen(true)} style={{ height: '100%', border: '1.5px dashed #F3C9C2', background: '#FFFAF9', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 10, textAlign: 'center' }}>
              <span className="ic lg"><History size={22} /></span>
              <div className="reward-title">Rewards history</div>
              <div className="reward-desc">View your past redemptions and impact.</div>
              <span className="pill-link">View history <ArrowRight size={12} /></span>
            </button>
          </motion.div>
        </motion.div>
      </Rise>

      {/* ---- earn more ---- */}
      <Rise className="band">
        <h2 className="h2">How to earn more points</h2>
        <div className="band-sub">Take part in clean energy initiatives across your township.</div>
        <motion.button whileTap={{ scale: 0.98 }} className="card row" style={{ padding: 14, textAlign: 'left', width: '100%', marginTop: 16, gap: 12 }} onClick={() => nav('/green')}>
          <span className="ic green"><Footprints size={20} /></span>
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: 14 }}>Go Green: walk or cycle</div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>Leave the car at home and earn points for every kilometre around your township.</div>
            <span className="pill green" style={{ marginTop: 8 }}><Coin size={12} /> 1 point per 3 km walked</span>
          </div>
          <ChevronRight size={16} className="muted" />
        </motion.button>
        <motion.button whileTap={{ scale: 0.98 }} className="card row" style={{ padding: 14, textAlign: 'left', width: '100%', marginTop: 10, gap: 12 }} onClick={() => nav('/plan')}>
          <span className="ic"><PiggyBank size={20} /></span>
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: 14 }}>Solar Builder Plan</div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>A monthly amount that comes back over 10 years, plus 3% a year.</div>
            <span className="pill" style={{ marginTop: 8 }}><Coin size={12} /> 1 point per RM 5 · streak bonuses</span>
          </div>
          <ChevronRight size={16} className="muted" />
        </motion.button>
        <motion.button whileTap={{ scale: 0.98 }} className="card row" style={{ padding: 14, textAlign: 'left', width: '100%', marginTop: 10, gap: 12 }} onClick={() => nav('/charge')}>
          <span className="ic blue"><BatteryCharging size={20} /></span>
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: 14 }}>Solar EV charging</div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>Book a bay and charge during the solar peak for the most points.</div>
            <span className="pill" style={{ marginTop: 8 }}><Coin size={12} /> 2 points per kWh, 11am–3pm</span>
          </div>
          <ChevronRight size={16} className="muted" />
        </motion.button>
        <div className="grid-2" style={{ marginTop: 10 }}>
          {EARN_WAYS.map((w) => (
            <motion.button key={w.id} whileTap={{ scale: 0.97 }} className="card" style={{ padding: 14, textAlign: 'left' }} onClick={() => (w.to ? nav(w.to) : null)}>
              <div className="row between">
                <span className="ic sm">{createElement(w.icon, { size: 16 })}</span>
                <ChevronRight size={16} className="muted" />
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 10 }}>{w.title}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 2, minHeight: 28 }}>{w.desc}</div>
              <span className="pill" style={{ marginTop: 8 }}><Coin size={12} /> {w.points} points</span>
            </motion.button>
          ))}
        </div>
      </Rise>

      <RedeemSheet reward={active} onClose={() => setActive(null)} />

      <Sheet open={histOpen} onClose={() => setHistOpen(false)} label="Points history">
        <h2 className="h2" style={{ fontSize: 19 }}>Rewards history</h2>
        {store.redemptions.length > 0 && (
          <>
            <div className="eyebrow" style={{ margin: '16px 0 8px' }}>My vouchers</div>
            <div className="hscroll" style={{ margin: '0 -20px', padding: '2px 20px 8px' }}>
              {store.redemptions.map((red) => {
                const r = REWARDS.find((x) => x.id === red.rewardId)!
                return (
                  <div key={red.id} className="card" style={{ width: 210, padding: 14 }}>
                    <div className="row" style={{ gap: 10 }}>
                      <span className="ic sm" style={{ background: r.tint + '1A', color: r.tint }}>{createElement(r.icon, { size: 16 })}</span>
                      <div style={{ fontWeight: 700, fontSize: 12.5 }} className="grow ellipsis">{r.title}</div>
                    </div>
                    <div className="num" style={{ marginTop: 10, fontWeight: 800, letterSpacing: '0.08em', border: '1.5px dashed var(--brand)', background: 'var(--brand-soft)', borderRadius: 8, padding: '5px 8px', fontSize: 13, textAlign: 'center' }}>{red.code}</div>
                  </div>
                )
              })}
            </div>
          </>
        )}
        <div className="eyebrow" style={{ margin: '12px 0 2px' }}>Activity</div>
        <div className="list">
          {store.activity.map((a) => (
            <div key={a.id} className="list-row">
              <span className={`ic sm ${a.points < 0 ? 'grey' : ''}`}>{createElement(ACTIVITY_ICON[a.type], { size: 15 })}</span>
              <div className="grow"><div className="title">{a.title}</div><div className="desc">{new Date(a.at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
              <b className="num" style={{ color: a.points > 0 ? 'var(--green)' : 'var(--ink-2)' }}>{a.points > 0 ? '+' : ''}{a.points.toLocaleString()}</b>
            </div>
          ))}
        </div>
      </Sheet>
    </Page>
  )
}

function RewardArt({ r, height = 104 }: { r: Reward; height?: number }) {
  return (
    <div className="reward-art" style={{ height }}>
      {r.photo ? <img src={r.photo} alt="" className="photo" /> : <VoucherArt />}
      <span className="corner" style={{ color: r.tint }}>{createElement(r.icon, { size: 14 })}</span>
      <span className="val">{r.value}</span>
    </div>
  )
}

function RedeemSheet({ reward: open, onClose }: { reward: Reward | null; onClose: () => void }) {
  const store = useStore()
  const [code, setCode] = useState<string | null>(null)
  // keep showing the last reward while the sheet animates out
  const [reward, setReward] = useState<Reward | null>(open)
  useEffect(() => { if (open) { setReward(open); setCode(null) } }, [open])
  if (!reward) return null
  const can = store.points >= reward.cost
  return (
    <Sheet open={!!open} onClose={onClose} label={`Redeem ${reward.title}`}>
      {code ? (
        <div style={{ textAlign: 'center', paddingTop: 4 }}>
          <SuccessMark />
          <h2 className="h1" style={{ fontSize: 24, marginTop: 18 }}>Reward redeemed</h2>
          <p className="sub" style={{ marginTop: 6 }}>{reward.title} · {reward.value}. Present this code at checkout.</p>
          <div className="num" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.12em', padding: '14px 18px', borderRadius: 14, border: '1.5px dashed var(--brand)', background: 'var(--brand-soft)', marginTop: 18 }}>{code}</div>
          <div className="grid-2" style={{ marginTop: 14 }}>
            <button className="btn ghost" onClick={() => { navigator.clipboard?.writeText(code).catch(() => {}); store.toast('Voucher code copied') }}><Copy size={16} /> Copy code</button>
            <button className="btn primary" onClick={onClose}>Done</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid var(--line)' }}><RewardArt r={reward} height={150} /></div>
          <h2 className="h2" style={{ fontSize: 21, marginTop: 16 }}>{reward.title}</h2>
          <p className="sub" style={{ marginTop: 4 }}>{reward.detail}</p>
          <div className="kv" style={{ marginTop: 16 }}>
            <div><div><div className="k">Cost<Info size={12}>{HELP.redeem}</Info></div><div className="v row" style={{ gap: 5 }}><Coin size={15} />{reward.cost.toLocaleString()}</div></div></div>
            <div><div><div className="k">Balance after</div><div className="v" style={{ color: can ? undefined : 'var(--rose)' }}>{(store.points - reward.cost).toLocaleString()}</div></div></div>
          </div>
          <button className="btn primary block" style={{ marginTop: 18 }} disabled={!can} onClick={() => { const r = store.redeem(reward.id); if (r) setCode(r.code) }}>
            {can ? <>Redeem for {reward.cost.toLocaleString()} points</> : <>Need {(reward.cost - store.points).toLocaleString()} more points</>}
          </button>
        </>
      )}
    </Sheet>
  )
}
