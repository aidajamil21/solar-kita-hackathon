import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Site, SiteKind, Township } from '../../data'
import { blockCenter, buildLayout, HALF } from './gen'
import { GEO_HALF, loadGeo, type GeoData } from './geo'
import GeoTown from './GeoTown'
import { Atmosphere, Boxes, Cars, Ground, Houses, Lake, Park, StreetLights, Towers, Trees, env } from './Scenery'
import { EnergyFlow, Pin, PinProjector, SiteNode, type UnitState } from './Sites'

export interface MapApi {
  zoom: (factor: number) => void
  reset: () => void
  focus: (site: Site) => void
}

interface Props {
  township: Township
  sites: Site[]
  selectedId: string | null
  filter: SiteKind | 'all'
  night: boolean
  flow: boolean
  autoRotate: boolean
  unitState: (site: Site, i: number) => UnitState
  mineCount: (site: Site) => number
  onSelect: (id: string | null) => void
  onUnit: (site: Site, i: number) => void
  onInteract: () => void
  onLoading?: (loading: boolean) => void
  api: RefObject<MapApi | null>
}

/** camera framing per world type: real townships are ~2.2 km across, the generated one ~0.9 */
interface Frame { k: number; half: number }
const MODEL: Frame = { k: 1, half: HALF }
const REAL: Frame = { k: 1.45, half: GEO_HALF * 0.8 }

const POLAR = 0.92

/* ---------- camera rig: smooth fly-to, zoom, clamped pan ---------- */
function Rig({ api, onInteract, frame, anchors, frameKey }: { api: RefObject<MapApi | null>; onInteract: () => void; frame: Frame; anchors: Map<string, THREE.Object3D>; frameKey: string }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const size = useThree((s) => s.size)
  const goal = useRef<{ t: THREE.Vector3; p: THREE.Vector3 } | null>(null)
  const intro = useRef('')
  const { k, half } = frame

  const homeDist = useMemo(() => {
    const aspect = size.width / size.height
    const halfH = Math.atan(Math.tan(THREE.MathUtils.degToRad(19)) * Math.min(aspect, 1.4))
    // fit most of the town across the screen width
    return THREE.MathUtils.clamp(24 / Math.tan(halfH), 58, 160) * k
  }, [size, k])

  useEffect(() => {
    if (!controls) return
    const stop = () => { goal.current = null; onInteract() }
    controls.addEventListener('start', stop)
    return () => { controls.removeEventListener('start', stop) }
  }, [controls, onInteract])

  useEffect(() => {
    if (!controls) return
    const az = Math.PI / 4
    const fly = (target: THREE.Vector3, dist: number, polar = POLAR, azimuth?: number) => {
      const dir = camera.position.clone().sub(controls.target)
      const a = azimuth ?? Math.atan2(dir.x, dir.z)
      const p = new THREE.Vector3(Math.sin(polar) * Math.sin(a), Math.cos(polar), Math.sin(polar) * Math.cos(a)).multiplyScalar(dist).add(target)
      goal.current = { t: target.clone(), p }
    }
    api.current = {
      zoom: (f) => {
        const dir = camera.position.clone().sub(controls.target)
        const d = THREE.MathUtils.clamp(dir.length() * f, 10, 170 * k)
        goal.current = { t: controls.target.clone(), p: controls.target.clone().add(dir.setLength(d)) }
      },
      reset: () => fly(new THREE.Vector3(4 * k, 0, 4 * k), homeDist, POLAR, az),
      focus: (site) => {
        const a = anchors.get(site.id)
        const c = a ? a.getWorldPosition(new THREE.Vector3()).setY(0) : new THREE.Vector3(blockCenter(site.block[0]), 0, blockCenter(site.block[1]))
        const dir = camera.position.clone().sub(controls.target).setY(0).normalize()
        const dist = k > 1 ? (site.kind === 'rooftop' ? 22 : site.kind === 'ev' ? 26 : 44) : 30
        // nudge the target toward the camera so the site sits above the bottom sheet
        fly(c.add(dir.multiplyScalar(dist * 0.18)), dist, 0.85)
      },
    }
    if (intro.current !== frameKey) {
      intro.current = frameKey
      camera.position.set(70 * k, 80 * k, 70 * k)
      fly(new THREE.Vector3(4 * k, 0, 4 * k), homeDist, POLAR, az)
    }
  }, [api, camera, controls, homeDist, k, anchors, frameKey])

  useFrame((_, dt) => {
    if (!controls) return
    const g = goal.current
    if (g) {
      const f = 1 - Math.pow(0.0025, dt)
      camera.position.lerp(g.p, f)
      controls.target.lerp(g.t, f)
      if (camera.position.distanceTo(g.p) < 0.05) goal.current = null
    }
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -half, half)
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -half, half)
    controls.target.y = 0
    controls.maxDistance = 170 * k
    controls.update()
  })
  return null
}

