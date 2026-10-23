// Re-picks believable spots for each township's solar sites in public/geo/*.json, without re-downloading OSM data.
// Run: `node scripts/place-sites.mjs [id...]`
//
// Ground farms only go on open land: whole building / lake / forest / park footprints and a buffer along streets
// are blocked, and land hemmed in by housing is rejected. Townships with no such land put their farm sites on
// condo roofs instead (`roofs` = building indexes), which is how dense areas actually do it; failing that, other
// big flat roofs (malls, schools, offices). Those sites are listed in src/roof-sites.json ('condo' or 'roof') so
// the app can call them "Condo Solar" / "Rooftop Solar" instead of "Solar Farm".
import { readdir, readFile, writeFile } from 'node:fs/promises'

const R = 1100 // half-size of the fetched area, metres (matches fetch-geo.mjs)
const C = 10 // grid cell, metres
const N = Math.ceil((2 * R) / C)
const r1 = (n) => Math.round(n * 10) / 10

/** farm footprints in metres: Farm is 7.9 scene units x SITE_SCALE (GeoTown.tsx) x 12 m, plus a margin */
const FARM = { subscription: 7.9 * 1.9 * 12 + 20, investment: 7.9 * 2.3 * 12 + 20 }
const EV = 7.9 * 0.75 * 12 + 10
const ROOFTOP = 7.9 * 12 + 10
/** sites stay within this distance of the township centre (metres), so the 3D map's home view can frame them all */
const REACH = 650
/** the six rooftop-initiative houses must all be within this many metres of their middle */
const CLUSTER = 40
/** a farm needs this much open ground: no more than this many buildings within 250 m of its centre */
const MAX_NEIGHBOURS = 60

const ptsOf = (f) => { const o = []; for (let i = 0; i + 1 < f.length; i += 2) o.push([f[i], f[i + 1]]); return o }
const area = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const j = (i + 1) % p.length; a += p[i][0] * p[j][1] - p[j][0] * p[i][1] } return Math.abs(a / 2) }
const centroid = (p) => p.reduce((s, [x, z]) => [s[0] + x / p.length, s[1] + z / p.length], [0, 0])
function inPoly(x, z, p) {
  let inside = false
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}
/** minimum-area oriented rectangle, same as orientedRect in src/components/map/geo.ts */
function rectOf(p) {
  let best = { area: Infinity }
  for (let i = 0; i < p.length; i++) {
    const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length]
    const ang = Math.atan2(bz - az, bx - ax), c = Math.cos(ang), s = Math.sin(ang)
    let a = Infinity, b = -Infinity, e = Infinity, f = -Infinity
    for (const [x, z] of p) { const u = x * c + z * s, v = -x * s + z * c; a = Math.min(a, u); b = Math.max(b, u); e = Math.min(e, v); f = Math.max(f, v) }
    if ((b - a) * (f - e) < best.area) best = { area: (b - a) * (f - e), w: b - a, d: f - e, u: (a + b) / 2, v: (e + f) / 2, c, s }
  }
  return best
}

class Grid {
  constructor() { this.occ = new Uint8Array(N * N) }
  cell(x, z) { return [Math.floor((x + R) / C), Math.floor((z + R) / C)] }
  set(i, k) { if (i >= 0 && k >= 0 && i < N && k < N) this.occ[k * N + i] = 1 }
  disc(x, z, rad) {
    const [ci, ck] = this.cell(x, z), n = Math.ceil(rad / C)
    for (let dk = -n; dk <= n; dk++) for (let di = -n; di <= n; di++) if (Math.hypot(di, dk) * C <= rad + C / 2) this.set(ci + di, ck + dk)
  }
  line(p, rad) {
    for (let i = 0; i + 1 < p.length; i++) {
      const [ax, az] = p[i], [bx, bz] = p[i + 1], L = Math.hypot(bx - ax, bz - az)
      for (let s = 0; s <= L; s += C / 2) { const t = L ? s / L : 0; this.disc(ax + (bx - ax) * t, az + (bz - az) * t, rad) }
    }
  }
  poly(p, pad = 0) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (const [x, z] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z) }
    for (let x = Math.max(x0, -R); x <= Math.min(x1, R); x += C / 2) for (let z = Math.max(z0, -R); z <= Math.min(z1, R); z += C / 2) {
      if (inPoly(x, z, p)) { const [i, k] = this.cell(x, z); this.set(i, k) }
    }
    if (pad) this.line([...p, p[0]], pad)
  }
  /** summed-area table so any square can be tested in O(1) */
  sat() {
    const s = new Int32Array((N + 1) * (N + 1))
    for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) s[(k + 1) * (N + 1) + i + 1] = this.occ[k * N + i] + s[k * (N + 1) + i + 1] + s[(k + 1) * (N + 1) + i] - s[k * (N + 1) + i]
    return (i, k, n) => s[(k + n) * (N + 1) + i + n] - s[k * (N + 1) + i + n] - s[(k + n) * (N + 1) + i] + s[k * (N + 1) + i]
  }
  block(x, z, size) { const n = Math.ceil(size / C), [ci, ck] = this.cell(x - size / 2, z - size / 2); for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) this.set(ci + i, ck + k) }
}

