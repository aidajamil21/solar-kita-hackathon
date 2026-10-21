import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { Site, SiteKind, Township } from '../../data'
import { loadGeo, type GeoData } from './geo'
import { blockCenter } from './gen'
import { Pin } from './Sites'
import type { MapApi } from './TownshipMap'

interface Props {
  township: Township
  sites: Site[]
  selectedId: string | null
  filter: SiteKind | 'all'
  night: boolean
  mineCount: (site: Site) => number
  onSelect: (id: string | null) => void
  onInteract: () => void
  onLoading?: (loading: boolean) => void
  api: RefObject<MapApi | null>
}

interface View { x: number; z: number; s: number }

const PALETTE = {
  day: { bg: '#eef0ec', building: '#d8d4cc', road: '#ffffff', casing: '#d6d6d0', water: '#b9d8ea', green: '#cfe3c4', forest: '#b8d3ad', parking: '#e2e2de' },
  night: { bg: '#161c28', building: '#2b3345', road: '#3a4358', casing: '#222a3a', water: '#1e3550', green: '#1d2b2a', forest: '#18262a', parking: '#222a3a' },
}

const path = (flat: number[], close: boolean) => {
  let d = ''
  for (let i = 0; i < flat.length; i += 2) d += `${i ? 'L' : 'M'}${flat[i]} ${flat[i + 1]}`
  return close ? d + 'Z' : d
}

/** the static drawing of the township, in metres; memoised so panning only moves the group transform */
function Layer({ geo, night }: { geo: GeoData; night: boolean }) {
  const c = night ? PALETTE.night : PALETTE.day
  return useMemo(() => (
    <g strokeLinejoin="round" strokeLinecap="round">
      {geo.green.map((g, i) => <path key={`g${i}`} d={path(g.p, true)} fill={c.green} />)}
      {geo.forest.map((g, i) => <path key={`f${i}`} d={path(g.p, true)} fill={c.forest} />)}
      {geo.parking.map((g, i) => <path key={`p${i}`} d={path(g.p, true)} fill={c.parking} />)}
      {geo.water.map((g, i) => <path key={`w${i}`} d={path(g.p, true)} fill={c.water} />)}
      {geo.rivers.map((r, i) => <path key={`r${i}`} d={path(r.p, false)} fill="none" stroke={c.water} strokeWidth={Math.max(r.w, 4)} />)}
      {geo.roads.map((r, i) => <path key={`c${i}`} d={path(r.p, false)} fill="none" stroke={c.casing} strokeWidth={r.w + 2.5} />)}
      {geo.roads.map((r, i) => <path key={`d${i}`} d={path(r.p, false)} fill="none" stroke={c.road} strokeWidth={r.w} />)}
      {geo.buildings.map((b, i) => <path key={`b${i}`} d={path(b.p, true)} fill={c.building} />)}
    </g>
  ), [geo, c])
}

