import type { Site, Township } from '../../data'

/** block index (core is 0..3) -> world centre */
export const blockCenter = (b: number) => -15 + b * 10
/** all road centre-lines (x and z) */
export const ROADS = [-40, -30, -20, -10, 0, 10, 20, 30, 40]
export const ROAD_W = 1.7
export const BOULEVARD_W = 2.8
/** half-size of the interactive core (camera target is clamped to this) */
export const HALF = 22
/** half-size of the generated world (fades into fog beyond the core) */
export const WORLD = 40

export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const WALLS = ['#F5F4F0', '#EDECE7', '#E6E5E0', '#F8F7F3', '#E0DFDA', '#EFEDE6']
export const ROOFS = ['#C4C2BC', '#B3B1AB', '#A6A49E', '#CFCDC7', '#BAB4AA']
export const LEAVES = ['#9DAA95', '#8D9B86', '#A8B39F', '#83917C', '#95A48F']

/** pitched-roof building; ridge runs along local x (w) */
export interface House { x: number; z: number; w: number; h: number; d: number; ry: number; roofH: number; wall: string; roof: string }
/** flat-roofed box */
export interface Box { x: number; z: number; w: number; h: number; d: number; ry: number; color: string; y?: number }
export interface Tree { x: number; z: number; s: number; leaf: string }
export interface Tower { x: number; z: number; w: number; d: number; h: number }
export interface Patch { x: number; z: number; w: number; d: number; ry: number; color: string }
export type BlockKind = 'terrace' | 'semid' | 'bungalow' | 'shops' | 'condo' | 'forest' | 'lake' | 'park' | 'towers' | 'site'

export interface Layout {
  houses: House[]
  boxes: Box[]
  trees: Tree[]
  towers: Tower[]
  patches: Patch[]
  blocks: { bx: number; bz: number; kind: BlockKind; cx: number; cz: number }[]
}