function placeSites(g) {
  const buildings = g.buildings.map((b, i) => {
    const p = ptsOf(b.p)
    if (p.length > 2 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop()
    return { i, p, k: b.k, h: b.h, a: area(p), c: centroid(p) }
  }).filter((b) => b.p.length >= 3)
  const closed = (f) => f.length >= 8 && f[0] === f[f.length - 2] && f[1] === f[f.length - 1]

  // hard: things nothing can sit on. soft: also parks, car parks and the strips along streets where homes line up
  const hard = new Grid(), soft = new Grid()
  for (const b of buildings) { hard.poly(b.p, 4); soft.poly(b.p, 10) }
  for (const w of g.water.filter((x) => closed(x.p))) { hard.poly(ptsOf(w.p), 8); soft.poly(ptsOf(w.p), 20) }
  for (const f of g.forest.filter((x) => closed(x.p))) { hard.poly(ptsOf(f.p)); soft.poly(ptsOf(f.p), 10) }
  for (const v of g.rivers) { hard.line(ptsOf(v.p), v.w / 2 + 6); soft.line(ptsOf(v.p), v.w / 2 + 15) }
  for (const r of g.roads) {
    hard.line(ptsOf(r.p), r.w / 2 + 3)
    // residential streets (4.5-8.5 m) get terraces generated along them in the 3D view: keep well clear
    soft.line(ptsOf(r.p), r.w / 2 + (r.w >= 4.5 && r.w <= 8.5 ? 30 : 10))
  }
  for (const gr of g.green.filter((x) => closed(x.p) && x.k !== 'farm')) soft.poly(ptsOf(gr.p), 5)
  for (const pk of g.parking.filter((x) => closed(x.p))) soft.poly(ptsOf(pk.p), 5)

  const neighbours = (x, z, rad) => buildings.reduce((n, b) => n + (Math.hypot(b.c[0] - x, b.c[1] - z) < rad ? 1 : 0), 0)
  const placed = []
  const spread = (x, z) => placed.reduce((m, [ax, az]) => Math.min(m, Math.hypot(ax - x, az - z)), 1e9)

  const findSquare = (grid, size, { maxR = REACH, crowd = Infinity } = {}) => {
    const n = Math.ceil(size / C), used = grid.sat()
    let best = null
    for (let k = 0; k + n <= N; k += 1) for (let i = 0; i + n <= N; i += 1) {
      if (used(i, k, n)) continue
      const x = -R + (i + n / 2) * C, z = -R + (k + n / 2) * C, d = Math.hypot(x, z)
      if (d > maxR) continue
      const score = d * 0.8 - Math.min(spread(x, z), 500) * 0.9
      if (!best || score < best.score) best = { x, z, score }
    }
    // only now count neighbours, for the few best candidates
    if (best && crowd < Infinity && neighbours(best.x, best.z, 250) > crowd) {
      const alts = []
      for (let k = 0; k + n <= N; k += 2) for (let i = 0; i + n <= N; i += 2) {
        if (used(i, k, n)) continue
        const x = -R + (i + n / 2) * C, z = -R + (k + n / 2) * C
        if (Math.hypot(x, z) <= maxR) alts.push({ x, z, score: Math.hypot(x, z) * 0.8 - Math.min(spread(x, z), 500) * 0.9 })
      }
      best = alts.sort((a, b) => a.score - b.score).find((a) => neighbours(a.x, a.z, 250) <= crowd) ?? null
    }
    return best && { x: r1(best.x), z: r1(best.z) }
  }

  // buildings by bounding box, to find what overlaps a spot quickly
  const boxed = buildings.map((b) => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (const [x, z] of b.p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z) }
    return { b, x0, x1, z0, z1 }
  })
  const buildingAt = (x, z, skip) => boxed.find((o) => o.b !== skip && x >= o.x0 && x <= o.x1 && z >= o.z0 && z <= o.z1 && inPoly(x, z, o.b.p))
  /** the whole panel area (as drawn by RoofArrays in Sites.tsx) sits on this roof, with no other building over it */
  const panelsFit = (b) => {
    const r = rectOf(b.p)
    for (let i = -1; i <= 1; i += 0.125) for (let j = -1; j <= 1; j += 0.125) {
      const u = r.u + i * r.w * 0.47, v = r.v + j * r.d * 0.46
      const x = u * r.c - v * r.s, z = u * r.s + v * r.c
      if (!inPoly(x, z, b.p) || buildingAt(x, z, b)) return false
    }
    return true
  }
  /** no building inside a ground site's square footprint */
  const groundClear = (x, z, size) => {
    const h = size / 2
    if (boxed.some((o) => o.x1 > x - h && o.x0 < x + h && o.z1 > z - h && o.z0 < z + h && o.b.p.some(([px, pz]) => Math.abs(px - x) < h && Math.abs(pz - z) < h))) return false
    for (let i = -1; i <= 1; i += 0.25) for (let j = -1; j <= 1; j += 0.25) if (buildingAt(x + i * h, z + j * h)) return false
    return true
  }

  // flat roofs big enough for an array (not the pitched houses GeoTown draws with gables)
  const taken = new Set()
  const roofs = buildings.filter((b) => {
    const rc = rectOf(b.p)
    const pitched = (b.k === 'h' || b.k === 'y') && b.a < 700 && (!b.h || b.h <= 12)
    return !pitched && b.a >= 400 && b.a / rc.area > 0.6 && Math.min(rc.w, rc.d) >= 10 && Math.hypot(...b.c) < REACH && panelsFit(b)
  })
  const pickRoofs = (count, condosOnly) => {
    const free = roofs.filter((b) => !taken.has(b.i) && (!condosOnly || b.k === 'a'))
    if (!free.length) return null
    // seed: big roofs, away from the other sites, not too far out
    const seed = free.reduce((best, b) => {
      const score = -Math.min(b.a, 4000) * 0.05 + Math.hypot(...b.c) * 0.4 - Math.min(spread(...b.c), 500) * 0.6
      return !best || score < best.score ? { b, score } : best
    }, null).b
    const group = free.map((b) => ({ b, d: Math.hypot(b.c[0] - seed.c[0], b.c[1] - seed.c[1]) }))
      .filter((x) => x.d < 350).sort((p, q) => p.d - q.d).slice(0, count).map((x) => x.b)
    group.forEach((b) => taken.add(b.i))
    const x = group.reduce((s, b) => s + b.c[0], 0) / group.length, z = group.reduce((s, b) => s + b.c[1], 0) / group.length
    return { x: r1(x), z: r1(z), roofs: group.map((b) => b.i), on: group.every((b) => b.k === 'a') ? 'condo' : 'roof' }
  }

  const sites = {}
  // rooftop initiative: six real houses right next to each other. The map data often has only a few house footprints,
  // so the nearest six to a spot can be hundreds of metres apart; accept only a tight cluster, else a generated one below.
  const houseLike = buildings.filter((b) => {
    const rc = rectOf(b.p)
    return b.a >= 60 && b.a <= 450 && b.a / rc.area > 0.7 && (!b.h || b.h <= 12) && Math.hypot(...b.c) < REACH
  })
  let bestCluster = null
  for (const seed of houseLike) {
    const six = houseLike.map((h) => ({ h, d: Math.hypot(h.c[0] - seed.c[0], h.c[1] - seed.c[1]) })).sort((a, b) => a.d - b.d).slice(0, 6).map((x) => x.h)
    if (six.length < 6) continue
    const cx = six.reduce((t, h) => t + h.c[0], 0) / 6, cz = six.reduce((t, h) => t + h.c[1], 0) / 6
    const radius = Math.max(...six.map((h) => Math.hypot(h.c[0] - cx, h.c[1] - cz)))
    if (radius > CLUSTER) continue
    const score = Math.abs(Math.hypot(cx, cz) - 250) + radius * 2
    if (!bestCluster || score < bestCluster.score) bestCluster = { six, cx, cz, score }
  }
  if (bestCluster) {
    sites.rooftop = { x: r1(bestCluster.cx), z: r1(bestCluster.cz), houses: bestCluster.six.map((h) => h.i) }
    bestCluster.six.forEach((h) => taken.add(h.i))
    placed.push([sites.rooftop.x, sites.rooftop.z])
  }

  // EV hub: a real car park, else the nearest open spot
  const lots = g.parking.filter((p) => closed(p.p)).map((p) => ({ p: ptsOf(p.p) })).map((l) => ({ ...l, c: centroid(l.p), a: area(l.p) }))
    .filter((l) => l.a > 900 && Math.hypot(...l.c) < REACH).sort((a, b) => Math.hypot(...a.c) - Math.hypot(...b.c))
  const lot = lots.find((l) => groundClear(l.c[0], l.c[1], EV))
  sites.ev = lot ? { x: r1(lot.c[0]), z: r1(lot.c[1]) } : findSquare(hard, EV, { maxR: REACH * 0.8 })
  if (sites.ev) { placed.push([sites.ev.x, sites.ev.z]); hard.block(sites.ev.x, sites.ev.z, EV); soft.block(sites.ev.x, sites.ev.z, EV) }

  for (const kind of ['subscription', 'investment']) {
    const ground = findSquare(soft, FARM[kind], { crowd: MAX_NEIGHBOURS })
    // no open land: condo roofs, else other flat roofs, else the most open spot there is
    const n = kind === 'investment' ? 6 : 4
    const s = ground ?? pickRoofs(n, true) ?? pickRoofs(n, false) ?? findSquare(hard, FARM[kind] * 0.75) ?? findSquare(hard, FARM[kind] * 0.75, { maxR: R * 0.8 })
    if (!s) continue
    sites[kind] = s
    placed.push([s.x, s.z])
    if (!s.roofs) { soft.block(s.x, s.z, FARM[kind]); hard.block(s.x, s.z, FARM[kind]) }
  }

  // townships without suitable houses: a generated rooftop cluster on open ground
  if (!sites.rooftop) {
    const s = findSquare(hard, ROOFTOP, { maxR: REACH * 0.8 })
    if (s) sites.rooftop = s
  }
  return sites
}

const only = process.argv.slice(2)
const onRoofs = JSON.parse(await readFile('src/roof-sites.json', 'utf8').catch(() => '{}'))
for (const file of (await readdir('public/geo')).filter((f) => f.endsWith('.json')).sort()) {
  const id = file.replace(/\.json$/, '')
  if (only.length && !only.includes(id)) continue
  const g = JSON.parse(await readFile(`public/geo/${file}`, 'utf8'))
  g.sites = placeSites(g)
  await writeFile(`public/geo/${file}`, JSON.stringify(g))
  const here = Object.fromEntries(Object.entries(g.sites).filter(([, v]) => v.roofs).map(([k, v]) => [k, v.on]))
  if (Object.keys(here).length) onRoofs[id] = here
  else delete onRoofs[id]
  const desc = Object.entries(g.sites).map(([k, v]) => `${k}:${v.roofs ? `${v.roofs.length} ${v.on} roofs` : v.houses ? `${v.houses.length} houses` : 'ground'}`)
  console.log(id.padEnd(16), desc.join('  '))
}
await writeFile('src/roof-sites.json', JSON.stringify(Object.fromEntries(Object.entries(onRoofs).sort()), null, 2) + '\n')
