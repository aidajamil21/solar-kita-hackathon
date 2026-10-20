import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BOULEVARD_W, HALF, rng, ROAD_W, ROADS, WORLD, type Layout, type Patch } from './gen'

/** shared, smoothly-interpolated night factor (0 = day, 1 = night) */
export const env = { night: 0 }

const tmp = new THREE.Object3D()
const col = new THREE.Color()
const roadW = (r: number) => (r === 0 ? BOULEVARD_W : ROAD_W)

/* ---------- sky colour + distance fog that hides the world edge ---------- */
const DAY_BG = new THREE.Color('#EEF0EC')
const NIGHT_BG = new THREE.Color('#0E1522')
export function Atmosphere({ night }: { night: boolean }) {
  const scene = useThree((s) => s.scene)
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null
  const bg = useMemo(() => new THREE.Color(), [])
  useLayoutEffect(() => {
    scene.background = bg
    scene.fog = new THREE.Fog(DAY_BG, 60, 160)
  }, [scene, bg])
  useFrame(({ camera }, dt) => {
    env.night += ((night ? 1 : 0) - env.night) * Math.min(1, dt * 2.5)
    bg.copy(DAY_BG).lerp(NIGHT_BG, env.night)
    const fog = scene.fog as THREE.Fog
    fog.color.copy(bg)
    const d = controls ? camera.position.distanceTo(controls.target) : 100
    fog.near = d * 1.05
    fog.far = d * 2.3
  })
  return null
}

/* ---------- ground, sidewalks, roads, markings ---------- */
export function Ground({ layout, onGroundClick }: { layout: Layout; onGroundClick: () => void }) {
  const slabs = useRef<THREE.InstancedMesh>(null)
  const n = layout.blocks.length
  useLayoutEffect(() => {
    layout.blocks.forEach((b, i) => {
      tmp.position.set(b.cx, 0.04, b.cz); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix()
      slabs.current!.setMatrixAt(i, tmp.matrix)
    })
    slabs.current!.instanceMatrix.needsUpdate = true
  }, [layout])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow onClick={(e) => { if (e.delta < 6) onGroundClick() }}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#CDD2C8" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[WORLD * 2 + 2, WORLD * 2 + 2]} />
        <meshStandardMaterial color="#BDBFBC" roughness={0.95} />
      </mesh>
      {/* raised block slabs = sidewalks/kerbs */}
      <instancedMesh ref={slabs} args={[undefined, undefined, n]} receiveShadow>
        <boxGeometry args={[10 - ROAD_W - 0.1, 0.08, 10 - ROAD_W - 0.1]} />
        <meshStandardMaterial color="#E6E7E2" roughness={0.9} />
      </instancedMesh>
      <Patches patches={layout.patches} />
      <Markings />
      {/* boulevard medians */}
      <mesh position={[0, 0.06, 0]} receiveShadow><boxGeometry args={[0.55, 0.1, WORLD * 2]} /><meshStandardMaterial color="#C3CCBA" /></mesh>
      <mesh position={[0, 0.06, 0]} receiveShadow><boxGeometry args={[WORLD * 2, 0.1, 0.55]} /><meshStandardMaterial color="#C3CCBA" /></mesh>
    </group>
  )
}

function Patches({ patches }: { patches: Patch[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    patches.forEach((p, i) => {
      tmp.position.set(p.x, 0.09, p.z); tmp.rotation.set(0, p.ry, 0); tmp.scale.set(p.w, 1, p.d); tmp.updateMatrix()
      ref.current!.setMatrixAt(i, tmp.matrix)
      ref.current!.setColorAt(i, col.set(p.color))
    })
    ref.current!.instanceMatrix.needsUpdate = true
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true
  }, [patches])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, patches.length)]} receiveShadow>
      <boxGeometry args={[1, 0.02, 1]} />
      <meshStandardMaterial roughness={0.9} />
    </instancedMesh>
  )
}

