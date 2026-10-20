import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Site, SiteKind } from '../../data'
import { extrudeBuildings, flatGeometry, GS, orientedRect, pointInPoly, polyArea, polylineSampler, ptsOf, ribbonGeometry, type GeoData } from './geo'
import { LEAVES, rng, ROOFS, WALLS, type House, type Layout, type Tree } from './gen'
import { env, Houses, Trees } from './Scenery'
import { EnergyFlow, SiteNode, type HouseRect, type SitePlacement, type UnitState } from './Sites'

export interface GeoTownProps {
  geo: GeoData
  seed: number
  sites: Site[]
  selectedId: string | null
  filter: SiteKind | 'all'
  flow: boolean
  anchors: Map<string, THREE.Object3D>
  unitState: (site: Site, i: number) => UnitState
  onSelect: (id: string | null) => void
  onUnit: (site: Site, i: number) => void
}

const SITE_SCALE: Record<SiteKind, number> = { subscription: 1.9, investment: 2.3, ev: 0.75, rooftop: 1 }
const BUILDING_COLORS: Record<string, string> = { a: '#F1F0EB', c: '#ECE9E2', i: '#DFDED9', p: '#F0EBE1', y: '#F4F3EF', h: '#F5F4F0' }
const GREEN_COLORS: Record<string, string> = { park: '#C6D2BB', golf: '#BCD2AA', pitch: '#B6CEA5', farm: '#D3D7C3' }

function hash(n: number) { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x) }

