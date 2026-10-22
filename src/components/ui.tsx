import { animate, AnimatePresence, motion, useDragControls, useMotionValue, useTransform, type DragControls, type Variants } from 'framer-motion'
import { Check, CheckCircle2, ChevronLeft, X } from 'lucide-react'
import AlertsButton, { openAlerts } from './AlertsButton'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { asset } from '../asset'

/* ---------- brand mark (Sime Darby Property) ---------- */
export function LogoMark({ size = 38 }: { size?: number }) {
  return <img src={asset('sdp-logo.png')} alt="Sime Darby Property" height={size} style={{ height: size, width: 'auto', display: 'block', flexShrink: 0 }} />
}

/* ---------- star coin (points) ---------- */
export function Coin({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="11" fill="#FF8A00" />
      <circle cx="12" cy="12" r="8.6" fill="#FFA300" />
      <path d="M12 6.8l1.6 3.3 3.6.5-2.6 2.5.6 3.6L12 15l-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#fff" />
    </svg>
  )
}

/* ---------- top bar ---------- */
/** "Jane Doe" -> "JD" */
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?'

export function TopBar({ title = 'Solar Kita', tagline = 'Community Energy-as-a-Service' }: { title?: string; tagline?: string }) {
  const { name } = useStore()
  return (
    <div className="topbar">
      <Link to="/" className="brand">
        <span className="hero-logo"><LogoMark size={34} /></span>
        <span style={{ width: 1, height: 28, background: 'var(--line)' }} />
        <div>
          <div className="brand-name">{title}</div>
          <div className="brand-tag">{tagline}</div>
        </div>
      </Link>
      <div className="topbar-actions">
        <AlertsButton />
        <Link to="/me" className="avatar" aria-label="Profile">{initials(name)}</Link>
      </div>
    </div>
  )
}

/* ---------- tinted photo hero (Sime Darby Property web style) ---------- */
export function Hero({ photo, eyebrow, title, accent, sub, children }: { photo: string; eyebrow: string; title: string; accent: string; sub?: string; children?: ReactNode }) {
  return (
    <Rise className="hero">
      <img src={photo} alt="" className="hero-img" />
      <svg className="hero-curves" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <path d="M180 -40 Q420 -60 470 120 Q500 300 300 360 Q120 400 90 220 Q60 40 180 -40Z" fill="#FFA300" opacity=".16" />
        <path d="M230 -10 Q430 -10 450 150 Q460 300 320 330 Q170 350 160 210 Q150 60 230 -10Z" fill="none" stroke="#FFC24D" strokeOpacity=".35" strokeWidth="2" />
        <path d="M-60 180 Q60 120 160 220 Q230 300 140 360" fill="none" stroke="#fff" strokeOpacity=".18" strokeWidth="1.5" />
      </svg>
      <TopBar />
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="h1" style={{ marginTop: 6 }}>{title} <em>{accent}</em></h1>
      {sub && <p className="sub" style={{ marginTop: 6 }}>{sub}</p>}
      {children}
    </Rise>
  )
}

/** scrolling red banner, as on the corporate site */
export function Ticker({ items }: { items: ReactNode[] }) {
  const row = items.map((it, i) => <span key={i}>{it}</span>)
  return (
    <div className="ticker" aria-hidden>
      <div className="ticker-track">{row}{row}</div>
    </div>
  )
}

/* ---------- page heading: eyebrow + title with amber accent ---------- */
export function Heading({ eyebrow, title, accent, sub }: { eyebrow: string; title: string; accent: string; sub?: string }) {
  return (
    <Rise>
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="h1" style={{ marginTop: 6 }}>{title} <em>{accent}</em></h1>
      {sub && <p className="sub" style={{ marginTop: 6 }}>{sub}</p>}
    </Rise>
  )
}

/* ---------- count-up numbers ---------- */
export function Count({ value, decimals = 0, prefix = '', suffix = '' }: { value: number; decimals?: number; prefix?: string; suffix?: string }) {
  const mv = useMotionValue(0)
  const text = useTransform(mv, (v) => prefix + v.toLocaleString('en-MY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix)
  useEffect(() => {
    const c = animate(mv, value, { duration: 1, ease: [0.22, 1, 0.36, 1] })
    return () => c.stop()
  }, [value, mv])
  return <motion.span className="num">{text}</motion.span>
}

export function Progress({ value, dark }: { value: number; dark?: boolean }) {
  return (
    <div className={`progress${dark ? ' dark' : ''}`} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <motion.i initial={{ width: 0 }} animate={{ width: `${Math.max(3, value * 100)}%` }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }} />
    </div>
  )
}

/* ---------- page wrapper with staggered children ---------- */
export const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } } }
export const rise: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
}

