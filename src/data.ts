import type { LucideIcon } from 'lucide-react'
import { CalendarCheck, Car, Flower2, House, LayoutGrid, Leaf, PlugZap, Refrigerator, ShoppingBag, Sprout, SquareParking, Sun, Target, Ticket, TreePine, TrendingUp, Users } from 'lucide-react'
import { asset } from './asset'

export type SiteKind = 'subscription' | 'investment' | 'rooftop' | 'ev'

export interface KindMeta {
  label: string
  short: string
  icon: LucideIcon
  tint: string
  unitName: string
  blurb: string
}

export const KINDS: Record<SiteKind, KindMeta> = {
  subscription: {
    label: 'Solar Farm Subscription',
    short: 'Subscription',
    icon: Sun,
    tint: '#FF6E00',
    unitName: 'panel row',
    blurb: 'Flexible subscription for community-scale solar. Support utility-scale solar and enjoy clean energy returns.',
  },
  investment: {
    label: 'Solar Farm Investment',
    short: 'Investment',
    icon: TrendingUp,
    tint: '#FF7A45',
    unitName: 'array block',
    blurb: 'Invest in larger solar assets for long-term value.',
  },
  rooftop: {
    label: 'Rooftop Initiative',
    short: 'Rooftop',
    icon: House,
    tint: '#2F8F6B',
    unitName: 'rooftop',
    blurb: 'Solar for homes, cleaner neighbourhoods.',
  },
  ev: {
    label: 'EV Charger Rooftop',
    short: 'EV Charging',
    icon: PlugZap,
    tint: '#4C7DFF',
    unitName: 'charger bay',
    blurb: 'Solar-powered EV charging for a cleaner commute.',
  },
}

export interface Site {
  id: string
  townshipId: string
  kind: SiteKind
  name: string
  /** block on the 4x4 township grid, [x, z] in 0..3 */
  block: [number, number]
  pricePerUnit: number
  returnLow: number
  returnHigh: number
  pointsPerUnit: number
  /** tonnes CO2e avoided per unit per year */
  co2PerUnit: number
  kwpPerUnit: number
  units: number
  cols: number
  /** unit indexes already taken by other residents */
  taken: number[]
  capacityMW: number
  outputPct: number
  since: string
  description: string
  homesPowered: number
}

export interface Township {
  id: string
  name: string
  area: string
  state: string
  /** approximate township centre, used by the photorealistic (Google 3D) map */
  lat: number
  lon: number
  photo: string | null
  lake: [number, number]
  park: [number, number]
  towers: [number, number][]
  seed: number
  communityMWh: number
  residents: number
}

const P = (f: string) => asset(`photos/${f}.jpg`)