/* ---------- lights that ease between day and night ---------- */
function Lights({ bounds }: { bounds: number }) {
  const amb = useRef<THREE.AmbientLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const dayC = useMemo(() => ({ sun: new THREE.Color('#FFF6EA'), sky: new THREE.Color('#F4F6F8') }), [])
  const nightC = useMemo(() => ({ sun: new THREE.Color('#8DA2D8'), sky: new THREE.Color('#4F5F8F') }), [])
  useFrame(() => {
    const n = env.night
    if (amb.current) amb.current.intensity = 0.8 - n * 0.6
    if (hemi.current) {
      hemi.current.intensity = 1.1 - n * 0.85
      hemi.current.color.copy(dayC.sky).lerp(nightC.sky, n)
    }
    if (sun.current) {
      sun.current.intensity = 3.0 - n * 2.6
      sun.current.color.copy(dayC.sun).lerp(nightC.sun, n)
    }
  })
  useEffect(() => {
    const c = sun.current?.shadow.camera
    if (!c) return
    c.left = c.bottom = -bounds; c.right = c.top = bounds
    sun.current!.position.set(-16, 34, 22).multiplyScalar(bounds / 30)
    c.far = bounds * 6
    c.updateProjectionMatrix()
  }, [bounds])
  return (
    <>
      <ambientLight ref={amb} intensity={0.8} />
      <hemisphereLight ref={hemi} args={['#F4F6F8', '#C9CDBF', 1.1]} />
      <directionalLight ref={sun} position={[-16, 34, 22]} intensity={3} castShadow shadow-mapSize={[4096, 4096]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
    </>
  )
}

/* ---------- pop-in wrapper used when a township (re)loads ---------- */
function PopIn({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (!g.current) return
    const f = Math.min(1, dt * 4)
    g.current.position.y += (0 - g.current.position.y) * f
    g.current.scale.setScalar(g.current.scale.x + (1 - g.current.scale.x) * f)
  })
  return <group ref={g} position={[0, -1.5, 0]} scale={0.97}>{children}</group>
}

/* ---------- procedural fallback township (used if no real map data) ---------- */
function Town(props: Props & { anchors: Map<string, THREE.Object3D> }) {
  const { township, sites } = props
  const layout = useMemo(() => buildLayout(township, sites), [township, sites])
  const sources = useMemo(() => sites.filter((s) => props.filter === 'all' || s.kind === props.filter).map((s) => [blockCenter(s.block[0]), blockCenter(s.block[1])] as [number, number]), [sites, props.filter])
  const homes = useMemo(() => layout.houses.filter((h) => Math.abs(h.x) < 22 && Math.abs(h.z) < 22), [layout])
  return (
    <PopIn>
      <Ground layout={layout} onGroundClick={() => props.onSelect(null)} />
      <Houses layout={layout} />
      <Boxes layout={layout} />
      <Trees layout={layout} />
      <Towers layout={layout} />
      <Lake x={blockCenter(township.lake[0])} z={blockCenter(township.lake[1])} />
      <Park x={blockCenter(township.park[0])} z={blockCenter(township.park[1])} />
      <Cars seed={township.seed} />
      <StreetLights />
      {sites.map((s) => (
        <SiteNode
          key={s.id}
          anchors={props.anchors}
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
      {props.flow && <EnergyFlow sources={sources} homes={homes} seed={township.seed} />}
    </PopIn>
  )
}

export default function TownshipMap(props: Props) {
  const anchors = useMemo(() => new Map<string, THREE.Object3D>(), [])
  const pins = useRef(new Map<string, HTMLElement>())
  // real OpenStreetMap data for this township: undefined = loading, null = unavailable
  const [geo, setGeo] = useState<{ id: string; data: GeoData | null } | undefined>(undefined)
  const { onLoading } = props
  useEffect(() => {
    let live = true
    onLoading?.(true)
    loadGeo(props.township.id).then((data) => { if (live) { setGeo({ id: props.township.id, data }); onLoading?.(false) } })
    return () => { live = false }
  }, [props.township.id, onLoading])
  const ready = geo?.id === props.township.id
  const real = ready && !!geo!.data
  const frame = real ? REAL : MODEL

  return (
    <>
      <Canvas
        className="map-canvas"
        shadows="soft"
        dpr={[1, 1.75]}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        camera={{ position: [60, 70, 60], fov: 38, near: 0.5, far: 1200 }}
        onPointerMissed={() => props.onSelect(null)}
      >
        <Atmosphere night={props.night} />
        <Lights bounds={real ? 95 : 30} />
        {ready && (real ? (
          <PopIn key={props.township.id}>
            <GeoTown
              geo={geo!.data!}
              seed={props.township.seed}
              sites={props.sites}
              selectedId={props.selectedId}
              filter={props.filter}
              flow={props.flow}
              anchors={anchors}
              unitState={props.unitState}
              onSelect={props.onSelect}
              onUnit={props.onUnit}
            />
          </PopIn>
        ) : (
          <Town key={props.township.id} {...props} anchors={anchors} />
        ))}
        <PinProjector anchors={anchors} pins={pins} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={10}
          maxDistance={170}
          minPolarAngle={0.3}
          maxPolarAngle={1.2}
          autoRotate={props.autoRotate}
          autoRotateSpeed={0.45}
          screenSpacePanning={false}
        />
        {ready && <Rig api={props.api} onInteract={props.onInteract} frame={frame} anchors={anchors} frameKey={real ? 'real' : 'model'} />}
        <EffectComposer multisampling={4} enableNormalPass={false}>
          <N8AO aoRadius={1.4} distanceFalloff={0.6} intensity={2} quality="performance" halfRes />
          <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.25} intensity={1.3} radius={0.75} />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          <Vignette offset={0.4} darkness={0.3} />
        </EffectComposer>
      </Canvas>
      <div className="pins">
        {props.sites.map((s) => (
          <Pin
            key={s.id}
            site={s}
            selected={props.selectedId === s.id}
            compact={props.selectedId !== null && props.selectedId !== s.id}
            dimmed={props.filter !== 'all' && props.filter !== s.kind}
            mine={props.mineCount(s)}
            onSelect={() => props.onSelect(s.id)}
            register={(el) => { if (el) pins.current.set(s.id, el); else pins.current.delete(s.id) }}
          />
        ))}
      </div>
      {real && <div className="map-attrib">Map data © OpenStreetMap contributors</div>}
    </>
  )
}