/* ---------- convert OSM data into render-ready structures (memoised per township) ---------- */
function useProcessed(geo: GeoData, seed: number) {
  return useMemo(() => {
    const r = rng(seed + 501)
    const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
    const rooftopIdx = new Set(geo.sites.rooftop?.houses ?? [])
    const houses: House[] = []
    const rooftop: HouseRect[] = []
    const extruded: { p: [number, number][]; h: number; color: string }[] = []

    geo.buildings.forEach((b, i) => {
      const p = ptsOf(b.p)
      if (p.length < 3) return
      const areaU = Math.abs(polyArea(p))
      const areaM = areaU / (GS * GS)
      const rect = orientedRect(p)
      const fill = areaU / Math.max(rect.area, 1e-6)
      const pitched = rooftopIdx.has(i) || ((b.k === 'h' || b.k === 'y') && areaM < 700 && fill > 0.7 && (!b.h || b.h <= 12))
      if (pitched) {
        const dM = rect.d / GS
        const hr: HouseRect = { x: rect.cx, z: rect.cz, w: rect.w, d: rect.d, ry: rect.ry, h: (b.h || 7.5) * GS, roofH: Math.min(dM * 0.38, 3.2) * GS }
        if (rooftopIdx.has(i)) { rooftop.push(hr); return }
        houses.push({ ...hr, wall: pick(WALLS), roof: pick(ROOFS) })
        return
      }
      const h = b.h || (b.k === 'a' ? 26 + hash(i) * 40 : b.k === 'c' ? 12 + hash(i) * 8 : b.k === 'i' ? 10 : b.k === 'p' ? 12 : areaM > 2000 ? 11 : 8)
      extruded.push({ p, h: h * GS, color: BUILDING_COLORS[b.k] ?? BUILDING_COLORS.y })
    })

    const roads = geo.roads.map((x) => ({ p: ptsOf(x.p), w: x.w * GS, color: x.w >= 10 ? '#B7BAB8' : x.w >= 6 ? '#C2C4C1' : '#CDCECA' }))
    const rivers = geo.rivers.map((x) => ({ p: ptsOf(x.p), w: x.w * GS, color: '#A7C1CA' }))
    // only fill closed rings: multipolygon members can be open fragments of a larger outline
    const closed = (f: number[]) => f.length >= 8 && f[0] === f[f.length - 2] && f[1] === f[f.length - 1]
    const water = geo.water.filter((x) => closed(x.p)).map((x) => ptsOf(x.p))
    const green = geo.green.filter((x) => closed(x.p)).map((x) => ({ p: ptsOf(x.p), c: GREEN_COLORS[x.k] ?? GREEN_COLORS.park }))
    const forest = geo.forest.filter((x) => closed(x.p)).map((x) => ptsOf(x.p))
    const parking = geo.parking.filter((x) => closed(x.p)).map((x) => ptsOf(x.p))

    // trees: dense in woods/plantations, sparse in parks, lining local streets
    const trees: Tree[] = []
    const scatter = (p: [number, number][], perArea: number, cap: number) => {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
      for (const [x, z] of p) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z) }
      const n = Math.min(cap, Math.round(Math.abs(polyArea(p)) / perArea))
      for (let k = 0, tries = 0; k < n && tries < n * 4; tries++) {
        const x = minX + r() * (maxX - minX), z = minZ + r() * (maxZ - minZ)
        if (!pointInPoly(x, z, p)) continue
        trees.push({ x, z, s: 0.55 + r() * 0.6, leaf: pick(LEAVES) }); k++
      }
    }
    forest.forEach((p) => scatter(p, 0.9, 500))
    green.forEach((g) => scatter(g.p, 3.5, 120))
    for (const rd of roads) {
      if (rd.w < 0.4 || rd.w > 1.1 || trees.length > 7000) continue
      const s = polylineSampler(rd.p)
      const o = { x: 0, z: 0, ang: 0 }
      for (let t = 0.6; t < s.total; t += 1.3) {
        if (r() < 0.55) continue
        s.at(t, o)
        const side = r() < 0.5 ? 1 : -1, off = rd.w / 2 + 0.25
        trees.push({ x: o.x + Math.cos(o.ang) * off * side, z: o.z - Math.sin(o.ang) * off * side, s: 0.32 + r() * 0.15, leaf: pick(LEAVES) })
      }
    }

    infill(houses, roads, water, rivers, green.map((g) => g.p), forest, parking, extruded.map((b) => b.p), r, pick)

    const layout: Layout = { houses, boxes: [], trees, towers: [], patches: [], blocks: [] }
    const { walls, roof } = extrudeBuildings(extruded)
    return {
      layout, rooftop, walls, roof,
      roadGeo: ribbonGeometry(roads, 0.02),
      riverGeo: ribbonGeometry(rivers, 0.03),
      waterGeo: flatGeometry(water, 0.035),
      greenGeo: flatGeometry(green.map((g) => g.p), 0.012, green.map((g) => g.c)),
      forestGeo: flatGeometry(forest, 0.011, forest.map(() => '#BAC7B1')),
      parkingGeo: flatGeometry(parking, 0.016, parking.map(() => '#D2D3D0')),
      lanes: roads.filter((x) => x.w >= 0.5 && x.p.length > 1).map((x) => ({ s: polylineSampler(x.p), w: x.w })).filter((l) => l.s.total > 8),
      lamps: roads.filter((x) => x.w >= 0.8),
      homes: houses.map((h) => ({ x: h.x, z: h.z, h: h.h })),
    }
  }, [geo, seed])
}