/** Sime Darby Property townships. Coordinates are approximate township centres. */
export const TOWNSHIPS: Township[] = [
  { id: 'elmina', name: 'City of Elmina', area: 'Shah Alam', state: 'Selangor', lat: 3.1804, lon: 101.5173, photo: P('elmina_3'), lake: [2, 0], park: [1, 1], towers: [[0, 0]], seed: 11, communityMWh: 12.4, residents: 2140 },
  { id: 'bukit-raja', name: 'Bandar Bukit Raja', area: 'Klang', state: 'Selangor', lat: 3.0852, lon: 101.4377, photo: P('bandar_bukit_raja'), lake: [0, 3], park: [2, 1], towers: [[1, 0], [0, 1]], seed: 23, communityMWh: 9.8, residents: 1710 },
  { id: 'serenia', name: 'Serenia City', area: 'Sepang', state: 'Selangor', lat: 2.8454, lon: 101.7046, photo: P('serenia_city'), lake: [1, 2], park: [3, 3], towers: [[0, 0]], seed: 37, communityMWh: 15.1, residents: 2680 },
  { id: 'ara', name: 'Ara Damansara', area: 'Petaling Jaya', state: 'Selangor', lat: 3.1084, lon: 101.5866, photo: P('ara_damansara'), lake: [3, 1], park: [0, 2], towers: [[1, 0], [2, 0]], seed: 51, communityMWh: 7.6, residents: 1290 },
  ...([
    ['subang-jaya', 'Subang Jaya & USJ', 'Subang Jaya', 'Selangor', 3.0757, 101.5861, 63, 18.2, 3420],
    ['putra-heights', 'Putra Heights', 'Subang Jaya', 'Selangor', 2.9961, 101.5756, 71, 8.9, 1580],
    ['bukit-jelutong', 'Bukit Jelutong', 'Shah Alam', 'Selangor', 3.1002, 101.5375, 79, 10.3, 1840],
    ['denai-alam', 'Denai Alam', 'Shah Alam', 'Selangor', 3.1636, 101.513, 83, 6.8, 1190],
    ['saujana-impian', 'Saujana Impian', 'Kajang', 'Selangor', 3.0127, 101.7902, 89, 5.9, 1020],
    ['melawati', 'Taman Melawati', 'Ulu Kelang', 'Selangor', 3.2134, 101.752, 97, 7.2, 1340],
    ['klgcc', 'KLGCC Resort', 'Bukit Kiara', 'Kuala Lumpur', 3.14, 101.6397, 101, 4.1, 620],
    ['nilai-impian', 'Nilai Impian', 'Nilai', 'Negeri Sembilan', 2.846, 101.806, 107, 6.4, 1260],
    ['planters-haven', "Planters' Haven", 'Nilai', 'Negeri Sembilan', 2.7935, 101.8052, 113, 3.6, 540],
    ['ainsdale', 'Bandar Ainsdale', 'Seremban', 'Negeri Sembilan', 2.7304, 101.8882, 127, 5.2, 980],
    ['pagoh', 'Bandar Universiti Pagoh', 'Muar', 'Johor', 2.1531, 102.7304, 131, 4.8, 760],
  ] as const).map(([id, name, area, state, lat, lon, seed, communityMWh, residents]) => {
    const r = mulberry(seed)
    const cell = (): [number, number] => [Math.floor(r() * 4), Math.floor(r() * 4)]
    return { id, name, area, state, lat, lon, photo: null, lake: cell(), park: cell(), towers: [cell()], seed, communityMWh, residents }
  }),
]

export const STATES = ['Selangor', 'Kuala Lumpur', 'Negeri Sembilan', 'Johor'] as const

function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Photography per initiative type: `hero` for wide banners, `thumb` for small crops. */
export const KIND_PHOTOS: Record<SiteKind, { hero: string; thumb: string }> = {
  subscription: { hero: P('solar_farm_golden_hour_2'), thumb: P('solar_farm_golden_hour') },
  investment: { hero: P('solar_farm_golden_hour'), thumb: P('solar_farm_golden_hour_2') },
  rooftop: { hero: P('houses_with_solar'), thumb: P('houses_with_solar') },
  ev: { hero: P('solar_carport_2'), thumb: P('solar_car_park') },
}

const base = {
  subscription: { pricePerUnit: 1000, returnLow: 4, returnHigh: 6, pointsPerUnit: 200, co2PerUnit: 1.2, kwpPerUnit: 10, units: 14, cols: 2 },
  investment: { pricePerUnit: 50000, returnLow: 6, returnHigh: 9, pointsPerUnit: 500, co2PerUnit: 30, kwpPerUnit: 250, units: 18, cols: 2 },
  rooftop: { pricePerUnit: 8000, returnLow: 5, returnHigh: 8, pointsPerUnit: 100, co2PerUnit: 3.1, kwpPerUnit: 6, units: 6, cols: 3 },
  ev: { pricePerUnit: 10000, returnLow: 5, returnHigh: 8, pointsPerUnit: 300, co2PerUnit: 4.2, kwpPerUnit: 20, units: 8, cols: 4 },
} as const

