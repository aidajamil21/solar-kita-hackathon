import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { createElement, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { KINDS, type Site } from '../../data'
import { blockCenter, rng, ROOFTOP_SLOTS } from './gen'
import { env, gableGeometry } from './Scenery'

export type UnitState = 'free' | 'taken' | 'mine' | 'sel'

export interface SiteView {
  site: Site
  selected: boolean
  anySelected: boolean
  dimmed: boolean
  unitState: (i: number) => UnitState
  onSelect: () => void
  onUnit: (i: number) => void
}

const AMBER = '#FF6A00'
const UNIT: Record<UnitState, { c: string; e: string; base: number }> = {
  free: { c: '#FFFFFF', e: '#4F7BD6', base: 0.03 },
  taken: { c: '#A7ADB5', e: '#000000', base: 0 },
  mine: { c: '#BFF2D8', e: '#2FC488', base: 0.75 },
  sel: { c: '#FFC6A6', e: AMBER, base: 1.3 },
}

function setCursor(on: boolean) { document.body.style.cursor = on ? 'pointer' : '' }

/* ---------- textures ---------- */
let pvTex: THREE.CanvasTexture | null = null
function pvTexture() {
  if (pvTex) return pvTex
  const c = document.createElement('canvas')
  c.width = 128; c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createLinearGradient(0, 0, 128, 64)
  grd.addColorStop(0, '#22385F'); grd.addColorStop(0.5, '#1A2D4E'); grd.addColorStop(1, '#2A4370')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 64)
  g.strokeStyle = 'rgba(190,210,240,.45)'
  g.lineWidth = 1
  for (let x = 0; x <= 128; x += 16) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, 64); g.stroke() }
  for (let y = 0; y <= 64; y += 16) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(128, y + 0.5); g.stroke() }
  g.strokeStyle = '#D9DEE4'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 125, 61)
  pvTex = new THREE.CanvasTexture(c)
  pvTex.wrapS = pvTex.wrapT = THREE.RepeatWrapping
  pvTex.colorSpace = THREE.SRGBColorSpace
  pvTex.anisotropy = 8
  return pvTex
}

let glowTex: THREE.CanvasTexture | null = null
function glowTexture() {
  if (glowTex) return glowTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,150,70,1)')
  grd.addColorStop(0.45, 'rgba(255,90,0,.5)')
  grd.addColorStop(1, 'rgba(255,90,0,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  glowTex = new THREE.CanvasTexture(c)
  return glowTex
}

/* ---------- one PV table (the unit you subscribe to) ---------- */
function Unit({ w, d, state, tilt = 0.35, onClick, legs = true }: { w: number; d: number; state: UnitState; tilt?: number; onClick: () => void; legs?: boolean }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const grp = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)
  const k = UNIT[state]
  const map = useMemo(() => {
    const t = pvTexture().clone()
    t.repeat.set(Math.max(1, Math.round(w / 0.55)), Math.max(1, Math.round(d / 0.55)))
    t.needsUpdate = true
    return t
  }, [w, d])
  useFrame(({ clock }) => {
    if (!mat.current || !grp.current) return
    const t = clock.elapsedTime
    const pulse = state === 'sel' ? 0.5 * Math.sin(t * 5) : state === 'mine' ? 0.2 * Math.sin(t * 2.4) : 0
    mat.current.emissiveIntensity = k.base + pulse + (state === 'free' ? env.night * 0.4 : 0) + (hover ? 0.5 : 0)
    const targetY = state === 'sel' ? 0.12 : hover ? 0.06 : 0
    grp.current.position.y += (targetY - grp.current.position.y) * 0.18
  })
  const click = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.delta < 6) onClick() }
  const lift = legs ? 0.42 : 0
  return (
    <group>
      {legs && [-1, 1].map((sx) => (
        <group key={sx}>
          <mesh position={[sx * (w / 2 - 0.12), 0.24, -d * 0.18]}><boxGeometry args={[0.04, 0.42, 0.04]} /><meshStandardMaterial color="#8F969C" metalness={0.5} roughness={0.4} /></mesh>
          <mesh position={[sx * (w / 2 - 0.12), 0.17, d * 0.18]}><boxGeometry args={[0.04, 0.26, 0.04]} /><meshStandardMaterial color="#8F969C" metalness={0.5} roughness={0.4} /></mesh>
        </group>
      ))}
      <group ref={grp}>
        <mesh
          position={[0, lift, 0]}
          rotation={[tilt, 0, 0]}
          castShadow
          receiveShadow
          onClick={click}
          onPointerOver={(e) => { e.stopPropagation(); setHover(true); setCursor(true) }}
          onPointerOut={() => { setHover(false); setCursor(false) }}
        >
          <boxGeometry args={[w, 0.05, d]} />
          <meshStandardMaterial ref={mat} map={map} color={k.c} emissive={k.e} roughness={0.22} metalness={0.45} />
        </mesh>
      </group>
    </group>
  )
}