/* ---------- infill: OSM often lacks house footprints, so line unmapped residential streets with terraces ---------- */
function infill(
  houses: House[], roads: { p: [number, number][]; w: number }[], water: [number, number][][], rivers: { p: [number, number][]; w: number }[],
  greens: [number, number][][], forest: [number, number][][], parking: [number, number][][], blds: [number, number][][],
  r: () => number, pick: <T>(a: T[]) => T,
) {
  const C = 0.5, H = 100, N = Math.ceil((2 * H) / C)
  const occ = new Uint8Array(N * N)
  const idx = (x: number, z: number) => { const i = Math.floor((x + H) / C), k = Math.floor((z + H) / C); return i < 0 || k < 0 || i >= N || k >= N ? -1 : k * N + i }
  const markDisc = (x: number, z: number, rad: number) => {
    for (let dx = -rad; dx <= rad; dx += C) for (let dz = -rad; dz <= rad; dz += C) { const j = idx(x + dx, z + dz); if (j >= 0) occ[j] = 1 }
  }
  const markPoly = (p: [number, number][], pad = 0) => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const [x, z] of p) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z) }
    if (maxX - minX > 120 || maxZ - minZ > 120) return
    for (let x = minX - pad; x <= maxX + pad; x += C) for (let z = minZ - pad; z <= maxZ + pad; z += C) {
      if (pointInPoly(x, z, p)) { const j = idx(x, z); if (j >= 0) occ[j] = 1 }
    }
  }
  const markLine = (p: [number, number][], rad: number) => {
    const s = polylineSampler(p)
    const o = { x: 0, z: 0, ang: 0 }
    for (let t = 0; t <= s.total; t += C * 0.8) { s.at(t, o); markDisc(o.x, o.z, rad) }
  }
  roads.forEach((rd) => markLine(rd.p, rd.w / 2 + 0.15))
  rivers.forEach((rv) => markLine(rv.p, rv.w / 2 + 0.3))
  ;[...water, ...greens, ...forest, ...parking].forEach((p) => markPoly(p))
  blds.forEach((p) => markPoly(p, 0.6))
  houses.forEach((h) => markDisc(h.x, h.z, Math.max(h.w, h.d) / 2 + 0.3))

  const free = (x: number, z: number) => { const j = idx(x, z); return j >= 0 && !occ[j] }
  const o = { x: 0, z: 0, ang: 0 }
  for (const rd of roads) {
    if (rd.w < 0.38 || rd.w > 0.72 || houses.length > 6500) continue
    const s = polylineSampler(rd.p)
    for (const side of [1, -1]) {
      const wall = pick(WALLS), roof = pick(ROOFS)
      for (let t = 0.8; t < s.total - 0.8; t += 0.6) {
        s.at(t, o)
        if (Math.hypot(o.x, o.z) > 82 || r() < 0.06) continue
        const nx = Math.cos(o.ang) * side, nz = -Math.sin(o.ang) * side
        const off = rd.w / 2 + 0.75
        const x = o.x + nx * off, z = o.z + nz * off
        if (!free(x, z) || !free(x + nx * 0.45, z + nz * 0.45) || !free(x - nx * 0.4, z - nz * 0.4)) continue
        houses.push({ x, z, w: 0.56, d: 1.0, h: 0.6 + (r() < 0.15 ? 0.25 : 0), ry: o.ang - Math.PI / 2, roofH: 0.2, wall, roof })
        markDisc(x, z, 0.5)
      }
    }
  }
}

/* ---------- facade texture for extruded buildings (4 x 4 windows per tile) ---------- */
function useFacade() {
  return useMemo(() => {
    const make = (lit: boolean) => {
      const c = document.createElement('canvas')
      c.width = c.height = 128
      const g = c.getContext('2d')!
      g.fillStyle = lit ? '#000' : '#FFFFFF'
      g.fillRect(0, 0, 128, 128)
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const on = (x * 5 + y * 3) % 7 > 2
        g.fillStyle = lit ? (on ? '#FFD08A' : '#000') : '#A4ADB4'
        g.fillRect(x * 32 + 7, y * 32 + 9, 18, 15)
      }
      if (!lit) { g.fillStyle = '#E4E3DE'; for (let y = 0; y < 4; y++) g.fillRect(0, y * 32 + 28, 128, 3) }
      const t = new THREE.CanvasTexture(c)
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.colorSpace = THREE.SRGBColorSpace
      t.repeat.set(0.25, 0.25)
      t.anisotropy = 4
      return t
    }
    return { day: make(false), lit: make(true) }
  }, [])
}

