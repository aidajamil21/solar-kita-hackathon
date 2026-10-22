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
  photos/                ← photography
scripts/fetch-geo.mjs    ← regenerates public/geo from OpenStreetMap
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

**CORS:** the deployed frontend runs on `https://aidajamil21.github.io`, so the backend must allow that origin (and `http://localhost:5173` for development).

**Suggested open-source pieces** (from the design notes): OpenEMS for energy/inverter data, Novu for notifications.

## Deployment

Every push to `main` builds and deploys to **GitHub Pages** through `.github/workflows/deploy.yml`. The workflow sets `BASE_PATH=/<repo-name>/`, and every file in `public/` is referenced through `asset()` (`src/asset.ts`), so paths work under that sub-folder.

To embed the app in another website:

```html
<iframe src="https://aidajamil21.github.io/solar-kita-hackathon/" width="400" height="860" style="border:0;border-radius:24px"></iframe>
```

## Map data

Each township's 3D map is built from **OpenStreetMap** (buildings, roads, water, parks) and pre-downloaded into `public/geo/`. To refresh it: `node scripts/fetch-geo.mjs [township-id…]`. Where OSM lacks house footprints, terrace houses are filled in along real residential streets. Solar site locations are illustrative, not real projects.

Map data © OpenStreetMap contributors (ODbL).