function Markings() {
  const dashes = useMemo(() => {
    const out: [number, number, boolean][] = []
    for (const r of ROADS) {
      if (r === 0 || Math.abs(r) > WORLD - 1) continue
      for (let p = -WORLD + 1; p < WORLD; p += 1.6) {
        if (ROADS.some((q) => Math.abs(q - p) < 1.4)) continue
        out.push([r, p, true], [p, r, false])
      }
    }
    // boulevard lane lines
    for (let p = -WORLD + 1; p < WORLD; p += 1.6) {
      if (ROADS.some((q) => Math.abs(q - p) < 1.8)) continue
      for (const o of [-0.85, 0.85]) out.push([o, p, true], [p, o, false])
    }
    return out
  }, [])
  const zebra = useMemo(() => {
    const out: [number, number, boolean][] = []
    for (const a of ROADS) for (const b of ROADS) {
      if (Math.abs(a) > 20 || Math.abs(b) > 20) continue
      const off = roadW(b) / 2 + 0.55
      for (let k = -2; k <= 2; k++) {
        const s = k * (roadW(a) / 5)
        out.push([a + s, b + off, true], [a + s, b - off, true], [b + off, a + s, false], [b - off, a + s, false])
      }
    }
    return out
  }, [])
  const ref = useRef<THREE.InstancedMesh>(null)
  const zref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const put = (m: THREE.InstancedMesh, arr: [number, number, boolean][]) => {
      arr.forEach(([a, b, vertical], i) => {
        tmp.position.set(a, 0.012, b); tmp.rotation.set(0, vertical ? 0 : Math.PI / 2, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix()
        m.setMatrixAt(i, tmp.matrix)
      })
      m.instanceMatrix.needsUpdate = true
    }
    put(ref.current!, dashes)
    put(zref.current!, zebra)
  }, [dashes, zebra])
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, dashes.length]}>
        <boxGeometry args={[0.07, 0.01, 0.7]} />
        <meshBasicMaterial color="#F4F4F0" />
      </instancedMesh>
      <instancedMesh ref={zref} args={[undefined, undefined, zebra.length]}>
        <boxGeometry args={[0.18, 0.01, 0.7]} />
        <meshBasicMaterial color="#F1F1EC" />
      </instancedMesh>
    </>
  )
}

/* ---------- gable-roof prism (ridge along x, unit size) ---------- */
export function gableGeometry() {
  const s = new THREE.Shape()
  s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false })
  g.translate(0, 0, -0.5)
  g.rotateY(Math.PI / 2) // extrusion now along x, slopes face ±z
  return g
}

/* ---------- houses ---------- */
export function Houses({ layout }: { layout: Layout }) {
  const walls = useRef<THREE.InstancedMesh>(null)
  const roofs = useRef<THREE.InstancedMesh>(null)
  const wins = useRef<THREE.InstancedMesh>(null)
  const roofGeo = useMemo(gableGeometry, [])
  const n = layout.houses.length
  useLayoutEffect(() => {
    layout.houses.forEach((h, i) => {
      tmp.rotation.set(0, h.ry, 0)
      tmp.position.set(h.x, h.h / 2 + 0.08, h.z); tmp.scale.set(h.w, h.h, h.d); tmp.updateMatrix()
      walls.current!.setMatrixAt(i, tmp.matrix)
      walls.current!.setColorAt(i, col.set(h.wall))
      tmp.position.set(h.x, h.h + 0.08, h.z); tmp.scale.set(h.w + 0.12, h.roofH, h.d + 0.22); tmp.updateMatrix()
      roofs.current!.setMatrixAt(i, tmp.matrix)
      roofs.current!.setColorAt(i, col.set(h.roof))
      // window band on both long faces
      tmp.position.set(h.x, h.h * 0.62 + 0.08, h.z); tmp.scale.set(h.w * 0.7, h.h * 0.22, h.d + 0.02); tmp.updateMatrix()
      wins.current!.setMatrixAt(i, tmp.matrix)
    })
    for (const m of [walls, roofs, wins]) {
      m.current!.instanceMatrix.needsUpdate = true
      if (m.current!.instanceColor) m.current!.instanceColor.needsUpdate = true
    }
  }, [layout])
  const winMat = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => { if (winMat.current) winMat.current.emissiveIntensity = env.night * 2.2 })
  return (
    <group>
      <instancedMesh ref={walls} args={[undefined, undefined, n]} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={roofs} args={[roofGeo, undefined, n]} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.75} />
      </instancedMesh>
      <instancedMesh ref={wins} args={[undefined, undefined, n]}>
        <boxGeometry />
        <meshStandardMaterial ref={winMat} color="#8F99A1" roughness={0.3} emissive="#FFC570" emissiveIntensity={0} />
      </instancedMesh>
    </group>
  )
}