/* ---------- golden glow pool + outline + pulse ---------- */
function Glow({ selected, dimmed, size = 8.2 }: { selected: boolean; dimmed: boolean; size?: number }) {
  const pool = useRef<THREE.MeshBasicMaterial>(null)
  const edges = useRef<THREE.MeshBasicMaterial>(null)
  const ring = useRef<THREE.Mesh>(null)
  const ringMat = useRef<THREE.MeshBasicMaterial>(null)
  const edgeColor = useMemo(() => new THREE.Color(AMBER).multiplyScalar(4), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const target = dimmed ? 0.05 : selected ? 1 : 0.8 + Math.sin(t * 1.6) * 0.1
    if (pool.current) pool.current.opacity += (target - pool.current.opacity) * 0.08
    if (edges.current) edges.current.opacity += ((dimmed ? 0.15 : 1) - edges.current.opacity) * 0.08
    if (ring.current && ringMat.current) {
      const p = (t * 0.55) % 1
      ring.current.scale.setScalar(1 + p * 0.3)
      ringMat.current.opacity = selected ? (1 - p) * 0.9 : 0
    }
  })
  const s = size
  return (
    <group position={[0, 0.1, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[s * (s > 10 ? 1.25 : 1.55), s * (s > 10 ? 1.25 : 1.55)]} />
        <meshBasicMaterial ref={pool} map={glowTexture()} transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {[[0, s / 2, s + 0.14, 0.14], [0, -s / 2, s + 0.14, 0.14], [s / 2, 0, 0.14, s], [-s / 2, 0, 0.14, s]].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.05, z]}>
          <boxGeometry args={[w, 0.1, d]} />
          <meshBasicMaterial ref={i === 0 ? edges : undefined} color={edgeColor} transparent opacity={0.8} toneMapped={false} />
        </mesh>
      ))}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[s * 0.72, s * 0.75, 96]} />
        <meshBasicMaterial ref={ringMat} color={edgeColor} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** one row / roof / bay, split side by side into its blocks (1a, 1b, ...); each block is a pickable unit */
function BlockRow({ v, row, w, d, tilt, legs }: { v: SiteView; row: number; w: number; d: number; tilt?: number; legs?: boolean }) {
  const n = Math.max(1, v.site.blocks)
  const pick = (i: number) => () => (v.selected ? v.onUnit(i) : v.onSelect())
  if (n === 1) return <Unit w={w} d={d} tilt={tilt} legs={legs} state={v.unitState(row)} onClick={pick(row)} />
  const gap = Math.min(0.06, w * 0.04)
  const bw = (w - gap * (n - 1)) / n
  return (
    <>
      {Array.from({ length: n }, (_, b) => {
        const i = row * n + b
        return (
          <group key={b} position={[-w / 2 + bw / 2 + b * (bw + gap), 0, 0]}>
            <Unit w={bw} d={d} tilt={tilt} legs={legs} state={v.unitState(i)} onClick={pick(i)} />
          </group>
        )
      })}
    </>
  )
}
const rowsOf = (site: Site) => Math.ceil(site.units / Math.max(1, site.blocks))

