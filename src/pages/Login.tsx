import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, FlaskConical, Leaf, Mail, MapPin, Sun, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, backendApi, setSession } from '../api/backend'
import { asset } from '../asset'
import { LogoMark } from '../components/ui'
import { TOWNSHIPS } from '../data'

type Step = { kind: 'email' } | { kind: 'register'; email: string }

/** email sign-in: existing residents go straight in, new emails pick a name and township first */
export default function Login({ onSignedIn, onOffline }: { onSignedIn: () => void; onOffline: () => void }) {
  const [step, setStep] = useState<Step>({ kind: 'email' })
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [township, setTownship] = useState(TOWNSHIPS[0].id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unreachable, setUnreachable] = useState(false)
  const [accounts, setAccounts] = useState<{ email: string; name: string }[]>([])

  useEffect(() => { backendApi.testAccounts().then(setAccounts).catch(() => {}) }, [])

  const fail = (err: unknown) => {
    setUnreachable(err instanceof ApiError && err.status === 0)
    setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
  }

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await backendApi.login(email.trim())
      if (res.isNew) setStep({ kind: 'register', email: res.email })
      else { setSession({ token: res.token, email: res.email, name: res.name }); onSignedIn() }
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  const submitRegister = async (e: FormEvent) => {
    e.preventDefault()
    if (step.kind !== 'register') return
    setError(null)
    setBusy(true)
    try {
      setSession(await backendApi.register(step.email, name.trim(), township))
      onSignedIn()
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <aside className="login-hero">
        <img src={asset('photos/solar_farm_golden_hour_2.jpg')} alt="" className="login-hero-img" />
        <div className="login-hero-inner">
          <span className="hero-logo login-logo"><LogoMark size={40} /></span>
          <div className="eyebrow" style={{ color: 'rgba(255,255,255,.85)', marginTop: 22 }}>Community Energy-as-a-Service</div>
          <h1 className="login-title">Choose your <em>solar</em> journey.</h1>
          <p className="login-sub">Subscribe to real solar panels in your township, earn Energy Savings Credits and collect points for every clean kilowatt-hour.</p>
          <ul className="login-points">
            <li><Sun size={16} /> Pick the exact panels you subscribe to</li>
            <li><Leaf size={16} /> Earn points for walking and cycling</li>
            <li><Check size={16} /> Track credits, rewards and impact in one place</li>
          </ul>
        </div>
      </aside>

      <main className="login-panel">
        <div className="login-card">
          <AnimatePresence mode="wait" initial={false}>
            {step.kind === 'email' ? (
              <motion.form key="email" onSubmit={submitEmail} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}>
                <h2 className="login-h">Welcome to Solar Kita</h2>
                <p className="sub" style={{ marginTop: 6 }}>Sign in or create an account with your email.</p>
                <label className="field" style={{ marginTop: 22 }}>
                  <span>Email address</span>
                  <div className="field-box">
                    <Mail size={17} />
                    <input type="email" inputMode="email" autoComplete="email" autoFocus required placeholder="you@example.com"
                      value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
                  </div>
                </label>
                {error && <p className="field-error">{error}</p>}
                <button type="submit" className="btn primary block" style={{ marginTop: 16 }} disabled={busy || !email.trim()}>
                  {busy ? 'Checking…' : <>Continue <ArrowRight size={17} /></>}
                </button>
                {unreachable && (
                  <button type="button" className="btn ghost block" style={{ marginTop: 10 }} onClick={onOffline}>Continue with the offline demo</button>
                )}
                <p className="login-note">Prototype sign-in: no password needed. Your email just identifies your account.</p>
              </motion.form>
            ) : (
              <motion.form key="register" onSubmit={submitRegister} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}>
                <button type="button" className="link" onClick={() => { setStep({ kind: 'email' }); setError(null) }}><ArrowLeft size={14} /> Use a different email</button>
                <h2 className="login-h" style={{ marginTop: 14 }}>Create your account</h2>
                <p className="sub" style={{ marginTop: 6 }}>Signing up as <b>{step.email}</b>. You’ll get 50 welcome points.</p>
                <label className="field" style={{ marginTop: 20 }}>
                  <span>Your name</span>
                  <div className="field-box">
                    <UserRound size={17} />
                    <input autoComplete="name" autoFocus required maxLength={80} placeholder="e.g. Aisyah Rahman" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
                  </div>
                </label>
                <label className="field" style={{ marginTop: 14 }}>
                  <span>Home township</span>
                  <div className="field-box">
                    <MapPin size={17} />
                    <select value={township} onChange={(e) => setTownship(e.target.value)} disabled={busy}>
                      {TOWNSHIPS.map((t) => <option key={t.id} value={t.id}>{t.name}, {t.area}</option>)}
                    </select>
                  </div>
                </label>
                {error && <p className="field-error">{error}</p>}
                <button type="submit" className="btn primary block" style={{ marginTop: 18 }} disabled={busy || !name.trim()}>
                  {busy ? 'Creating account…' : <>Create account <ArrowRight size={17} /></>}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {step.kind === 'email' && accounts.length > 0 && (
          <div className="login-test">
            <div className="row" style={{ gap: 8 }}>
              <span className="ic sm grey"><FlaskConical size={15} /></span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Prototype testing?</div>
                <div className="muted" style={{ fontSize: 12 }}>Select an account below:</div>
              </div>
            </div>
            <div className="field-box" style={{ marginTop: 10, background: '#fff' }}>
              <UserRound size={17} />
              <select aria-label="Test account" value={accounts.some((a) => a.email === email) ? email : ''} onChange={(e) => { setEmail(e.target.value); setError(null) }} disabled={busy}>
                <option value="" disabled>Choose a test account…</option>
                {accounts.map((a) => <option key={a.email} value={a.email}>{a.name ? `${a.name} · ${a.email}` : a.email}</option>)}
              </select>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