/* ---------- generic flat boxes (shoplots, podiums, porches, parked cars) ---------- */
export function Boxes({ layout }: { layout: Layout }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const wins = useRef<THREE.InstancedMesh>(null)
  const tall = useMemo(() => layout.boxes.filter((b) => b.h > 1.5), [layout])
  useLayoutEffect(() => {
    layout.boxes.forEach((b, i) => {
      tmp.position.set(b.x, (b.y ?? 0.08) + b.h / 2, b.z); tmp.rotation.set(0, b.ry, 0); tmp.scale.set(b.w, b.h, b.d); tmp.updateMatrix()
      ref.current!.setMatrixAt(i, tmp.matrix)
      ref.current!.setColorAt(i, col.set(b.color))
    })
    tall.forEach((b, i) => {
      tmp.position.set(b.x, b.h * 0.62, b.z); tmp.rotation.set(0, b.ry, 0); tmp.scale.set(b.w * 0.86, b.h * 0.42, b.d + 0.02); tmp.updateMatrix()
      wins.current!.setMatrixAt(i, tmp.matrix)
    })
    ref.current!.instanceMatrix.needsUpdate = true
    wins.current!.instanceMatrix.needsUpdate = true
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true
  }, [layout, tall])
  const winMat = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => { if (winMat.current) winMat.current.emissiveIntensity = env.night * 1.8 })
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, layout.boxes.length)]} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={wins} args={[undefined, undefined, Math.max(1, tall.length)]}>
        <boxGeometry />
        <meshStandardMaterial ref={winMat} color="#9AA4AC" roughness={0.25} emissive="#FFC570" emissiveIntensity={0} />
      </instancedMesh>
    </group>
  )
}

/* ---------- trees (two-tone canopies) ---------- */
export function Trees({ layout }: { layout: Layout }) {
  const trunks = useRef<THREE.InstancedMesh>(null)
  const crowns = useRef<THREE.InstancedMesh>(null)
  const n = layout.trees.length
  useLayoutEffect(() => {
    layout.trees.forEach((t, i) => {
      tmp.rotation.set(0, i * 1.37, 0)
      tmp.position.set(t.x, 0.3 * t.s, t.z); tmp.scale.set(t.s, t.s, t.s); tmp.updateMatrix()
      trunks.current!.setMatrixAt(i, tmp.matrix)
      tmp.position.set(t.x, 0.95 * t.s, t.z); tmp.scale.set(t.s, t.s * 0.82, t.s); tmp.updateMatrix()
      crowns.current!.setMatrixAt(i, tmp.matrix)
      crowns.current!.setColorAt(i, col.set(t.leaf))
    })
    trunks.current!.instanceMatrix.needsUpdate = true
    crowns.current!.instanceMatrix.needsUpdate = true
    if (crowns.current!.instanceColor) crowns.current!.instanceColor.needsUpdate = true
  }, [layout])
  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, n]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 0.6, 5]} />
        <meshStandardMaterial color="#8C8478" />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, n]} castShadow receiveShadow>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial roughness={0.95} />
      </instancedMesh>
    </group>
  )
}

/* ---------- condo towers with facade texture & lit windows ---------- */
function useFacades() {
  return useMemo(() => {
    const make = (lit: boolean) => {
      const c = document.createElement('canvas')
      c.width = 64; c.height = 32
      const g = c.getContext('2d')!
      g.fillStyle = lit ? '#000' : '#F1F0EC'
      g.fillRect(0, 0, 64, 32)
      // balcony slab line
      if (!lit) { g.fillStyle = '#D9D8D3'; g.fillRect(0, 26, 64, 6) }
      for (let x = 0; x < 4; x++) {
        const on = (x * 3 + 1) % 4 !== 0
        g.fillStyle = lit ? (on ? '#FFD38A' : '#000') : '#8E989F'
        g.fillRect(4 + x * 15, 6, 10, 16)
      }
      const t = new THREE.CanvasTexture(c)
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      return t
    }
    return { day: make(false), lit: make(true) }
  }, [])
}