/* ---------- utility-scale farm ---------- */
function Farm({ v }: { v: SiteView }) {
  const { site } = v
  const C = site.cols
  const rows = rowsOf(site)
  const R = Math.ceil(rows / C)
  const gap = 0.4
  const span = 7.0
  const w = (span - (C - 1) * gap) / C
  const spacing = 6.4 / R
  const d = spacing * 0.62
  const posts = useMemo(() => {
    const out: [number, number][] = []
    for (let p = -3.8; p <= 3.8; p += 0.95) out.push([p, -3.8], [p, 3.8], [-3.8, p], [3.8, p])
    return out
  }, [])
  return (
    <group>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[7.9, 0.03, 7.9]} />
        <meshStandardMaterial color={site.kind === 'investment' ? '#D9D5CB' : '#D2D6C8'} roughness={1} />
      </mesh>
      <mesh position={[0, 0.12, 3.35]} receiveShadow>
        <boxGeometry args={[7.4, 0.02, 0.55]} />
        <meshStandardMaterial color="#E4E1D8" />
      </mesh>
      {Array.from({ length: rows }, (_, i) => {
        const col = i % C, row = Math.floor(i / C)
        return (
          <group key={i} position={[-span / 2 + w / 2 + col * (w + gap), 0.1, -3.4 + spacing / 2 + row * spacing]}>
            <BlockRow v={v} row={i} w={w} d={d} />
          </group>
        )
      })}
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.32, z]}><boxGeometry args={[0.04, 0.44, 0.04]} /><meshStandardMaterial color="#9CA2A6" /></mesh>
      ))}
      {[[0, -3.8, 7.6, 0.015], [0, 3.8, 7.6, 0.015], [-3.8, 0, 0.015, 7.6], [3.8, 0, 0.015, 7.6]].map(([x, z, w2, d2], i) => (
        <mesh key={i} position={[x, 0.46, z]}><boxGeometry args={[w2, 0.02, d2]} /><meshStandardMaterial color="#B1B6BA" /></mesh>
      ))}
      <mesh position={[3.0, 0.38, 3.35]} castShadow><boxGeometry args={[0.9, 0.55, 0.45]} /><meshStandardMaterial color="#F3F2EE" /></mesh>
      <mesh position={[3.0, 0.68, 3.35]}><boxGeometry args={[0.98, 0.05, 0.52]} /><meshStandardMaterial color={AMBER} /></mesh>
      <mesh position={[2.1, 0.32, 3.35]} castShadow><boxGeometry args={[0.45, 0.42, 0.4]} /><meshStandardMaterial color="#B9BEC2" metalness={0.3} /></mesh>
    </group>
  )
}

/* ---------- rooftop homes ---------- */
const RT_WALLS = ['#F6F5F1', '#EEEDE8', '#F3F1EB', '#E9E8E3', '#F8F7F3', '#ECEAE4']
function Rooftops({ v }: { v: SiteView }) {
  const roofGeo = useMemo(gableGeometry, [])
  const W = 2.1, D = 2.4, H = 1.3, RH = 0.85
  const alpha = Math.atan(RH / (D / 2 + 0.11))
  return (
    <group>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[7.9, 0.03, 7.9]} />
        <meshStandardMaterial color="#CCD4C4" />
      </mesh>
      {ROOFTOP_SLOTS.map(([x, z], i) => (
        <group key={i} position={[x, 0.1, z]}>
          <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[W, H, D]} />
            <meshStandardMaterial color={RT_WALLS[i]} />
          </mesh>
          <mesh position={[0, H * 0.6, D / 2 + 0.01]}>
            <boxGeometry args={[W * 0.7, 0.28, 0.02]} />
            <meshStandardMaterial color="#8F99A1" roughness={0.3} />
          </mesh>
          <mesh position={[0.55, 0.32, D / 2 + 0.01]}>
            <boxGeometry args={[0.38, 0.62, 0.02]} />
            <meshStandardMaterial color="#7A6D60" />
          </mesh>
          <mesh geometry={roofGeo} position={[0, H, 0]} scale={[W + 0.14, RH, D + 0.22]} castShadow receiveShadow>
            <meshStandardMaterial color="#B5B2AB" />
          </mesh>
          <group position={[0, H + RH * 0.5 + 0.03, (D / 2 + 0.11) * 0.5]}>
            <BlockRow v={v} row={i} w={W * 0.82} d={0.95} tilt={alpha} legs={false} />
          </group>
          <mesh position={[-0.45, 0.62, D / 2 + 0.45]} castShadow><boxGeometry args={[0.95, 0.04, 0.8]} /><meshStandardMaterial color="#DAD8D2" /></mesh>
        </group>
      ))}
    </group>
  )
}

