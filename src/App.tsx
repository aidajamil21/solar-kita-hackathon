import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AlertsSheet } from './components/AlertsButton'
import BottomNav from './components/BottomNav'
import { Check } from 'lucide-react'
import { LogoMark, Toasts } from './components/ui'
import Assistant from './pages/Assistant'
import Explore from './pages/Explore'
import Home from './pages/Home'
import Me from './pages/Me'
import Rewards from './pages/Rewards'
import Green from './pages/Green'
import Solar from './pages/Solar'
import SolarDetail from './pages/SolarDetail'
import { StoreProvider } from './store'

function Screens() {
  const loc = useLocation()
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={loc.pathname}
        className="screen-host"
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <Routes location={loc}>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/solar" element={<Solar />} />
          <Route path="/solar/:siteId" element={<SolarDetail />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/me" element={<Me />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/green" element={<Green />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

/** bottom nav + floating "Ask AI" entry point (hidden in the chat itself) */
function Chrome() {
  const loc = useLocation()
  const nav = useNavigate()
  const inChat = loc.pathname === '/assistant'
  const showFab = !inChat && loc.pathname !== '/explore'
  return (
    <>
      <BottomNav hiddenOnPhone={inChat} />
      <AnimatePresence>
        {showFab && (
          <motion.button className="ai-fab" onClick={() => nav('/assistant')} aria-label="Ask Solar Analyst"
            initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }} whileTap={{ scale: 0.95 }}>
            <span className="ai-dot"><Sparkles size={18} /></span> Ask AI
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <div className="stage">
          <aside className="stage-intro">
            <LogoMark size={56} />
            <div className="eyebrow" style={{ marginTop: 22 }}>Community Energy-as-a-Service</div>
            <h1>Choose your <span>solar</span> journey.</h1>
            <p>
              Subscribe to real solar panels in your township, earn returns from projected energy savings and collect reward
              points for every clean kilowatt-hour.
            </p>
            <ul>
              <li><Check size={16} color="#F20000" /> Interactive 3D township explorer</li>
              <li><Check size={16} color="#F20000" /> Pick the exact panels you subscribe to</li>
              <li><Check size={16} color="#F20000" /> Track returns, rewards and impact in one place</li>
            </ul>
          </aside>
          <div className="device">
            <Screens />
            <Chrome />
            <div id="sheet-root" />
            <AlertsSheet />
            <Toasts />
          </div>
        </div>
      </HashRouter>
    </StoreProvider>
  )
}
