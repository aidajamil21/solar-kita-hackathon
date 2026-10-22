import { AnimatePresence, motion } from 'framer-motion'
import { Info as InfoIcon } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

/**
 * A small "i" next to anything that might be confusing.
 * Hover shows the explanation on laptops; tap toggles it on phones. Escape, scrolling or
 * tapping elsewhere closes it. Safe inside buttons and links (it never triggers them).
 */
export function Info({ children, label = 'More info', size = 15, light }: { children: ReactNode; label?: string; size?: number; light?: boolean }) {
  const id = useId()
  const btn = useRef<HTMLSpanElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState(false)
  const [hover, setHover] = useState(false)
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null)
  const open = pinned || hover

  const place = useCallback(() => {
    const el = btn.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    const width = Math.min(270, vw - 24)
    const left = Math.max(12, Math.min(r.left + r.width / 2 - width / 2, vw - width - 12))
    const below = vh - r.bottom
    setPos(below > 170 || below > r.top ? { left, top: r.bottom + 8, width } : { left, bottom: vh - r.top + 8, width })
  }, [])

  useLayoutEffect(() => { if (open) place() }, [open, place])

  useEffect(() => {
    if (!open) return
    const close = () => { setPinned(false); setHover(false) }
    const away = (e: PointerEvent) => {
      if (btn.current?.contains(e.target as Node) || pop.current?.contains(e.target as Node)) return
      close()
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('pointerdown', away, true)
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', away, true)
      document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const toggle = (e: React.SyntheticEvent) => {
    // never activate the card / link / button this sits inside
    e.preventDefault()
    e.stopPropagation()
    setPinned((p) => !p)
  }

  return (
    <>
      <span
        ref={btn}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        className={`info-btn${light ? ' light' : ''}${open ? ' on' : ''}`}
        style={{ width: size + 3, height: size + 3 }}
        onClick={toggle}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e) }}
        onMouseEnter={() => { if (canHover()) setHover(true) }}
        onMouseLeave={() => setHover(false)}
      >
        <InfoIcon size={size} strokeWidth={2.2} />
      </span>
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              ref={pop}
              id={id}
              role="tooltip"
              className="info-pop"
              style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width }}
              initial={{ opacity: 0, y: pos.top !== undefined ? -4 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              onMouseEnter={() => { if (canHover()) setHover(true) }}
              onMouseLeave={() => setHover(false)}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