/** flat, GPU-free alternative to the 3D township map: an SVG drawn from the same OpenStreetMap data */
export default function Map2D(props: Props) {
  const { township, sites, onLoading, onInteract, onSelect, api } = props
  const [geo, setGeo] = useState<{ id: string; data: GeoData | null } | undefined>(undefined)
  useEffect(() => {
    let live = true
    onLoading?.(true)
    loadGeo(township.id).then((data) => { if (live) { setGeo({ id: township.id, data }); onLoading?.(false) } })
    return () => { live = false }
  }, [township.id, onLoading])
  const data = geo?.id === township.id ? geo.data : null
  const night = props.night
  const c = night ? PALETTE.night : PALETTE.day

  const wrap = useRef<HTMLDivElement>(null)
  const pinEls = useRef(new Map<string, HTMLElement>())
  const [size, setSize] = useState({ w: 400, h: 700 })
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  // site positions in metres: real data when we have it, otherwise the generated 4x4 block grid
  const spots = useMemo(() => {
    const m = new Map<string, [number, number]>()
    sites.forEach((s, k) => {
      const g = data?.sites[s.kind]
      if (g) m.set(s.id, [g.x, g.z])
      else if (data) m.set(s.id, [(k - 1.5) * 170, 380])
      else m.set(s.id, [(blockCenter(s.block[0]) / 15) * 300, (blockCenter(s.block[1]) / 15) * 300])
    })
    return m
  }, [sites, data])

  const fit = Math.min(size.w, size.h) / 1500
  const [view, setView] = useState<View>({ x: 0, z: 0, s: fit })
  const viewRef = useRef(view)
  viewRef.current = view
  const limits = useMemo(() => ({ min: fit * 0.7, max: fit * 9 }), [fit])
  const tween = useRef(0)
  const clampScale = useCallback((s: number) => Math.min(limits.max, Math.max(limits.min, s)), [limits])

  const go = useCallback((to: View, animate = true) => {
    cancelAnimationFrame(tween.current)
    const from = viewRef.current
    const dest: View = { x: to.x, z: to.z, s: clampScale(to.s) }
    if (!animate) return setView(dest)
    const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 450), e = 1 - Math.pow(1 - k, 3)
      setView({ x: from.x + (dest.x - from.x) * e, z: from.z + (dest.z - from.z) * e, s: from.s * Math.pow(dest.s / from.s, e) })
      if (k < 1) tween.current = requestAnimationFrame(step)
    }
    tween.current = requestAnimationFrame(step)
  }, [clampScale])
  useEffect(() => () => cancelAnimationFrame(tween.current), [])

  // re-frame when the township (or the container size) changes
  useEffect(() => { go({ x: 0, z: 0, s: fit }, false) }, [township.id, data, fit, go])

  useEffect(() => {
    api.current = {
      zoom: (factor) => go({ ...viewRef.current, s: viewRef.current.s / factor }),
      reset: () => go({ x: 0, z: 0, s: fit }),
      focus: (site) => {
        const p = spots.get(site.id)
        if (p) go({ x: p[0], z: p[1] + 40, s: fit * 3.2 })
      },
    }
    return () => { api.current = null }
  }, [api, go, fit, spots])

  // pins follow the view imperatively so panning doesn't re-render them
  useLayoutEffect(() => {
    pinEls.current.forEach((el, id) => {
      const p = spots.get(id)
      if (!p) return
      const px = (p[0] - view.x) * view.s + size.w / 2
      const py = (p[1] - view.z) * view.s + size.h / 2
      el.style.visibility = px < -60 || px > size.w + 60 || py < -20 || py > size.h + 120 ? 'hidden' : 'visible'
      el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`
      el.style.zIndex = String(Math.round(py))
    })
  }, [view, size, spots, sites, props.selectedId, props.filter])

  /* ---- gestures: drag to pan, wheel / pinch to zoom ---- */
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const moved = useRef(0)
  const pinch = useRef(0)
  const [dragging, setDragging] = useState(false)
  const onDown = (e: React.PointerEvent) => {
    wrap.current?.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    moved.current = 0
    pinch.current = 0
    cancelAnimationFrame(tween.current)
  }
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, cur)
    const pts = [...pointers.current.values()]
    if (pts.length === 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      if (pinch.current) setView((v) => ({ ...v, s: clampScale(v.s * (d / pinch.current)) }))
      pinch.current = d
      moved.current += 10
    } else {
      moved.current += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y)
      if (moved.current > 4) setDragging(true)
      if (moved.current > 4) setView((v) => ({ ...v, x: v.x - (cur.x - prev.x) / v.s, z: v.z - (cur.y - prev.y) / v.s }))
    }
    onInteract()
  }
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    pinch.current = 0
    setDragging(false)
    if (!pointers.current.size && moved.current <= 4) onSelect(null)
  }
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const mx = e.clientX - r.left - r.width / 2, my = e.clientY - r.top - r.height / 2
      const pan = !e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.5 && e.deltaMode === 0
      setView((v) => {
        // trackpad two-finger scroll pans; mouse wheel / pinch zooms towards the cursor
        if (pan) return { ...v, x: v.x + e.deltaX / v.s, z: v.z + e.deltaY / v.s }
        const s = clampScale(v.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)))
        return { s, x: v.x + mx / v.s - mx / s, z: v.z + my / v.s - my / s }
      })
      onInteract()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [clampScale, onInteract])

  return (
    <>
      <div
        ref={wrap}
        className="map-canvas map2d"
        style={{ background: c.bg, touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      >
        <svg width={size.w} height={size.h} style={{ display: 'block' }} aria-label={`Map of ${township.name}`}>
          <g transform={`translate(${size.w / 2 - view.x * view.s} ${size.h / 2 - view.z * view.s}) scale(${view.s})`}>
            {data ? <Layer geo={data} night={night} /> : (
              // generated townships have no OSM data: a plain street grid
              <g stroke={c.road} strokeWidth={14} fill="none">
                {[-450, -150, 150, 450].flatMap((v) => [<path key={`x${v}`} d={`M${v} -600V600`} />, <path key={`z${v}`} d={`M-600 ${v}H600`} />])}
              </g>
            )}
            {sites.map((s) => {
              const p = spots.get(s.id)!
              const dim = props.filter !== 'all' && props.filter !== s.kind
              return <circle key={s.id} cx={p[0]} cy={p[1]} r={s.id === props.selectedId ? 70 : 46} fill="#ff4a00" opacity={dim ? 0.06 : 0.18} />
            })}
          </g>
        </svg>
      </div>
      <div className="pins">
        {sites.map((s) => (
          <Pin
            key={s.id}
            site={s}
            selected={props.selectedId === s.id}
            compact={props.selectedId !== null && props.selectedId !== s.id}
            dimmed={props.filter !== 'all' && props.filter !== s.kind}
            mine={props.mineCount(s)}
            onSelect={() => onSelect(s.id)}
            register={(el) => { if (el) pinEls.current.set(s.id, el); else pinEls.current.delete(s.id) }}
          />
        ))}
      </div>
      {data && <div className="map-attrib">Map data © OpenStreetMap contributors</div>}
    </>
  )
}