/* ---------- EV hub: building with PV roof + carport ---------- */
function EvHub({ v }: { v: SiteView }) {
  const C = 4
  const n = Math.min(rowsOf(v.site), 8)
  const led = useMemo(() => new THREE.Color('#3BE0A0').multiplyScalar(2), [])
  return (
    <group>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[7.9, 0.03, 7.9]} />
        <meshStandardMaterial color="#C9CBCB" />
      </mesh>
      <mesh position={[0, 0.95, -2.1]} castShadow receiveShadow>
        <boxGeometry args={[7.2, 1.7, 3.2]} />
        <meshStandardMaterial color="#F2F1ED" />
      </mesh>
      <mesh position={[0, 1.83, -2.1]}>
        <boxGeometry args={[7.3, 0.08, 3.3]} />
        <meshStandardMaterial color="#D9D7D1" />
      </mesh>
      <mesh position={[0, 0.65, -0.48]}>
        <boxGeometry args={[6.4, 0.85, 0.03]} />
        <meshStandardMaterial color="#93A3AE" roughness={0.1} metalness={0.4} emissive="#FFD08A" emissiveIntensity={0.08} />
      </mesh>
      {Array.from({ length: n }, (_, i) => {
        const col = i % C, row = Math.floor(i / C)
        return (
          <group key={i} position={[-2.7 + col * 1.8, 1.87, -3.0 + row * 1.5]}>
            <BlockRow v={v} row={i} w={1.6} d={1.1} tilt={0.18} legs={false} />
          </group>
        )
      })}
      {[-2.7, -0.9, 0.9, 2.7].map((x, i) => (
        <group key={x} position={[x, 0.1, 1.7]}>
          <mesh position={[0.85, 0.02, 0]}><boxGeometry args={[0.04, 0.01, 2.0]} /><meshBasicMaterial color="#F4F4F0" /></mesh>
          <mesh position={[0, 0.3, -1.05]} castShadow><boxGeometry args={[0.2, 0.6, 0.14]} /><meshStandardMaterial color="#F6F6F3" /></mesh>
          <mesh position={[0, 0.5, -0.97]}><boxGeometry args={[0.12, 0.08, 0.02]} /><meshBasicMaterial color={led} toneMapped={false} /></mesh>
          {i !== 1 && (
            <group position={[0, 0.14, 0.05]}>
              <mesh castShadow><boxGeometry args={[0.7, 0.24, 1.3]} /><meshStandardMaterial color={['#F4F4F2', '#5A6B85', '#2B2F35', '#C9CCD0'][i]} roughness={0.3} metalness={0.2} /></mesh>
              <mesh position={[0, 0.2, -0.05]}><boxGeometry args={[0.6, 0.18, 0.7]} /><meshStandardMaterial color="#56606A" roughness={0.15} /></mesh>
            </group>
          )}
        </group>
      ))}
      {[-3.5, 3.5].map((x) => (
        <mesh key={x} position={[x, 0.7, 1.7]}><boxGeometry args={[0.08, 1.2, 0.08]} /><meshStandardMaterial color="#A3A9AE" /></mesh>
      ))}
      <mesh position={[0, 1.32, 1.7]} castShadow>
        <boxGeometry args={[7.2, 0.05, 2.0]} />
        <meshStandardMaterial map={pvTexture()} color="#C4CCD8" roughness={0.3} metalness={0.4} />
      </mesh>
    </group>
  )
}