function site(townshipId: string, kind: SiteKind, name: string, block: [number, number], extra: Partial<Site> & { taken: number[] }): Site {
  return {
    id: `${townshipId}-${kind}`,
    townshipId,
    kind,
    name,
    block,
    ...base[kind],
    capacityMW: 5,
    outputPct: 56,
    since: 'Jan 2024',
    description: KINDS[kind].blurb,
    homesPowered: 1200,
    ...extra,
  }
}

export const SITES: Site[] = [
  site('elmina', 'subscription', 'Elmina Sunfield', [2, 2], {
    taken: [0, 1, 4, 5, 6, 9, 12], capacityMW: 5, outputPct: 56, homesPowered: 1200,
    description: 'A community solar farm beside Elmina Lakes, supplying clean energy to homes and shops across the township.',
  }),
  site('elmina', 'investment', 'Elmina Grid Array', [3, 0], {
    taken: [0, 1, 2, 3, 6, 7, 8, 10, 14], capacityMW: 12, outputPct: 61, since: 'Jun 2023', homesPowered: 3100,
    description: 'Utility-scale array feeding the Elmina substation. Larger units, longer horizon, stronger returns.',
  }),
  site('elmina', 'rooftop', 'Elmina West Homes', [0, 1], {
    taken: [1, 4], capacityMW: 0.04, outputPct: 48, since: 'Mar 2024', homesPowered: 6,
    description: 'Six family homes in Elmina West ready for rooftop solar. Help fund a roof, share the savings.',
  }),
  site('elmina', 'ev', 'Elmina Hub Chargers', [1, 3], {
    taken: [0, 3, 5], capacityMW: 0.04, outputPct: 72, since: 'Aug 2024', homesPowered: 0,
    description: 'Solar canopy over the Elmina Hub EV bays. Every unit you fund powers real drives around town.',
  }),

  site('bukit-raja', 'subscription', 'Bukit Raja Meadow', [1, 2], {
    taken: [2, 3, 8, 11], capacityMW: 4, outputPct: 52, homesPowered: 980,
    description: 'Gentle hillside farm overlooking Bukit Raja park, with plenty of rows still open for neighbours.',
  }),
  site('bukit-raja', 'rooftop', 'Raja Terrace Roofs', [0, 0], {
    taken: [0], capacityMW: 0.04, outputPct: 45, since: 'May 2024', homesPowered: 6,
    description: 'Terrace homes near the community centre lining up for rooftop panels.',
  }),
  site('bukit-raja', 'ev', 'Raja Mall Chargers', [2, 3], {
    taken: [1, 2, 6], capacityMW: 0.04, outputPct: 68, since: 'Feb 2025', homesPowered: 0,
    description: 'Shoppers charge under a solar roof at Bukit Raja mall.',
  }),

  site('serenia', 'subscription', 'Serenia Sunrise Farm', [2, 1], {
    taken: [0, 2, 4, 7, 10, 13], capacityMW: 6, outputPct: 63, homesPowered: 1500,
    description: 'Serenia’s flagship solar farm with the best morning sun in the region.',
  }),
  site('serenia', 'investment', 'Serenia Array One', [0, 1], {
    taken: [0, 1, 4, 5, 9, 12, 16, 17], capacityMW: 15, outputPct: 66, since: 'Nov 2023', homesPowered: 3900,
    description: 'Large-scale solar asset powering Serenia’s business district.',
  }),
  site('serenia', 'rooftop', 'Serenia Garden Homes', [3, 2], {
    taken: [2, 3, 5], capacityMW: 0.04, outputPct: 50, since: 'Apr 2024', homesPowered: 6,
    description: 'Garden homes by the lake ready to go solar.',
  }),

  site('ara', 'subscription', 'Ara Rooftop Park', [2, 2], {
    taken: [1, 5, 6], capacityMW: 3, outputPct: 49, homesPowered: 700,
    description: 'A compact urban solar park tucked between Ara’s condos and the lake.',
  }),
  site('ara', 'ev', 'Ara Station Chargers', [1, 1], {
    taken: [0, 1, 4], capacityMW: 0.04, outputPct: 70, since: 'Sep 2024', homesPowered: 0,
    description: 'Commuter EV bays at Ara station, topped with solar.',
  }),
]