export function buildLayout(t: Township, sites: Site[]): Layout {
  const r = rng(t.seed)
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)]
  const L: Layout = { houses: [], boxes: [], trees: [], towers: [], patches: [], blocks: [] }
  const eq = (a: [number, number], bx: number, bz: number) => a[0] === bx && a[1] === bz

  for (let bx = -2; bx <= 5; bx++) {
    for (let bz = -2; bz <= 5; bz++) {
      const cx = blockCenter(bx), cz = blockCenter(bz)
      const core = bx >= 0 && bx <= 3 && bz >= 0 && bz <= 3
      let kind: BlockKind
      if (core && sites.some((s) => eq(s.block, bx, bz))) kind = 'site'
      else if (core && eq(t.lake, bx, bz)) kind = 'lake'
      else if (core && eq(t.park, bx, bz)) kind = 'park'
      else if (core && t.towers.some((tw) => eq(tw, bx, bz))) kind = 'towers'
      else {
        const v = r()
        const far = Math.max(Math.abs(cx), Math.abs(cz)) > 30
        if (far && v < 0.22) kind = 'forest'
        else if (v < 0.42) kind = 'terrace'
        else if (v < 0.62) kind = 'semid'
        else if (v < 0.75) kind = 'bungalow'
        else if (v < 0.86) kind = 'shops'
        else if (v < 0.94) kind = 'condo'
        else kind = 'forest'
      }
      L.blocks.push({ bx, bz, kind, cx, cz })
      const rot = r() < 0.5 ? 0 : Math.PI / 2
      // local -> world for this block (with optional 90deg turn)
      const P = (lx: number, lz: number): [number, number] =>
        rot ? [cx + lz, cz - lx] : [cx + lx, cz + lz]

      if (kind === 'terrace') {
        for (const side of [-1, 1]) {
          const n = 6
          const w = 1.12
          for (let k = 0; k < n; k++) {
            const lx = -((n - 1) * w) / 2 + k * w
            const [x, z] = P(lx, side * 1.75)
            L.houses.push({ x, z, w: w - 0.02, d: 2.3, h: 1.25, ry: rot, roofH: 0.62, wall: pick(WALLS), roof: k % 2 ? ROOFS[0] : ROOFS[1] })
            const [px, pz] = P(lx, side * 3.15)
            L.boxes.push({ x: px, z: pz, w: 0.9, d: 0.6, h: 0.05, ry: rot, color: '#D8D7D2', y: 0.62 })
          }
        }
        L.patches.push(patch(P(0, 0), 7, 1, rot, '#D2D4CF'))
        streetTrees(L, P, r, pick)
      } else if (kind === 'semid') {
        for (const side of [-1, 1]) {
          for (let k = -1; k <= 1; k++) {
            const [x, z] = P(k * 2.45, side * 1.85)
            L.houses.push({ x, z, w: 2.1, d: 1.9, h: 1.3, ry: rot, roofH: 0.7, wall: pick(WALLS), roof: pick(ROOFS) })
            const [gx, gz] = P(k * 2.45, side * 3.25)
            L.patches.push(patch([gx, gz], 2.1, 0.9, rot, '#CBD3C3'))
          }
        }
        streetTrees(L, P, r, pick)
      } else if (kind === 'bungalow') {
        for (const [lx, lz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) {
          const [x, z] = P(lx, lz)
          L.patches.push(patch([x, z], 3.4, 3.4, rot, '#CAD2C2'))
          L.houses.push({ x, z, w: 2.2, d: 1.8, h: 1.35, ry: rot + (r() < 0.5 ? 0 : Math.PI / 2), roofH: 0.8, wall: pick(WALLS), roof: pick(ROOFS) })
          const [qx, qz] = P(lx + (lx > 0 ? 0.9 : -0.9), lz + (lz > 0 ? 1.15 : -1.15))
          L.patches.push(patch([qx, qz], 1.1, 0.6, rot, '#A9CBD6'))
          for (let k = 0; k < 3; k++) {
            const [tx, tz] = P(lx + (r() - 0.5) * 3, lz + (lz > 0 ? 1.5 : -1.5))
            L.trees.push({ x: tx, z: tz, s: 0.6 + r() * 0.4, leaf: pick(LEAVES) })
          }
        }
      } else if (kind === 'shops') {
        for (const side of [-1, 1]) {
          for (let k = 0; k < 5; k++) {
            const [x, z] = P(-2.8 + k * 1.4, side * 2.4)
            L.boxes.push({ x, z, w: 1.36, d: 2.2, h: 1.9 + (k % 2) * 0.25, ry: rot, color: pick(WALLS) })
          }
        }
        L.patches.push(patch(P(0, 0), 7.2, 2.2, rot, '#C8C9C5'))
        for (let k = -3; k <= 3; k++) {
          const [x, z] = P(k * 0.95, 0)
          if (r() < 0.6) L.boxes.push({ x, z, w: 0.36, d: 0.7, h: 0.22, ry: rot + Math.PI / 2, color: pick(['#E9E8E4', '#B9BCC0', '#8E9399', '#D8D3C8']) })
        }
      } else if (kind === 'condo') {
        L.boxes.push({ x: cx, z: cz, w: 7, d: 7, h: 0.8, ry: 0, color: '#E4E3DE' })
        for (const [lx, lz] of [[-1.7, -1.6], [1.7, 1.6]]) {
          const [x, z] = P(lx, lz)
          L.towers.push({ x, z, w: 2.6, d: 2.2, h: 6 + r() * 6 })
        }
        const [px, pz] = P(1.6, -1.8)
        L.patches.push({ x: px, z: pz, w: 2.2, d: 1.2, ry: rot, color: '#A9CBD6' })
        streetTrees(L, P, r, pick)
      } else if (kind === 'forest') {
        for (let k = 0; k < 34; k++) {
          L.trees.push({ x: cx + (r() - 0.5) * 7.6, z: cz + (r() - 0.5) * 7.6, s: 0.8 + r() * 0.7, leaf: pick(LEAVES) })
        }
        L.patches.push(patch([cx, cz], 8, 8, 0, '#C6CEBE'))
      } else if (kind === 'lake') {
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2 + r() * 0.3
          L.trees.push({ x: cx + Math.cos(a) * 3.9, z: cz + Math.sin(a) * 3.9, s: 0.6 + r() * 0.5, leaf: pick(LEAVES) })
        }
      } else if (kind === 'park') {
        for (let k = 0; k < 26; k++) {
          const a = r() * Math.PI * 2
          const d = 1.4 + r() * 2.5
          if (Math.abs(d - 2.6) < 0.45) continue
          L.trees.push({ x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, s: 0.7 + r() * 0.6, leaf: pick(LEAVES) })
        }
      } else if (kind === 'towers') {
        L.boxes.push({ x: cx, z: cz, w: 7.2, d: 7.2, h: 0.9, ry: 0, color: '#E4E3DE' })
        for (const [ox, oz] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) {
          if (r() < 0.2) { L.trees.push({ x: cx + ox, z: cz + oz, s: 1.1, leaf: pick(LEAVES) }); continue }
          L.towers.push({ x: cx + ox, z: cz + oz, w: 2.4, d: 2.4, h: 5 + r() * 6 })
        }
      }
    }
  }

  // street trees lining the central boulevard median
  for (let p = -WORLD + 2; p < WORLD; p += 2.2) {
    if (ROADS.some((q) => Math.abs(q - p) < 1.8)) continue
    L.trees.push({ x: 0, z: p, s: 0.55, leaf: pick(LEAVES) }, { x: p, z: 0, s: 0.55, leaf: pick(LEAVES) })
  }
  return L
}

function patch([x, z]: [number, number], w: number, d: number, ry: number, color: string): Patch {
  return { x, z, w, d, ry, color }
}

function streetTrees(L: Layout, P: (x: number, z: number) => [number, number], r: () => number, pick: <T>(a: T[]) => T) {
  for (let k = -3; k <= 3; k += 1.5) {
    for (const side of [-1, 1]) {
      if (r() < 0.35) continue
      const [x, z] = P(k + (r() - 0.5) * 0.4, side * 4.1)
      L.trees.push({ x, z, s: 0.45 + r() * 0.2, leaf: pick(LEAVES) })
    }
  }
}

/** rooftop-ready house slots for the rooftop site (two rows of three) */
export const ROOFTOP_SLOTS = [[-2.4, -1.6], [0, -1.6], [2.4, -1.6], [-2.4, 1.9], [0, 1.9], [2.4, 1.9]] as const