/* ---------- real houses chosen for the rooftop initiative (geo townships) ---------- */
export interface HouseRect { x: number; z: number; w: number; d: number; ry: number; h: number; roofH: number }
function RealRooftops({ v, houses, cx, cz }: { v: SiteView; houses: HouseRect[]; cx: number; cz: number }) {
  const roofGeo = useMemo(gableGeometry, [])
  return (
    <group>
      {houses.map((hh, i) => {
        const alpha = Math.atan(hh.roofH / (hh.d / 2 + 0.05))
        const slant = Math.hypot(hh.roofH, hh.d / 2)
        return (
          <group key={i} position={[hh.x - cx, 0.09, hh.z - cz]} rotation={[0, hh.ry, 0]}>
            <mesh position={[0, hh.h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[hh.w, hh.h, hh.d]} />
              <meshStandardMaterial color={RT_WALLS[i % RT_WALLS.length]} />
            </mesh>
            <mesh geometry={roofGeo} position={[0, hh.h, 0]} scale={[hh.w + 0.06, hh.roofH, hh.d + 0.1]} castShadow receiveShadow>
              <meshStandardMaterial color="#B5B2AB" />
            </mesh>
            <group position={[0, hh.h + hh.roofH * 0.5 + 0.02, (hh.d / 2 + 0.05) * 0.5]}>
              <BlockRow v={v} row={i} w={hh.w * 0.8} d={slant * 0.7} tilt={alpha} legs={false} />
            </group>
          </group>
        )
      })}
    </group>
  )
}

/* ---------- a whole site: model + glow + pin anchor ---------- */
export interface SitePlacement { x: number; z: number; scale: number; glow: number; houses?: HouseRect[] }
export function SiteNode({ v, anchors, at }: { v: SiteView; anchors: Map<string, THREE.Object3D>; at?: SitePlacement }) {
  const { site } = v
  const cx = at ? at.x : blockCenter(site.block[0]), cz = at ? at.z : blockCenter(site.block[1])
  const k = at?.scale ?? 1
  return (
    <group position={[cx, 0, cz]}>
      <Glow selected={v.selected} dimmed={v.dimmed} size={at?.glow ?? 8.2} />
      {at?.houses ? (
        <RealRooftops v={v} houses={at.houses} cx={cx} cz={cz} />
      ) : (
        <group scale={k}>
          {site.kind === 'rooftop' ? <Rooftops v={v} /> : site.kind === 'ev' ? <EvHub v={v} /> : <Farm v={v} />}
        </group>
      )}
      <group position={[0, 0.3 * k, 0]} ref={(o) => { if (o) anchors.set(site.id, o); else anchors.delete(site.id) }} />
    </group>
  )
}

/* ---------- DOM pins, positioned every frame from their 3D anchors ---------- */
const v3 = new THREE.Vector3()
interface Placed { el: HTMLElement; x: number; y: number; w: number; base: number; extra: number }
export function PinProjector({ anchors, pins }: { anchors: Map<string, THREE.Object3D>; pins: RefObject<Map<string, HTMLElement>> }) {
  useFrame(({ camera, size }) => {
    const placed: Placed[] = []
    pins.current.forEach((el, id) => {
      const a = anchors.get(id)
      if (!a) { el.style.visibility = 'hidden'; return }
      a.getWorldPosition(v3).project(camera)
      const x = ((v3.x + 1) / 2) * size.width
      const y = ((1 - v3.y) / 2) * size.height
      const hidden = v3.z > 1
      el.style.visibility = hidden ? 'hidden' : 'visible'
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      el.style.zIndex = String(Math.round((1 - v3.z) * 10000))
      const label = el.querySelector<HTMLElement>('.pin-label')
      if (!hidden && label) placed.push({ el, x, y, w: label.offsetWidth, base: Number(el.dataset.stem) || 24, extra: 0 })
    })
    // declutter: nearer pins (lower on screen) keep their spot, others lift until labels stop overlapping
    placed.sort((p, q) => q.y - p.y)
    const H = 36
    placed.forEach((p, i) => {
      for (let guard = 0; guard < 14; guard++) {
        const top = p.y - p.base - p.extra - H
        const hit = placed.slice(0, i).some((q) => {
          const qt = q.y - q.base - q.extra - H
          return Math.abs(p.x - q.x) < (p.w + q.w) / 2 + 6 && Math.abs(top - qt) < H + 4
        })
        if (!hit) break
        p.extra += 8
      }
      const stem = p.el.querySelector<HTMLElement>('.pin-stem')
      if (stem) stem.style.height = `${p.base + p.extra}px`
    })
  })
  return null
}

/** staggered stem heights keep neighbouring labels from colliding */
const STEM: Record<Site['kind'], number> = { subscription: 26, investment: 40, rooftop: 32, ev: 20 }

export function Pin({ site, selected, compact, dimmed, mine, onSelect, register }: {
  site: Site; selected: boolean; compact: boolean; dimmed: boolean; mine: number; onSelect: () => void
  register: (el: HTMLElement | null) => void
}) {
  const meta = KINDS[site.kind]
  return (
    <div ref={register} className="pin-anchor" data-stem={compact ? 20 : STEM[site.kind]} style={{ visibility: 'hidden', pointerEvents: dimmed ? 'none' : 'auto' }}>
      <div
        className={`pin${selected ? ' active' : ''}${dimmed ? ' dim' : ''}${compact ? ' compact' : ''}`}
        onClick={(e) => { e.stopPropagation(); onSelect() }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onSelect() }}
        aria-label={`${site.name}, ${meta.label}`}
      >
        <div className="pin-label">
          <span className="pi">{createElement(meta.icon, { size: 14, strokeWidth: 2.4 })}</span>
          <span className="pin-text">{meta.label}</span>
          {mine > 0 && !compact && <span className="mine">Yours</span>}
        </div>
        <div className="pin-stem" />
        <div className="pin-dot" />
      </div>
    </div>
  )
}