export default function GeoTown(props: GeoTownProps) {
  const { geo, sites } = props
  const d = useProcessed(geo, props.seed)
  const tex = useFacade()
  const wallMat = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => { if (wallMat.current) wallMat.current.emissiveIntensity = env.night * 1.5 })

  const placements = useMemo(() => {
    const out = new Map<string, SitePlacement>()
    sites.forEach((s, k) => {
      const g = geo.sites[s.kind]
      if (s.kind === 'rooftop' && d.rooftop.length) {
        const xs = d.rooftop.map((h) => h.x), zs = d.rooftop.map((h) => h.z)
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2
        const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) + 2.2
        out.set(s.id, { x: cx, z: cz, scale: 1, glow: Math.min(span, 9), houses: d.rooftop })
      } else {
        const sc = SITE_SCALE[s.kind]
        const x = g ? g.x * GS : (k - 1.5) * 14, z = g ? g.z * GS : 30
        out.set(s.id, { x, z, scale: sc, glow: 8.2 * sc })
      }
    })
    return out
  }, [sites, geo, d.rooftop])

  const sources = useMemo(
    () => sites.filter((s) => props.filter === 'all' || s.kind === props.filter).map((s) => { const p = placements.get(s.id)!; return [p.x, p.z] as [number, number] }),
    [sites, props.filter, placements],
  )

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow onClick={(e) => { if (e.delta < 6) props.onSelect(null) }}>
        <planeGeometry args={[700, 700]} />
        <meshStandardMaterial color="#DADDD6" roughness={1} />
      </mesh>
      <mesh geometry={d.greenGeo} receiveShadow><meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={1} /></mesh>
      <mesh geometry={d.forestGeo} receiveShadow><meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={1} /></mesh>
      <mesh geometry={d.parkingGeo} receiveShadow><meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={1} /></mesh>
      <mesh geometry={d.waterGeo}><meshStandardMaterial color="#A6C0C9" emissive="#BFD8E0" emissiveIntensity={0.06} roughness={0.1} metalness={0.25} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={d.riverGeo}><meshStandardMaterial vertexColors roughness={0.1} metalness={0.25} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={d.roadGeo} receiveShadow><meshStandardMaterial vertexColors roughness={0.95} side={THREE.DoubleSide} /></mesh>

      <mesh geometry={d.walls} castShadow receiveShadow>
        <meshStandardMaterial ref={wallMat} vertexColors map={tex.day} emissiveMap={tex.lit} emissive="#ffffff" emissiveIntensity={0} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={d.roof} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <Houses layout={d.layout} />
      <Trees layout={d.layout} />
      <GeoCars lanes={d.lanes} seed={props.seed} />
      <GeoLamps roads={d.lamps} />

      {sites.map((s) => (
        <SiteNode
          key={s.id}
          anchors={props.anchors}
          at={placements.get(s.id)}
          v={{
            site: s,
            selected: props.selectedId === s.id,
            anySelected: props.selectedId !== null,
            dimmed: props.filter !== 'all' && props.filter !== s.kind,
            unitState: (i) => props.unitState(s, i),
            onSelect: () => props.onSelect(s.id),
            onUnit: (i) => props.onUnit(s, i),
          }}
        />
      ))}
      {props.flow && <EnergyFlow sources={sources} homes={d.homes} seed={props.seed} />}
    </group>
  )
}

