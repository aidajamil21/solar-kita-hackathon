import * as THREE from 'three'
import type { SiteKind } from '../../data'
import { asset } from '../../asset'

/** scene units per metre for real-world townships (1 unit = 12 m) */
export const GS = 1 / 12
/** half-size of the fetched area in scene units */
export const GEO_HALF = 1100 * GS

/** `houses`: real homes for the rooftop initiative; `roofs`: flat roofs carrying a farm site's panels (crowded townships) */
export interface GeoSite { x: number; z: number; houses?: number[]; roofs?: number[] }
export interface GeoData {
  buildings: { p: number[]; h: number; k: string }[]
  roads: { p: number[]; w: number }[]
  water: { p: number[] }[]
  rivers: { p: number[]; w: number }[]
  green: { p: number[]; k: string }[]
  forest: { p: number[] }[]
  parking: { p: number[] }[]
  sites: Partial<Record<SiteKind, GeoSite>>
  center: { lat: number; lon: number }
}

const cache = new Map<string, Promise<GeoData | null>>()
export function loadGeo(id: string) {
  if (!cache.has(id)) {
    cache.set(id, fetch(asset(`geo/${id}.json`)).then((r) => (r.ok ? r.json() : null)).catch(() => null))
  }
  return cache.get(id)!
}

/* ---------- small geometry helpers (metres in, scene units out) ---------- */
export const ptsOf = (flat: number[]) => {
  const out: [number, number][] = []
  for (let i = 0; i < flat.length; i += 2) out.push([flat[i] * GS, flat[i + 1] * GS])
  // drop the closing duplicate
  if (out.length > 2 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop()
  return out
}

export function polyArea(p: [number, number][]) {
  let a = 0
  for (let i = 0; i < p.length; i++) { const j = (i + 1) % p.length; a += p[i][0] * p[j][1] - p[j][0] * p[i][1] }
  return a / 2
}

export function pointInPoly(x: number, z: number, p: [number, number][]) {
  let inside = false
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

/** minimum-area oriented rectangle (tests each edge direction) */
export function orientedRect(p: [number, number][]) {
  let best = { area: Infinity, w: 0, d: 0, ry: 0, cx: 0, cz: 0 }
  for (let i = 0; i < p.length; i++) {
    const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length]
    const ang = Math.atan2(bz - az, bx - ax)
    const c = Math.cos(ang), s = Math.sin(ang)
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity
    for (const [x, z] of p) {
      const u = x * c + z * s, v = -x * s + z * c
      minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v)
    }
    const w = maxU - minU, d = maxV - minV
    if (w * d < best.area) {
      const mu = (minU + maxU) / 2, mv = (minV + maxV) / 2
      best = { area: w * d, w, d, ry: -ang, cx: mu * c - mv * s, cz: mu * s + mv * c }
    }
  }
  // make w the long side (ridge runs along it)
  if (best.d > best.w) best = { ...best, w: best.d, d: best.w, ry: best.ry + Math.PI / 2 }
  return best
}