/* ---------- energy flowing from sites to homes ---------- */
export function EnergyFlow({ sources, homes, seed }: { sources: [number, number][]; homes: { x: number; z: number; h: number }[]; seed: number }) {
  const curves = useMemo(() => {
    const r = rng(seed + 7)
    const out: THREE.QuadraticBezierCurve3[] = []
    if (!homes.length) return out
    for (const [sx, sz] of sources) {
      const from = new THREE.Vector3(sx, 0.9, sz)
      // prefer homes within a sensible radius of the source
      const near = homes.filter((h) => Math.hypot(h.x - sx, h.z - sz) < 40)
      const pool = near.length > 5 ? near : homes
      for (let k = 0; k < 5; k++) {
        const h = pool[Math.floor(r() * pool.length)]
        const to = new THREE.Vector3(h.x, h.h + 0.7, h.z)
        const mid = from.clone().lerp(to, 0.5)
        mid.y = 3 + from.distanceTo(to) * 0.16
        out.push(new THREE.QuadraticBezierCurve3(from, mid, to))
      }
    }
    return out
  }, [sources, homes, seed])

  const PER = 4
  const n = curves.length * PER
  const ref = useRef<THREE.InstancedMesh>(null)
  const lines = useMemo(() => curves.map((c) => {
    const l = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(c.getPoints(24)),
      new THREE.LineDashedMaterial({ color: AMBER, transparent: true, opacity: 0.45, dashSize: 0.25, gapSize: 0.2 }),
    )
    l.computeLineDistances()
    return l
  }), [curves])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const glow = useMemo(() => new THREE.Color('#FF8A3A').multiplyScalar(3), [])
  useLayoutEffect(() => { if (ref.current) ref.current.count = n }, [n])
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    curves.forEach((c, ci) => {
      for (let k = 0; k < PER; k++) {
        const p = (t * 0.25 + k / PER + ci * 0.137) % 1
        c.getPoint(p, tmp.position)
        tmp.scale.setScalar(Math.sin(p * Math.PI) * 0.9 + 0.2)
        tmp.updateMatrix()
        ref.current!.setMatrixAt(ci * PER + k, tmp.matrix)
      }
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      {lines.map((l, i) => <primitive key={i} object={l} />)}
      <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, n)]}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
