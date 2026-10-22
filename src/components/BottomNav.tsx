import { motion } from 'framer-motion'
import { Gift, House, LayoutGrid, LogOut, Map, UserRound } from 'lucide-react'
import { getSession, signOut } from '../api/backend'
import { NavLink } from 'react-router-dom'
import { LogoMark } from './ui'

const ITEMS = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/explore', label: 'Explore', icon: Map },
  { to: '/solar', label: 'Projects', icon: LayoutGrid },
  { to: '/rewards', label: 'Rewards', icon: Gift },
  { to: '/me', label: 'Profile', icon: UserRound },
]

/** bottom tab bar on phones, top menu on laptops; `hiddenOnPhone` hides it only in the phone layout (chat is full-screen there) */
export default function BottomNav({ hiddenOnPhone = false }: { hiddenOnPhone?: boolean }) {
  return (
    <nav className={hiddenOnPhone ? 'nav nav-phone-hidden' : 'nav'} aria-label="Main">
      <div className="nav-brand"><LogoMark size={34} /><span>Solar Kita</span></div>
      {ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
          {({ isActive }) => (
            <>
              <Icon size={22} strokeWidth={isActive ? 2.3 : 1.9} />
              <span>{label}</span>
              {isActive && <motion.span layoutId="nav-bar" className="nav-bar" transition={{ type: 'spring', damping: 28, stiffness: 340 }} />}
            </>
          )}
        </NavLink>
      ))}
      {getSession() && <button className="nav-logout" onClick={signOut}><LogOut size={18} /><span>Log out</span></button>}
    </nav>
  )
}