const GEN_KINDS: SiteKind[][] = [
  ['subscription', 'rooftop', 'ev'],
  ['subscription', 'investment', 'rooftop'],
  ['subscription', 'ev', 'investment'],
  ['rooftop', 'subscription', 'ev', 'investment'],
]
const GEN_NAMES: Record<SiteKind, string> = { subscription: 'Solar Park', investment: 'Grid Array', rooftop: 'Rooftop Homes', ev: 'EV Hub' }

for (const t of TOWNSHIPS) {
  if (SITES.some((s) => s.townshipId === t.id)) continue
  const r = mulberry(t.seed * 7)
  const used = new Set([t.lake, t.park, ...t.towers].map(([x, z]) => `${x},${z}`))
  const kinds = GEN_KINDS[t.seed % GEN_KINDS.length]
  for (const kind of kinds) {
    let block: [number, number] = [0, 0]
    for (let k = 0; k < 40; k++) {
      block = [Math.floor(r() * 4), Math.floor(r() * 4)]
      if (!used.has(`${block[0]},${block[1]}`)) break
    }
    used.add(`${block[0]},${block[1]}`)
    const n = base[kind].units
    const taken = Array.from({ length: n }, (_, i) => i).filter(() => r() < 0.4)
    const short = t.name.replace(/^(City of|Bandar|Taman) /, '').split(' ')[0]
    SITES.push(site(t.id, kind, `${short} ${GEN_NAMES[kind]}`, block, {
      taken,
      capacityMW: kind === 'investment' ? 8 + Math.round(r() * 6) : kind === 'subscription' ? 3 + Math.round(r() * 3) : 0.04,
      outputPct: 45 + Math.round(r() * 25),
      since: ['Mar 2024', 'Jul 2024', 'Jan 2025', 'May 2025'][Math.floor(r() * 4)],
      homesPowered: kind === 'subscription' ? 600 + Math.round(r() * 900) : kind === 'investment' ? 2000 + Math.round(r() * 1500) : kind === 'rooftop' ? 6 : 0,
      description: `${KINDS[kind].blurb.replace(/\.$/, '')} in ${t.name}.`,
    }))
  }
}

export const siteById = (id: string) => SITES.find((s) => s.id === id)
export const townshipById = (id: string) => TOWNSHIPS.find((t) => t.id === id)!

export const LEVELS = [
  { level: 1, name: 'Seedling', min: 0, blurb: 'Taking your first steps toward clean energy.' },
  { level: 2, name: 'Solar Supporter', min: 500, blurb: 'Supporting clean energy projects in your township.' },
  { level: 3, name: 'Solar Champion', min: 2000, blurb: 'A bigger contribution for a healthier community.' },
  { level: 4, name: 'Net-Zero Advocate', min: 5000, blurb: 'Leading the way to net-zero ready townships.' },
]

export function levelFor(lifetime: number) {
  let idx = 0
  LEVELS.forEach((l, i) => { if (lifetime >= l.min) idx = i })
  const cur = LEVELS[idx]
  const next = LEVELS[idx + 1]
  return { cur, next, progress: next ? (lifetime - cur.min) / (next.min - cur.min) : 1 }
}

export type RewardCat = 'mobility' | 'shopping' | 'home' | 'community'

export interface Reward {
  id: string
  title: string
  value: string
  detail: string
  cost: number
  cat: RewardCat
  icon: LucideIcon
  tint: string
  /** null = generated voucher artwork */
  photo: string | null
}