/** opened from a notification: scroll to the section it points at and flash it */
export function useFromAlert() {
  const state = useLocation().state as { from?: string; section?: string } | null
  const section = state?.section
  useEffect(() => {
    if (!section) return
    const t = window.setTimeout(() => {
      const el = document.getElementById(section)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el.classList.add('flash')
      window.setTimeout(() => el.classList.remove('flash'), 2000)
    }, 520)
    return () => window.clearTimeout(t)
  }, [section])
  return state?.from === 'alerts'
}

/** top-left back button on pages reached from a notification; returns to the notifications list */
export function AlertBack({ inline }: { inline?: boolean }) {
  const nav = useNavigate()
  return (
    <div className={`alert-back${inline ? ' inline' : ''}`}>
      <button onClick={() => { nav(-1); openAlerts() }} aria-label="Back to notifications"><ChevronLeft size={18} /> Back</button>
    </div>
  )
}

export function Page({ children, ownBack }: { children: ReactNode; ownBack?: boolean }) {
  const fromAlert = useFromAlert()
  return (
    <div className="screen">
      <motion.div className="page" variants={stagger} initial="hidden" animate="show">
        <div className="page-bg" />
        {fromAlert && !ownBack && <AlertBack />}
        {children}
      </motion.div>
    </div>
  )
}

export const Rise = ({ children, className, style, id }: { children: ReactNode; className?: string; style?: React.CSSProperties; id?: string }) => (
  <motion.div variants={rise} className={className} style={style} id={id}>{children}</motion.div>
)

/* ---------- bottom sheet ---------- */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const controls = useDragControls()
  // render at the device level so sheets never get trapped inside a page's stacking context
  const root = typeof document !== 'undefined' ? document.getElementById('sheet-root') : null
  const tree = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            className="sheet" role="dialog" aria-label={label}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            dragListener={false} dragControls={controls}
            onDragEnd={(_, i) => { if (i.offset.y > 110 || i.velocity.y > 600) onClose() }}
          >
            <SheetInner onClose={onClose} controls={controls}>{children}</SheetInner>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
  return root ? createPortal(tree, root) : tree
}

export function SheetInner({ children, onClose, controls }: { children: ReactNode; onClose: () => void; controls: DragControls }) {
  return (
    <>
      <div className="sheet-grab" onPointerDown={(e) => controls.start(e)}><i /></div>
      <button className="sheet-close" aria-label="Close" onClick={onClose}><X size={16} /></button>
      <div className="sheet-body">{children}</div>
    </>
  )
}

/* ---------- toasts ---------- */
export function Toasts() {
  const { toasts } = useStore()
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} className="toast" initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}>
            <span className="ic"><CheckCircle2 size={15} /></span>
            <span>{t.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/* ---------- success mark (animated check with radiating rings) ---------- */
export function SuccessMark({ size = 84 }: { size?: number }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      {[0, 1].map((k) => (
        <motion.span key={k} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--brand)' }}
          initial={{ scale: 0.8, opacity: 0.7 }} animate={{ scale: 1.7, opacity: 0 }} transition={{ duration: 1.6, delay: 0.3 + k * 0.5, repeat: Infinity, repeatDelay: 0.6 }} />
      ))}
      <motion.div
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 220 }}
        style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'linear-gradient(150deg,#FF3100,#E00000)', display: 'grid', placeItems: 'center', color: '#fff', boxShadow: '0 14px 30px -10px rgba(220,0,0,.6)' }}
      >
        <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.2, type: 'spring' }} style={{ display: 'grid' }}>
          <Check size={size * 0.45} strokeWidth={3} />
        </motion.span>
      </motion.div>
    </div>
  )
}

/* ---------- segmented control ---------- */
export function Seg<T extends string>({ options, value, onChange, id }: { options: T[]; value: T; onChange: (v: T) => void; id: string }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o} role="tab" aria-selected={o === value} className={o === value ? 'on' : ''} onClick={() => onChange(o)}>
          {o === value && <motion.span layoutId={`seg-${id}`} className="seg-thumb" transition={{ type: 'spring', damping: 26, stiffness: 320 }} />}
          {o}
        </button>
      ))}
    </div>
  )
}