export function Towers({ layout }: { layout: Layout }) {
  const tex = useFacades()
  const mats = useRef<THREE.MeshStandardMaterial[]>([])
  useFrame(() => mats.current.forEach((m) => m && (m.emissiveIntensity = env.night * 1.6)))
  return (
    <group>
      {layout.towers.map((t, i) => {
        const floors = Math.round(t.h / 0.55)
        const map = tex.day.clone(); map.repeat.set(Math.round(t.w / 0.9), floors); map.needsUpdate = true
        const emap = tex.lit.clone(); emap.repeat.set(Math.round(t.w / 0.9), floors); emap.needsUpdate = true
        return (
          <group key={i} position={[t.x, 0, t.z]}>
            <mesh position={[0, t.h / 2 + 0.9, 0]} castShadow receiveShadow>
              <boxGeometry args={[t.w, t.h, t.d]} />
              <meshStandardMaterial ref={(m) => { if (m) mats.current[i] = m }} map={map} emissiveMap={emap} emissive="#ffffff" emissiveIntensity={0} roughness={0.7} />
            </mesh>
            <mesh position={[0, t.h + 1.0, 0]} castShadow>
              <boxGeometry args={[t.w + 0.12, 0.2, t.d + 0.12]} />
              <meshStandardMaterial color="#DCDAD4" />
            </mesh>
            <mesh position={[0.35, t.h + 1.35, -0.2]} castShadow>
              <boxGeometry args={[0.9, 0.5, 0.8]} />
              <meshStandardMaterial color="#CFCDC7" />
            </mesh>
            <mesh position={[-0.6, t.h + 1.25, 0.5]}>
              <cylinderGeometry args={[0.22, 0.22, 0.3, 12]} />
              <meshStandardMaterial color="#C7C5BF" />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/* ---------- lake & park ---------- */
export function Lake({ x, z }: { x: number; z: number }) {
  const water = useRef<THREE.MeshStandardMaterial>(null)
  const boat = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (water.current) water.current.emissiveIntensity = 0.05 + env.night * 0.08
    if (boat.current) {
      boat.current.position.set(x + Math.cos(t * 0.2) * 1.9, 0.14, z + Math.sin(t * 0.2) * 1.9)
      boat.current.rotation.y = -t * 0.2
    }
  })
  return (
    <group>
      <mesh position={[x, 0.1, z]} receiveShadow>
        <cylinderGeometry args={[3.9, 3.9, 0.04, 48]} />
        <meshStandardMaterial color="#DEDCD3" />
      </mesh>
      <mesh position={[x, 0.11, z]} receiveShadow>
        <cylinderGeometry args={[3.45, 3.45, 0.04, 48]} />
        <meshStandardMaterial ref={water} color="#A7BFC7" emissive="#BFD8E0" roughness={0.08} metalness={0.25} />
      </mesh>
      <group ref={boat}>
        <mesh castShadow><boxGeometry args={[0.5, 0.12, 0.22]} /><meshStandardMaterial color="#fff" /></mesh>
      </group>
      <mesh position={[x + 2.5, 0.16, z + 2.5]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <boxGeometry args={[0.4, 0.06, 1.8]} />
        <meshStandardMaterial color="#B9AE9C" />
      </mesh>
    </group>
  )
}

export function Park({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[8, 0.03, 8]} />
        <meshStandardMaterial color="#C7D1BD" />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <torusGeometry args={[2.6, 0.16, 4, 64]} />
        <meshStandardMaterial color="#ECE9E1" />
      </mesh>
      <mesh position={[0, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.9, 0.9, 0.08, 8]} />
        <meshStandardMaterial color="#F3F2EE" />
      </mesh>
      {Array.from({ length: 8 }, (_, k) => (
        <mesh key={k} position={[Math.cos((k / 8) * Math.PI * 2) * 0.75, 0.38, Math.sin((k / 8) * Math.PI * 2) * 0.75]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.55, 5]} />
          <meshStandardMaterial color="#fff" />
        </mesh>
      ))}
      <mesh position={[0, 0.95, 0]} castShadow>
        <coneGeometry args={[1.15, 0.5, 8]} />
        <meshStandardMaterial color="#C9C6BE" />
      </mesh>
    </group>
  )
}

/* ---------- traffic ---------- */
const CAR_COLORS = ['#F4F4F2', '#C9CCD0', '#2B2F35', '#9EA3A8', '#FFFFFF', '#7A8088', '#5A6B85', '#8E3B3B']
export function Cars({ seed }: { seed: number }) {
  const cars = useMemo(() => {
    const r = rng(seed + 99)
    const roads = ROADS.filter((x) => Math.abs(x) < WORLD)
    return Array.from({ length: 46 }, (_, i) => {
      const road = roads[Math.floor(r() * roads.length)]
      const dir = r() < 0.5 ? 1 : -1
      return {
        vertical: i % 2 === 0, road, dir,
        lane: road === 0 ? dir * (0.6 + (r() < 0.5 ? 0.55 : 0)) : dir * 0.42,
        speed: 1.4 + r() * 1.6, offset: r() * WORLD * 2, color: CAR_COLORS[i % CAR_COLORS.length],
      }
    })
  }, [seed])
  const body = useRef<THREE.InstancedMesh>(null)
  const cabin = useRef<THREE.InstancedMesh>(null)
  const lights = useRef<THREE.InstancedMesh>(null)
  const lightMat = useRef<THREE.MeshBasicMaterial>(null)
  useLayoutEffect(() => {
    cars.forEach((c, i) => body.current!.setColorAt(i, col.set(c.color)))
    if (body.current!.instanceColor) body.current!.instanceColor.needsUpdate = true
  }, [cars])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    cars.forEach((c, i) => {
      const p = (((c.offset + t * c.speed) % (WORLD * 2)) - WORLD) * c.dir
      const x = c.vertical ? c.road + c.lane : p
      const z = c.vertical ? p : c.road - c.lane
      const ry = c.vertical ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      tmp.rotation.set(0, ry, 0); tmp.scale.set(1, 1, 1)
      tmp.position.set(x, 0.12, z); tmp.updateMatrix(); body.current!.setMatrixAt(i, tmp.matrix)
      tmp.position.set(x - Math.sin(ry) * 0.04, 0.27, z - Math.cos(ry) * 0.04); tmp.updateMatrix(); cabin.current!.setMatrixAt(i, tmp.matrix)
      tmp.position.set(x + Math.sin(ry) * 0.31, 0.13, z + Math.cos(ry) * 0.31); tmp.updateMatrix(); lights.current!.setMatrixAt(i, tmp.matrix)
    })
    body.current!.instanceMatrix.needsUpdate = true
    cabin.current!.instanceMatrix.needsUpdate = true
    lights.current!.instanceMatrix.needsUpdate = true
    if (lightMat.current) lightMat.current.opacity = env.night
  })
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

/* ---------- street lamps ---------- */
export function StreetLights() {
  const pts = useMemo(() => {
    const out: [number, number][] = []
    for (const r of ROADS) {
      if (Math.abs(r) > HALF) continue
      const o = roadW(r) / 2 + 0.25
      for (let p = -HALF + 2; p < HALF; p += 4) {
        if (ROADS.some((q) => Math.abs(q - p) < 1.6)) continue
        out.push([r + o, p], [p, r - o])
      }
    }
    return out
  }, [])
  const poles = useRef<THREE.InstancedMesh>(null)
  const bulbs = useRef<THREE.InstancedMesh>(null)
  const bulbMat = useRef<THREE.MeshBasicMaterial>(null)
  useLayoutEffect(() => {
    pts.forEach(([x, z], i) => {
      tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1)
      tmp.position.set(x, 0.45, z); tmp.updateMatrix(); poles.current!.setMatrixAt(i, tmp.matrix)
      tmp.position.set(x, 0.92, z); tmp.updateMatrix(); bulbs.current!.setMatrixAt(i, tmp.matrix)
    })
    poles.current!.instanceMatrix.needsUpdate = true
    bulbs.current!.instanceMatrix.needsUpdate = true
  }, [pts])
  const warm = useMemo(() => new THREE.Color('#FFD08A'), [])
  const off = useMemo(() => new THREE.Color('#D6D6D2'), [])
  useFrame(() => { if (bulbMat.current) bulbMat.current.color.copy(off).lerp(warm, env.night).multiplyScalar(1 + env.night * 3) })
  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, undefined, pts.length]}>
        <cylinderGeometry args={[0.025, 0.03, 0.9, 4]} />
        <meshStandardMaterial color="#7D8389" />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, pts.length]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial ref={bulbMat} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
