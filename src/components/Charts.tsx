import { motion } from 'framer-motion'
import { useId, useRef, useState } from 'react'

export interface Point { label: string; value: number; tip?: string }

const W = 320

/** keep the tooltip inside the chart near its edges */
const tipX = (pct: number) => ({ left: `${pct}%`, transform: `translate(-${Math.min(92, Math.max(8, pct))}%, -112%)` })

function usePointer(n: number, padL: number, innerW: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [i, setI] = useState<number | null>(null)
  const move = (clientX: number) => {
    const box = ref.current!.getBoundingClientRect()
    const x = ((clientX - box.left) / box.width) * W - padL
    const step = n > 1 ? innerW / (n - 1) : innerW
    setI(Math.max(0, Math.min(n - 1, Math.round(x / step))))
  }
  return {
    ref, i, setI,
    handlers: {
      onPointerMove: (e: React.PointerEvent) => move(e.clientX),
      onPointerDown: (e: React.PointerEvent) => move(e.clientX),
      onPointerLeave: () => setI(null),
    },
  }
}

/** Single-series line + soft area, with crosshair tooltip. */
export function AreaChart(props: { data: Point[]; height?: number; format: (v: number) => string }) {
  return props.data.length > 1 ? <AreaInner {...props} /> : <Empty height={props.height ?? 150} />
}

function Empty({ height }: { height: number }) {
  return (
    <div style={{ height, display: 'grid', placeItems: 'center', borderRadius: 16, background: '#faf6ee', color: 'var(--muted)', fontSize: 12.5, textAlign: 'center', padding: 16 }}>
      ☀️ Your first Energy Savings Credit will appear here after the 28th
    </div>
  )
}

function AreaInner({ data, height = 150, format }: { data: Point[]; height?: number; format: (v: number) => string }) {
  const gid = useId()
  const padL = 4, padR = 4, padT = 14, padB = 22
  const innerW = W - padL - padR
  const innerH = height - padT - padB
  const vals = data.map((d) => d.value)
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const span = hi - lo || 1
  const min = lo - span * 0.25, max = hi + span * 0.15
  const x = (k: number) => padL + (data.length > 1 ? (k / (data.length - 1)) * innerW : innerW / 2)
  const y = (v: number) => padT + innerH - ((v - min) / (max - min)) * innerH
  const line = data.map((d, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)},${y(d.value).toFixed(1)}`).join('')
  const area = `${line}L${x(data.length - 1)},${padT + innerH}L${x(0)},${padT + innerH}Z`
  const { ref, i, handlers } = usePointer(data.length, padL, innerW)
  const active = i ?? data.length - 1
  const labelEvery = Math.ceil(data.length / 6)

  return (
    <div className="chart" ref={ref} {...handlers}>
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Value over time">
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#FF6E00" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FF6E00" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.33, 0.66, 1].map((g) => (
          <line key={g} className="grid" x1={padL} x2={W - padR} y1={padT + innerH * g} y2={padT + innerH * g} />
        ))}
        <motion.path d={area} fill={`url(#${gid})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
        <motion.path
          key={line}
          d={line} fill="none" stroke="#FF3100" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: 'easeInOut' }}
        />
        {data.map((d, k) => (k % labelEvery === 0 || k === data.length - 1) && (
          <text key={k} className="axis" x={x(k)} y={height - 4} textAnchor={k === 0 ? 'start' : k === data.length - 1 ? 'end' : 'middle'}>{d.label}</text>
        ))}
        <line x1={x(active)} x2={x(active)} y1={padT} y2={padT + innerH} stroke="#1C2B29" strokeOpacity={i === null ? 0 : 0.25} strokeDasharray="3 3" />
        <circle cx={x(active)} cy={y(data[active].value)} r={5} fill="#fff" stroke="#FF3100" strokeWidth={2.5} />
      </svg>
      <div className="tip" style={{ ...tipX((x(active) / W) * 100), top: `${(y(data[active].value) / height) * 100}%` }}>
        {format(data[active].value)}
        <small>{data[active].tip ?? data[active].label}</small>
      </div>
    </div>
  )
}

/** Single-series vertical bars with per-bar hover tooltip. */
export function BarChart(props: { data: Point[]; height?: number; format: (v: number) => string; color?: string }) {
  return props.data.length ? <BarInner {...props} /> : <Empty height={props.height ?? 140} />
}

function BarInner({ data, height = 140, format, color = '#FF6E00' }: { data: Point[]; height?: number; format: (v: number) => string; color?: string }) {
  const padT = 10, padB = 20
  const innerH = height - padT - padB
  const max = Math.max(...data.map((d) => d.value)) * 1.1 || 1
  const slot = W / data.length
  const bw = Math.min(26, slot - 6)
  const { ref, i, handlers } = usePointer(data.length, slot / 2, W - slot)
  const active = i ?? data.length - 1

  return (
    <div className="chart" ref={ref} {...handlers}>
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Bar chart">
        <line className="grid" x1={0} x2={W} y1={padT + innerH} y2={padT + innerH} />
        {data.map((d, k) => {
          const h = Math.max(3, (d.value / max) * innerH)
          const bx = k * slot + (slot - bw) / 2
          const by = padT + innerH - h
          return (
            <g key={k}>
              <motion.path
                d={`M${bx},${padT + innerH}V${by + 4}Q${bx},${by} ${bx + 4},${by}H${bx + bw - 4}Q${bx + bw},${by} ${bx + bw},${by + 4}V${padT + innerH}Z`}
                fill={color}
                opacity={k === active ? 1 : 0.38}
                initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                style={{ transformOrigin: `0px ${padT + innerH}px` }}
                transition={{ duration: 0.6, delay: k * 0.03, ease: [0.22, 1, 0.36, 1] }}
              />
              {(data.length <= 8 || k % 2 === (data.length - 1) % 2) && (
                <text className="axis" x={bx + bw / 2} y={height - 4} textAnchor="middle">{d.label}</text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="tip" style={{ ...tipX(((active + 0.5) * slot / W) * 100), top: `${((padT + innerH - (data[active].value / max) * innerH) / height) * 100}%` }}>
        {format(data[active].value)}
        <small>{data[active].tip ?? data[active].label}</small>
      </div>
    </div>
  )
}

export function Ring({ value, size = 92, stroke = 10, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(28,43,41,.08)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} stroke="url(#ring-g)" strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value) }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
        <defs>
          <linearGradient id="ring-g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#FFA300" />
            <stop offset="100%" stopColor="#F20000" />
          </linearGradient>
        </defs>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>
    </div>
  )
}
