// Downloads OpenStreetMap data for each Sime Darby Property township and writes a compact,
// render-ready JSON file per township to public/geo/. Run once: `node scripts/fetch-geo.mjs [id...]`
// Data © OpenStreetMap contributors (ODbL).
import { mkdir, writeFile } from 'node:fs/promises'

const UA = 'SolarKita-hackathon-prototype/1.0'
const R = 1100 // half-size of the area to fetch, metres

const TOWNSHIPS = [
  ['elmina', 'Elmina, Shah Alam, Selangor', 3.1858, 101.4950],
  ['bukit-raja', 'Bandar Bukit Raja, Klang', 3.0852, 101.4377],
  ['serenia', 'Serenia City, Sepang', 2.8655, 101.6990],
  ['ara', 'Ara Damansara, Petaling Jaya', 3.1130, 101.5840],
  ['subang-jaya', 'SS15, Subang Jaya', 3.0480, 101.5860],
  ['putra-heights', 'Putra Heights, Subang Jaya', 2.9950, 101.5760],
  ['bukit-jelutong', 'Bukit Jelutong, Shah Alam', 3.0990, 101.5310],
  ['denai-alam', 'Denai Alam, Shah Alam', 3.1290, 101.5180],
  ['saujana-impian', 'Saujana Impian, Kajang', 2.9800, 101.7650],
  ['melawati', 'Taman Melawati, Ulu Kelang', 3.2134, 101.7520],
  ['klgcc', 'Kuala Lumpur Golf & Country Club', 3.1520, 101.6370],
  ['nilai-impian', 'Nilai Impian, Nilai', 2.8130, 101.7780],
  ['planters-haven', 'Planters Haven, Nilai', 2.8500, 101.8200],
  ['ainsdale', 'Bandar Ainsdale, Seremban', 2.6870, 101.9330],
  ['pagoh', 'Bandar Universiti Pagoh, Johor', 2.1430, 102.7340],
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function geocode(q) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=my`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  const j = await res.json()
  return j[0] ? { lat: +j[0].lat, lon: +j[0].lon, name: j[0].display_name } : null
}

async function overpass(lat, lon) {
  const dLat = R / 110540, dLon = R / (111320 * Math.cos((lat * Math.PI) / 180))
  const bb = `${lat - dLat},${lon - dLon},${lat + dLat},${lon + dLon}`
  const q = `[out:json][timeout:120];(
    way["building"](${bb});
    way["highway"](${bb});
    way["natural"="water"](${bb}); relation["natural"="water"](${bb});
    way["landuse"~"reservoir|basin"](${bb});
    way["waterway"](${bb});
    way["leisure"~"park|garden|golf_course|pitch|nature_reserve|playground"](${bb});
    way["landuse"~"grass|recreation_ground|forest|meadow|village_green|orchard|farmland|plantation"](${bb});
    way["natural"~"wood|scrub|grassland"](${bb});
    way["amenity"="parking"](${bb});
  );out geom;`
  const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(MIRRORS[attempt % MIRRORS.length], {
      method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q),
    })
    if (res.ok) return (await res.json()).elements
    console.log('  overpass', res.status, '- retrying')
    await sleep(8000 * (attempt + 1))
  }
  throw new Error('overpass failed')
}

const r1 = (n) => Math.round(n * 10) / 10

function build(elements, lat0, lon0) {
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), kz = 110540
  const toXZ = (g) => g.map((p) => [r1((p.lon - lon0) * kx), r1(-(p.lat - lat0) * kz)])
  const far = (pts) => pts.every(([x, z]) => Math.abs(x) > R * 1.3 || Math.abs(z) > R * 1.3)
  const out = { buildings: [], roads: [], water: [], rivers: [], green: [], forest: [], parking: [] }

  const polys = []
  for (const e of elements) {
    if (e.type === 'way' && e.geometry) polys.push({ tags: e.tags || {}, pts: toXZ(e.geometry) })
    if (e.type === 'relation' && e.members) {
      for (const m of e.members) if (m.role === 'outer' && m.geometry) polys.push({ tags: e.tags || {}, pts: toXZ(m.geometry) })
    }
  }
  const ROAD_W = { motorway: 16, trunk: 14, primary: 12, secondary: 10, tertiary: 8, motorway_link: 7, trunk_link: 7, primary_link: 7, secondary_link: 6, residential: 6, unclassified: 6, living_street: 5, service: 3.5 }
  const RIVER_W = { river: 18, canal: 10, stream: 3, drain: 2.5, ditch: 2 }

  for (const { tags: t, pts } of polys) {
    if (pts.length < 2 || far(pts)) continue
    const flat = pts.flat()
    if (t.building) {
      const levels = parseFloat(t['building:levels'])
      let h = parseFloat(t.height) || (levels ? levels * 3.3 : 0)
      const kind = /apartments|residential|condominium|flats/.test(t.building) ? 'a'
        : /house|terrace|detached|semidetached_house|bungalow/.test(t.building) ? 'h'
        : /commercial|retail|office|supermarket|mall|hotel/.test(t.building) ? 'c'
        : /industrial|warehouse|factory/.test(t.building) ? 'i'
        : /school|university|college|hospital|mosque|church|temple|civic|public/.test(t.building) ? 'p' : 'y'
      out.buildings.push({ p: flat, h: h ? r1(h) : 0, k: kind })
    } else if (t.highway && ROAD_W[t.highway]) {
      out.roads.push({ p: flat, w: ROAD_W[t.highway] })
    } else if (t.waterway && RIVER_W[t.waterway] && !t.area) {
      out.rivers.push({ p: flat, w: RIVER_W[t.waterway] })
    } else if (t.natural === 'water' || /reservoir|basin/.test(t.landuse || '') || t.waterway === 'riverbank') {
      out.water.push({ p: flat })
    } else if (t.amenity === 'parking') {
      out.parking.push({ p: flat })
    } else if (/forest|orchard|plantation/.test(t.landuse || '') || /wood|scrub/.test(t.natural || '') || t.leisure === 'nature_reserve') {
      out.forest.push({ p: flat })
    } else if (t.leisure || t.landuse || t.natural) {
      out.green.push({ p: flat, k: t.leisure === 'golf_course' ? 'golf' : t.leisure === 'pitch' ? 'pitch' : t.landuse === 'farmland' ? 'farm' : 'park' })
    }
  }
  return out
}

/* ---------- choose believable spots for the solar sites ---------- */
function area(p) { let a = 0; for (let i = 0; i < p.length; i += 2) { const j = (i + 2) % p.length; a += p[i] * p[j + 1] - p[j] * p[i + 1] } return Math.abs(a / 2) }
function centroid(p) { let x = 0, z = 0; const n = p.length / 2; for (let i = 0; i < p.length; i += 2) { x += p[i]; z += p[i + 1] } return [x / n, z / n] }

function placeSites(g) {
  // occupancy grid, 20 m cells
  const C = 20, N = Math.ceil((2 * R) / C)
  const occ = new Uint8Array(N * N)
  const mark = (x, z, rad = 0) => {
    const cx = Math.floor((x + R) / C), cz = Math.floor((z + R) / C)
    for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
      const i = cx + dx, k = cz + dz
      if (i >= 0 && k >= 0 && i < N && k < N) occ[k * N + i] = 1
    }
  }
  const markLine = (p, rad) => { for (let i = 0; i + 3 < p.length; i += 2) { const L = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]); for (let s = 0; s <= L; s += C / 2) { const t = L ? s / L : 0; mark(p[i] + (p[i + 2] - p[i]) * t, p[i + 1] + (p[i + 3] - p[i + 1]) * t, rad) } } }
  for (const b of g.buildings) for (let i = 0; i < b.p.length; i += 2) mark(b.p[i], b.p[i + 1], 1)
  for (const r of g.roads) markLine(r.p, 0)
  for (const r of g.rivers) markLine(r.p, 1)
  for (const w of g.water) for (let i = 0; i < w.p.length; i += 2) mark(w.p[i], w.p[i + 1], 2)
  const free = (cx, cz, s) => {
    for (let dz = 0; dz < s; dz++) for (let dx = 0; dx < s; dx++) {
      const i = cx + dx, k = cz + dz
      if (i < 0 || k < 0 || i >= N || k >= N || occ[k * N + i]) return false
    }
    return true
  }
  const findSpot = (sizeM, avoid) => {
    const s = Math.ceil(sizeM / C)
    let best = null
    for (let k = 0; k + s <= N; k++) for (let i = 0; i + s <= N; i++) {
      if (!free(i, k, s)) continue
      const x = -R + (i + s / 2) * C, z = -R + (k + s / 2) * C
      const d = Math.hypot(x, z)
      if (d > R * 0.8) continue
      const crowd = avoid.reduce((m, [ax, az]) => Math.min(m, Math.hypot(ax - x, az - z)), 1e9)
      const score = d * 0.8 - Math.min(crowd, 500) * 0.9
      if (!best || score < best.score) best = { x, z, score }
    }
    if (best) { const s2 = Math.ceil(sizeM / C); const ci = Math.floor((best.x + R) / C - s2 / 2), ck = Math.floor((best.z + R) / C - s2 / 2); for (let dz = 0; dz < s2; dz++) for (let dx = 0; dx < s2; dx++) occ[(ck + dz) * N + ci + dx] = 1 }
    return best && { x: r1(best.x), z: r1(best.z) }
  }
  const placed = []
  const sites = {}
  for (const [kind, size] of [['subscription', 190], ['investment', 230]]) {
    const s = findSpot(size, placed) || findSpot(size * 0.7, placed)
    if (s) { sites[kind] = s; placed.push([s.x, s.z]) }
  }
  // EV hub: in a real car park, near commercial buildings if possible
  const lots = g.parking.map((p) => ({ c: centroid(p.p), a: area(p.p) })).filter((l) => l.a > 900 && Math.hypot(...l.c) < R * 0.8).sort((a, b) => Math.hypot(...a.c) - Math.hypot(...b.c))
  if (lots[0]) sites.ev = { x: r1(lots[0].c[0]), z: r1(lots[0].c[1]) }
  else { const s = findSpot(70, placed); if (s) sites.ev = s }
  if (sites.ev) placed.push([sites.ev.x, sites.ev.z])
  // rooftop: six real neighbouring houses
  const houses = g.buildings.map((b, i) => ({ i, c: centroid(b.p), a: area(b.p) })).filter((h) => h.a > 60 && h.a < 450 && Math.hypot(...h.c) < R * 0.6)
  if (houses.length >= 6) {
    const target = houses.reduce((best, h) => {
      const d = Math.hypot(...h.c), crowd = placed.reduce((m, [x, z]) => Math.min(m, Math.hypot(x - h.c[0], z - h.c[1])), 1e9)
      const score = Math.abs(d - 300) - Math.min(crowd, 400) * 0.5
      return !best || score < best.score ? { h, score } : best
    }, null).h
    const near = houses.map((h) => ({ ...h, d: Math.hypot(h.c[0] - target.c[0], h.c[1] - target.c[1]) })).sort((a, b) => a.d - b.d).slice(0, 6)
    sites.rooftop = { x: r1(target.c[0]), z: r1(target.c[1]), houses: near.map((h) => h.i) }
  }
  return sites
}

const only = process.argv.slice(2)
await mkdir('public/geo', { recursive: true })
const summary = []
for (const [id, query, lat, lon] of TOWNSHIPS) {
  if (only.length && !only.includes(id)) continue
  console.log(id)
  const geo = await geocode(query)
  await sleep(1100)
  const c = geo ?? { lat, lon, name: '(fallback)' }
  console.log('  centre', c.lat.toFixed(5), c.lon.toFixed(5), '-', c.name)
  const els = await overpass(c.lat, c.lon)
  const g = build(els, c.lat, c.lon)
  g.sites = placeSites(g)
  g.center = { lat: c.lat, lon: c.lon }
  const json = JSON.stringify(g)
  await writeFile(`public/geo/${id}.json`, json)
  console.log(`  ${g.buildings.length} buildings, ${g.roads.length} roads, ${g.water.length} water, ${g.green.length} green, ${g.forest.length} forest, ${g.parking.length} parking -> ${(json.length / 1024).toFixed(0)} KB`)
  console.log('  sites', JSON.stringify(Object.fromEntries(Object.entries(g.sites).map(([k, v]) => [k, [v.x, v.z]]))))
  summary.push({ id, lat: +c.lat.toFixed(5), lon: +c.lon.toFixed(5) })
  await sleep(3000)
}
console.log(JSON.stringify(summary))
