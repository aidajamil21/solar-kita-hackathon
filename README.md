# Solar Kita ☀️

Mobile-first web app for **community solar in Sime Darby Property townships**. Residents explore a 3D map of their township, subscribe to specific solar panels, earn reward points and receive Energy Savings Credits on their electricity bill. An AI "Solar Analyst" chat explains their portfolio.

> Hackathon prototype. The frontend is complete and runs on local demo data. **The backend is not built yet** (see [Backend integration](#backend-integration)).

**Live demo:** https://solar-kita.vercel.app/

## Quick start

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run dev:lan    # also reachable from phones on the same Wi-Fi (prints a Network URL)
npm run build      # production build in dist/
```

**Stack:** Vite · React 19 · TypeScript · react-three-fiber + drei + postprocessing (3D map) · framer-motion · lucide icons · react-router (hash routing).

## App tour

| Route | Screen |
|---|---|
| `/` | Home: township picker, 3D map preview, featured solar project, points |
| `/explore` | Interactive 3D township map: pick a site, select exact panels, subscribe |
| `/solar`, `/solar/:siteId` | Projects: subscriptions, payouts, performance, documents |
| `/rewards` | Rewards marketplace: catalogue, redeem flow, points history |
| `/me` | Progress & impact: impact stats, level journey, achievements, settings |
| `/assistant` | Solar Analyst AI chat (UI only, see below) |

## Project structure

```
src/
  api/types.ts           ← data contract for the backend (start here)
  data.ts                ← demo content: townships, solar sites, rewards, levels, badges
  store.tsx              ← client state (points, subscriptions, redemptions), saved to localStorage
  pages/                 ← one file per screen
  components/
    chat/                ← AI chat cards + static sample conversation/alerts
    map/                 ← 3D township (GeoTown = real OSM layout, Town = generated fallback)
    AlertsButton.tsx     ← notifications bell + sheet
    ui.tsx, Art.tsx, Charts.tsx
public/
  geo/*.json             ← pre-downloaded OpenStreetMap data per township
  previews/*.jpg         ← 3D map snapshots used as thumbnails
  photos/                ← photography (township photos: <township-id>.jpg, see Photos below)
scripts/fetch-geo.mjs    ← regenerates public/geo from OpenStreetMap
scripts/place-sites.mjs  ← picks where each solar site sits on the map (run after fetch-geo)
src/roof-sites.json      ← farm sites that sit on roofs, written by place-sites.mjs
```

## Backend integration

The frontend currently uses **local demo data** in two places:

1. **App data** (townships, sites, subscriptions, points, rewards): `src/data.ts` and `src/store.tsx`.
2. **AI chat & alerts**: static samples in `src/components/chat/sample.ts`.

The backend should implement the shapes in **`src/api/types.ts`**. Each one maps to an approved AI tool:

| Tool / endpoint | Type | Returns |
|---|---|---|
| `get_portfolio_summary` | `PortfolioSummary` | contributions, payouts received, outstanding, holdings |
| `calculate_realized_return` | `RealizedReturn` | verified cash flows and realized return |
| `calculate_projected_scenarios(amount, years)` | `ScenarioSet` | conservative/base/optimistic projections, plus assumptions and risks |
| `get_project_performance(project_id)` | `ProjectPerformance` | generation vs forecast, availability, revenue, costs |
| `get_environmental_impact` | `EnvironmentalImpact` | attributable kWh and tCO₂e avoided, with method |
| `get_active_alerts` | `Alert[]` | 8 alert types (payout, low generation, outage, milestones…) |
| chat | `ChatMessage`, `ChatEvent` | assistant replies; stream `tool` → `delta` → `done` events |

Every data response carries `DataMeta` (`basis: 'verified' | 'forecast'`, `asOf`, `source`). The UI uses it to label each card *Verified data* or *Forecast*.

**Where to plug the API in:**
- `src/pages/Assistant.tsx` → replace `send()` with a call to the chat endpoint (stream `ChatEvent`s).
- `src/components/AlertsButton.tsx` → load alerts from `get_active_alerts`; call a mark-read endpoint.
- Put the API base URL in `.env.local` as `VITE_API_URL=` (see `.env.example`) and read it with `import.meta.env.VITE_API_URL`.

**CORS:** the deployed frontend runs on `https://solarkita123.github.io` (and the Vercel domain), so the backend must allow that origin (and `http://localhost:5173` for development).

**Suggested open-source pieces** (from the design notes): OpenEMS for energy/inverter data, Novu for notifications.

## Deployment

Every push to `main` deploys to two places:

- **Vercel**: the repo is connected to the Vercel project, which builds the frontend and serves the backend from `api/` (see `vercel.json`). Environment variables (Supabase keys, `VITE_API_URL`) are set in the Vercel project settings, not in this repo.
- **GitHub Pages**: `.github/workflows/deploy.yml` builds the frontend. The workflow sets `BASE_PATH=/<repo-name>/`, and every file in `public/` is referenced through `asset()` (`src/asset.ts`), so paths work under that sub-folder.

To embed the app in another website:

```html
<iframe src="https://solarkita123.github.io/solar-kita-hackathon/" width="400" height="860" style="border:0;border-radius:24px"></iframe>
```

## Map data

Each township's 3D map is built from **OpenStreetMap** (buildings, roads, water, parks) and pre-downloaded into `public/geo/`. Where OSM lacks house footprints, terrace houses are filled in along real residential streets. Solar site locations are illustrative, not real projects.

To refresh the map data, run both scripts, in this order:

```bash
node scripts/fetch-geo.mjs [township-id…]    # download OSM data
node scripts/place-sites.mjs [township-id…]  # place the solar sites
```

`place-sites.mjs` only puts a **ground solar farm** on open land: it keeps clear of buildings, lakes, rivers, forests, parks and residential streets, and rejects land surrounded by housing. Crowded townships have no such land, so their Subscription / Investment sites go on **condo roofs** instead (or other big flat roofs such as malls and schools, when there aren't enough condos). It records those sites in `src/roof-sites.json`, and the app then shows them as *Condo Solar* / *Rooftop Solar* instead of *Solar Farm* (`siteMeta()` and `fitToRoofs()` in `src/data.ts`). Only the name, description and capacity shown change: site ids, prices and units stay the same, so existing subscriptions in the database are unaffected.

After refreshing, re-take the `public/previews/` snapshots so the Home page thumbnails match the new site positions.

## Photos

Drop images into `public/photos/` and the app picks them up, with no code change:

- **Township photos**: named after the township id, e.g. `subang-jaya.jpg` (`.png` / `.webp` and `subang_jaya.jpg` also work). Without one, the township shows its 3D map snapshot. Ids: `subang-jaya`, `putra-heights`, `bukit-jelutong`, `denai-alam`, `saujana-impian`, `melawati`, `klgcc`, `nilai-impian`, `planters-haven`, `ainsdale`, `pagoh`.
- **Roof solar sites**: `condo_solar.jpg` and `rooftop_solar.jpg`. Until added, these sites use the houses-with-solar photo.

Keep each image under about 300 KB.

Map data © OpenStreetMap contributors (ODbL).