/* ---------- traffic that follows the real street network ---------- */
const CAR_COLORS = ['#F4F4F2', '#C9CCD0', '#2B2F35', '#9EA3A8', '#FFFFFF', '#7A8088', '#5A6B85', '#8E3B3B']
const tmp = new THREE.Object3D()
const col = new THREE.Color()
function GeoCars({ lanes, seed }: { lanes: { s: ReturnType<typeof polylineSampler>; w: number }[]; seed: number }) {
  const cars = useMemo(() => {
    if (!lanes.length) return []
    const r = rng(seed + 77)
    const weighted = lanes.flatMap((l) => Array(Math.max(1, Math.round(l.s.total / 25))).fill(l))
    return Array.from({ length: Math.min(70, weighted.length * 2) }, (_, i) => {
      const lane = weighted[Math.floor(r() * weighted.length)]
      return { lane, t: r() * lane.s.total, speed: (0.6 + r() * 0.7) * (r() < 0.5 ? 1 : -1), color: CAR_COLORS[i % CAR_COLORS.length] }
    })
  }, [lanes, seed])
  const body = useRef<THREE.InstancedMesh>(null)
  const cabin = useRef<THREE.InstancedMesh>(null)
  const lights = useRef<THREE.InstancedMesh>(null)
  const lightMat = useRef<THREE.MeshBasicMaterial>(null)
  const o = useMemo(() => ({ x: 0, z: 0, ang: 0 }), [])
  useLayoutEffect(() => {
    if (!body.current) return
    cars.forEach((c, i) => body.current!.setColorAt(i, col.set(c.color)))
    if (body.current.instanceColor) body.current.instanceColor.needsUpdate = true
  }, [cars])
  useFrame((_, dt) => {
    if (!body.current || !cabin.current || !lights.current) return
    cars.forEach((c, i) => {
      c.t += c.speed * dt
      c.lane.s.at(c.t, o)
      const dir = c.speed > 0 ? 1 : -1
      const ang = dir > 0 ? o.ang : o.ang + Math.PI
      const off = c.lane.w * 0.22
      const x = o.x + Math.cos(o.ang) * off * dir, z = o.z - Math.sin(o.ang) * off * dir
      tmp.rotation.set(0, ang, 0); tmp.scale.setScalar(0.42)
      tmp.position.set(x, 0.07, z); tmp.updateMatrix(); body.current!.setMatrixAt(i, tmp.matrix)
      tmp.position.set(x, 0.13, z); tmp.updateMatrix(); cabin.current!.setMatrixAt(i, tmp.matrix)
      tmp.position.set(x + Math.sin(ang) * 0.13, 0.08, z + Math.cos(ang) * 0.13); tmp.updateMatrix(); lights.current!.setMatrixAt(i, tmp.matrix)
    })
    body.current.instanceMatrix.needsUpdate = true
    cabin.current.instanceMatrix.needsUpdate = true
    lights.current.instanceMatrix.needsUpdate = true
    if (lightMat.current) lightMat.current.opacity = env.night
  })
  if (!cars.length) return null
  return (
    <group>
      <instancedMesh ref={body} args={[undefined, undefined, cars.length]} castShadow>
        <boxGeometry args={[0.3, 0.16, 0.62]} />
        <meshStandardMaterial roughness={0.35} metalness={0.2} />
      </instancedMesh>
      <instancedMesh ref={cabin} args={[undefined, undefined, cars.length]}>
        <boxGeometry args={[0.26, 0.13, 0.32]} />
        <meshStandardMaterial color="#5C6670" roughness={0.15} metalness={0.3} />
      </instancedMesh>
      <instancedMesh ref={lights} args={[undefined, undefined, cars.length]}>
        <boxGeometry args={[0.24, 0.04, 0.03]} />
        <meshBasicMaterial ref={lightMat} color={new THREE.Color('#FFF2C4').multiplyScalar(3)} transparent opacity={0} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

/* ---------- street lamps along main roads ---------- */
function GeoLamps({ roads }: { roads: { p: [number, number][]; w: number }[] }) {
  const pts = useMemo(() => {
    const out: [number, number][] = []
    const o = { x: 0, z: 0, ang: 0 }
    for (const rd of roads) {
      const s = polylineSampler(rd.p)
      for (let t = 1; t < s.total && out.length < 600; t += 3.2) {
        s.at(t, o)
        const off = rd.w / 2 + 0.15
        out.push([o.x + Math.cos(o.ang) * off, o.z - Math.sin(o.ang) * off])
      }
    }
    return out
  }, [roads])
  const bulbs = useRef<THREE.InstancedMesh>(null)
  const poles = useRef<THREE.InstancedMesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  useLayoutEffect(() => {
    if (!bulbs.current || !poles.current) return
    pts.forEach(([x, z], i) => {
      tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(1)
      tmp.position.set(x, 0.3, z); tmp.updateMatrix(); poles.current!.setMatrixAt(i, tmp.matrix)
      tmp.position.set(x, 0.62, z); tmp.updateMatrix(); bulbs.current!.setMatrixAt(i, tmp.matrix)
    })
    bulbs.current.instanceMatrix.needsUpdate = true
    poles.current.instanceMatrix.needsUpdate = true
  }, [pts])
  const warm = useMemo(() => new THREE.Color('#FFD08A'), [])
  const off = useMemo(() => new THREE.Color('#D6D6D2'), [])
  useFrame(() => { if (mat.current) mat.current.color.copy(off).lerp(warm, env.night).multiplyScalar(1 + env.night * 3) })
  if (!pts.length) return null
  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, undefined, pts.length]}>
        <cylinderGeometry args={[0.015, 0.02, 0.6, 4]} />
        <meshStandardMaterial color="#7D8389" />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, pts.length]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshBasicMaterial ref={mat} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