export const REWARDS: Reward[] = [
  { id: 'sdp50', title: 'Sime Darby Property Shopping Voucher', value: 'RM50', detail: 'Shop, dine and live greener at Sime Darby Property malls and partners.', cost: 1000, cat: 'shopping', icon: Ticket, tint: '#F20000', photo: null },
  { id: 'ev20', title: 'EV Charging Credits', value: 'RM20', detail: 'Charging credit at any township EV charger.', cost: 800, cat: 'mobility', icon: PlugZap, tint: '#3B6FD8', photo: P('ev_charger') },
  { id: 'shop50', title: 'Retail Shopping Voucher', value: 'RM50', detail: 'E-voucher for selected retail partners in our townships.', cost: 1200, cat: 'shopping', icon: ShoppingBag, tint: '#E07A2E', photo: P('shopping_bag') },
  { id: 'appliance', title: 'Green Home Appliance Rebate', value: 'RM100', detail: 'Rebate on selected energy-efficient home appliances.', cost: 2000, cat: 'home', icon: Refrigerator, tint: '#2C8FA8', photo: P('energy_efficient_appliances') },
  { id: 'park10', title: 'Township Parking Credit', value: 'RM10', detail: 'Parking credit at participating township car parks.', cost: 500, cat: 'mobility', icon: SquareParking, tint: '#6A5BD6', photo: P('solar_car_park') },
  { id: 'tree', title: 'Tree-Planting Donation', value: '1 tree', detail: 'Plant a native tree in Sime Darby Property townships, tagged in your name.', cost: 1000, cat: 'community', icon: Sprout, tint: '#2F8F6B', photo: P('tree_planting_hands') },
  { id: 'garden', title: 'Community Garden Plot', value: '3 months', detail: 'Your own plot at the township community garden.', cost: 1500, cat: 'community', icon: Flower2, tint: '#4E9A3F', photo: P('seedling_hands') },
]

export const REWARD_CATS: { id: RewardCat | 'all'; label: string; icon: LucideIcon }[] = [
  { id: 'all', label: 'All', icon: LayoutGrid },
  { id: 'mobility', label: 'Clean Mobility', icon: Car },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { id: 'home', label: 'Home & Living', icon: House },
  { id: 'community', label: 'Community', icon: Leaf },
]

export const BADGES: { id: string; name: string; desc: string; icon: LucideIcon; earned: boolean }[] = [
  { id: 'first', name: 'Clean Energy Supporter', desc: 'Joined your first solar project', icon: Leaf, earned: true },
  { id: '500', name: 'Solar Contributor', desc: 'Reached 500 points', icon: Sun, earned: true },
  { id: 'co2', name: 'CO₂ Saver', desc: 'Saved 1 tonne of CO₂e', icon: TreePine, earned: true },
  { id: 'builder', name: 'Community Builder', desc: 'Supported 2 projects', icon: Users, earned: true },
  { id: 'streak', name: 'Consistent Contributor', desc: 'Checked in 7 days in a row', icon: CalendarCheck, earned: false },
  { id: 'netzero', name: 'Net-Zero Advocate', desc: 'Reach 5,000 lifetime points', icon: Target, earned: false },
]

export const EARN_WAYS: { id: string; title: string; desc: string; points: string; icon: LucideIcon; to: string | null }[] = [
  { id: 'roof', title: 'Rooftop Initiative', desc: 'Fund solar on a neighbour’s roof', points: '+100', icon: House, to: '/explore' },
  { id: 'sub', title: 'Solar Farm Subscription', desc: 'Subscribe to community solar', points: '+100', icon: Sun, to: '/explore' },
  { id: 'inv', title: 'Solar Farm Investment', desc: 'Back larger solar assets', points: '+250', icon: TrendingUp, to: '/explore' },
  { id: 'ev', title: 'EV Charger Rooftop', desc: 'Power township EV chargers', points: '+150', icon: PlugZap, to: '/explore' },
]

/** deterministic sunshine factor per month index (0 = Jan) */
export const SUNSHINE = [0.92, 1.02, 1.08, 1.06, 1.0, 0.97, 1.01, 0.99, 0.95, 0.9, 0.86, 0.88]
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const rm = (n: number, dp = 0) =>
  'RM ' + n.toLocaleString('en-MY', { minimumFractionDigits: dp, maximumFractionDigits: dp })