/** flat polygon -> triangulated horizontal geometry at height y */
export function flatGeometry(polys: [number, number][][], y: number, colors?: string[]) {
  const pos: number[] = [], col: number[] = []
  const c = new THREE.Color()
  polys.forEach((p, k) => {
    if (p.length < 3) return
    const contour = p.map(([x, z]) => new THREE.Vector2(x, z))
    const tris = THREE.ShapeUtils.triangulateShape(contour, [])
    if (colors) c.set(colors[k])
    for (const t of tris) for (const idx of [t[0], t[2], t[1]]) {
      pos.push(contour[idx].x, y, contour[idx].y)
      if (colors) col.push(c.r, c.g, c.b)
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

/** polylines -> ribbons with round-ish joins */
export function ribbonGeometry(lines: { p: [number, number][]; w: number; color?: string }[], y: number) {
  const pos: number[] = [], col: number[] = []
  const c = new THREE.Color()
  const push = (x: number, z: number, yy: number) => { pos.push(x, yy, z); col.push(c.r, c.g, c.b) }
  for (const { p, w, color } of lines) {
    c.set(color ?? '#C3C5C2')
    const h = w / 2
    const yy = y + (w > 0.8 ? 0.004 : 0)
    for (let i = 0; i + 1 < p.length; i++) {
      const [ax, az] = p[i], [bx, bz] = p[i + 1]
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1
      const nx = (-dz / L) * h, nz = (dx / L) * h
      push(ax + nx, az + nz, yy); push(bx + nx, bz + nz, yy); push(ax - nx, az - nz, yy)
      push(bx + nx, bz + nz, yy); push(bx - nx, bz - nz, yy); push(ax - nx, az - nz, yy)
    }
    // joins
    for (let i = 1; i + 1 < p.length; i++) {
      const [x, z] = p[i]
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2
        push(x, z, yy); push(x + Math.cos(a1) * h, z + Math.sin(a1) * h, yy); push(x + Math.cos(a0) * h, z + Math.sin(a0) * h, yy)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

/** extruded buildings: walls (with metre-based UVs for a facade texture) + flat roofs */
export function extrudeBuildings(items: { p: [number, number][]; h: number; color: string }[]) {
  const wp: number[] = [], wu: number[] = [], wc: number[] = []
  const roofs: [number, number][][] = [], roofCols: string[] = [], roofH: number[] = []
  const c = new THREE.Color()
  for (const { p, h, color } of items) {
    c.set(color)
    let run = 0
    const ccw = polyArea(p) > 0
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length]
      const [ax, az] = ccw ? b : a, [bx, bz] = ccw ? a : b
      const L = Math.hypot(bx - ax, bz - az)
      const u0 = run / GS / 3, u1 = (run + L) / GS / 3, v1 = h / GS / 3.3
      run += L
      const quad = [[ax, 0, az, u0, 0], [bx, 0, bz, u1, 0], [bx, h, bz, u1, v1], [ax, 0, az, u0, 0], [bx, h, bz, u1, v1], [ax, h, az, u0, v1]]
      for (const [x, y, z, u, v] of quad) { wp.push(x, y + 0.09, z); wu.push(u, v); wc.push(c.r, c.g, c.b) }
    }
    roofs.push(p); roofCols.push(color); roofH.push(h)
  }
  const walls = new THREE.BufferGeometry()
  walls.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3))
  walls.setAttribute('uv', new THREE.Float32BufferAttribute(wu, 2))
  walls.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3))
  walls.computeVertexNormals()
  // roofs at varying heights: triangulate each then offset
  const rp: number[] = [], rc: number[] = []
  roofs.forEach((p, k) => {
    const contour = p.map(([x, z]) => new THREE.Vector2(x, z))
    const tris = THREE.ShapeUtils.triangulateShape(contour, [])
    c.set(roofCols[k]).multiplyScalar(0.92)
    for (const t of tris) for (const idx of [t[0], t[2], t[1]]) { rp.push(contour[idx].x, roofH[k] + 0.09, contour[idx].y); rc.push(c.r, c.g, c.b) }
  })
  const roof = new THREE.BufferGeometry()
  roof.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3))
  roof.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3))
  roof.computeVertexNormals()
  return { walls, roof }
}

/** walk along a polyline: returns a sampler (t in metres along the line) */
export function polylineSampler(p: [number, number][]) {
  const cum = [0]
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]))
  const total = cum[cum.length - 1]
  return {
    total,
    at(t: number, out: { x: number; z: number; ang: number }) {
      t = ((t % total) + total) % total
      let i = 1
      while (i < cum.length - 1 && cum[i] < t) i++
      const seg = cum[i] - cum[i - 1] || 1, f = (t - cum[i - 1]) / seg
      const [ax, az] = p[i - 1], [bx, bz] = p[i]
      out.x = ax + (bx - ax) * f; out.z = az + (bz - az) * f; out.ang = Math.atan2(bx - ax, bz - az)
      return out
    },
  }
}

/* ---------- shared PV panel texture ---------- */
let pvTex: THREE.CanvasTexture | null = null
export function pvTexture() {
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
