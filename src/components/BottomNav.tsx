import { motion } from 'framer-motion'
import { Gift, House, LayoutGrid, Map, UserRound } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/explore', label: 'Explore', icon: Map },
  { to: '/solar', label: 'Projects', icon: LayoutGrid },
  { to: '/rewards', label: 'Rewards', icon: Gift },
  { to: '/me', label: 'Profile', icon: UserRound },
]

export default function BottomNav() {
  return (
    <nav className="nav" aria-label="Main">
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
    </nav>
  )
}
