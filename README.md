<div align="center">

# Solar Kita ☀️

**Small Plots. Big Impact. One Connected Community.**

A connected community solar ecosystem for Sime Darby Property townships.
*Explore. Participate. Grow together.*

[**Live Demo**](https://solar-kita.vercel.app/) · [**Video Demo**](https://drive.google.com/file/d/1wIqlDyF7QM41DNH_ckownFQMKde6QUdL/view)

The live demo is hosted on Vercel and works on both **web and mobile** browsers.

Built by **MAXCORN** (Maxis Business Enterprise interns)

</div>

---

## Overview

Solar Kita is a mobile-first web app that lets residents of Sime Darby Property townships take part in community solar, whether they own a rooftop or not. Residents explore an interactive 3D map of their township, choose a small share of a professionally managed solar project, earn rewards, and track the energy and environmental impact of their participation. An AI **Solar Analyst** explains their portfolio in plain language.

> **Prototype status:** the frontend is complete and runs on local demo data. The backend is not built yet (see [Backend integration](#backend-integration)). Prices, availability, points and generation figures are illustrative, not live offers.

## The problem

Rooftop leasing alone cannot deliver scale or bankability.

| Residents | Project bankability |
|---|---|
| **Limited routes to participation.** Few accessible tools to discover programmes and act on interest. | **Revenue certainty and credit risk.** Debt financing needs predictable cash flows, creditworthy buyers and enforceable power purchase agreements. |
| **Ownership limits access.** 19.7% of Malaysian households rented in 2024, and high-rise residents face their own constraints. | **Fragmented project costs.** Complex documentation raises transaction costs; standardisation and aggregation can reduce them. |
| **An unclear journey.** Residents must find a programme, understand its terms and complete the steps to join. | |

*Sources: DOSM (2024 household data); IRENA, Five Pillars of Renewables Project Bankability (2024).*

## The solution

**One solar project. Smaller units. More participants.** Solar Kita divides a larger solar farm or project into smaller participation units, lowering the entry barrier and opening solar to homeowners, renters and high-rise residents.

```
Smaller participation units → Broader community involvement
   → Aggregated demand and contracted revenues → Stronger financing case and expansion
```

| Feature | What residents can do |
|---|---|
| **Explore opportunities** | Discover solar projects on an interactive 3D township map |
| **Select and participate** | Choose exact panels, roof sections, charger bays or subscriptions |
| **Track performance** | View generation, benefits and environmental impact |
| **Earn rewards** | Collect points and achievements, redeem in a rewards marketplace |
| **Understand with AI** | Ask the Solar Analyst about projects and their portfolio |
| **Build a solar culture** | Community recognition that sustains engagement beyond price |

### Project types in the prototype

| Type | Example entry point |
|---|---|
| Solar Farm Subscription | Smaller panel blocks, from RM 250 |
| Rooftop Initiative | Home roof sections, from RM 4,000 |
| EV Charger Rooftop | Solar-powered charger bays, from RM 10,000 |
| Condo Solar Investment | Shared rooftop arrays, from RM 12,500 |

### Proposed participation models

- **Project investment:** eligible investors fund project units through an appropriately structured vehicle. Distributions depend on net project cash flows and investment terms.
- **Solar as a service:** a provider finances, owns and operates the system. Participants pay under an agreed subscription or energy-service contract.

*Proposed structures, subject to legal review and approvals. CREAM/CRESS eligibility does not itself authorise a public investment offering. Units represent programme allocations, not land titles.*

## Impact

- **Broader community involvement:** homeowners, renters and high-rise residents can all participate.
- **Asset productivity:** turns suitable rooftops and unused land into productive energy assets.
- **Development efficiency:** aggregates participants and simplifies project coordination.
- **Stronger financing potential:** contracted revenues and verified performance support financing.
- **Neighbourhood value:** connects renewable generation with resident benefits and sustained engagement.

## Implementation roadmap

| Phase | Focus | Outcome |
|---|---|---|
| **1. Connect** | Add Solar Kita to the resident app, map roofs and land, register eligible interest | Qualified demand |
| **2. Structure** | Solar partners assess sites, confirm buyers and CREAM/CRESS fit, validate economics with financiers | Viable projects |
| **3. Activate** | Secure agreements, approvals and funding; deploy systems and report energy and resident benefits | Proven performance |
| **4. Expand** | Scale across townships, activate more assets, explore regulated public investment | Broader participation |

## Team MAXCORN

Maxis Business Enterprise interns with backgrounds in AI, sustainability and networking.

| Name | University |
|---|---|
| Aida | Universiti Kebangsaan Malaysia |
| Tan Guan Zhe | Universiti Malaya |
| Kashton Liu | Tsinghua University |
| Tan Jian Ming | Universiti Teknologi Malaysia |
| Choo Yu Xuan | Universiti Putra Malaysia |

---

# Technical documentation

## Quick start

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run dev:lan    # also reachable from phones on the same Wi-Fi
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
| `/me` | Progress and impact: impact stats, level journey, achievements, settings |
| `/assistant` | Solar Analyst AI chat (UI only, see below) |

## Project structure

```
src/
  api/types.ts           Data contract for the backend (start here)
  data.ts                Demo content: townships, solar sites, rewards, levels, badges
  store.tsx              Client state (points, subscriptions, redemptions), saved to localStorage
  pages/                 One file per screen
  components/
    chat/                AI chat cards and static sample conversation/alerts
    map/                 3D township (GeoTown = real OSM layout, Town = generated fallback)
    AlertsButton.tsx     Notifications bell and sheet
    ui.tsx, Art.tsx, Charts.tsx
public/
  geo/*.json             Pre-downloaded OpenStreetMap data per township
  previews/*.jpg         3D map snapshots used as thumbnails
  photos/                Township photos (<township-id>.jpg)
scripts/fetch-geo.mjs    Regenerates public/geo from OpenStreetMap
scripts/place-sites.mjs  Picks where each solar site sits on the map (run after fetch-geo)
src/roof-sites.json      Sites that sit on roofs, written by place-sites.mjs
```

## Backend integration

The frontend uses **local demo data** in two places:

1. **App data** (townships, sites, subscriptions, points, rewards): `src/data.ts` and `src/store.tsx`.
2. **AI chat and alerts**: static samples in `src/components/chat/sample.ts`.

The backend should implement the shapes in **`src/api/types.ts`**. Each maps to an approved AI tool:

| Tool / endpoint | Type | Returns |
|---|---|---|
| `get_portfolio_summary` | `PortfolioSummary` | Contributions, payouts received, outstanding, holdings |
| `calculate_realized_return` | `RealizedReturn` | Verified cash flows and realized return |
| `calculate_projected_scenarios(amount, years)` | `ScenarioSet` | Conservative/base/optimistic projections, assumptions and risks |
| `get_project_performance(project_id)` | `ProjectPerformance` | Generation vs forecast, availability, revenue, costs |
| `get_environmental_impact` | `EnvironmentalImpact` | Attributable kWh and tCO₂e avoided, with method |
| `get_active_alerts` | `Alert[]` | 8 alert types (payout, low generation, outage, milestones…) |
| chat | `ChatMessage`, `ChatEvent` | Assistant replies; stream `tool` → `delta` → `done` events |

Every data response carries `DataMeta` (`basis: 'verified' | 'forecast'`, `asOf`, `source`). The UI uses it to label each card *Verified data* or *Forecast*.

**Where to plug the API in:**

- `src/pages/Assistant.tsx`: replace `send()` with a call to the chat endpoint (stream `ChatEvent`s).
- `src/components/AlertsButton.tsx`: load alerts from `get_active_alerts` and call a mark-read endpoint.
- Set the API base URL in `.env.local` as `VITE_API_URL=` (see `.env.example`) and read it with `import.meta.env.VITE_API_URL`.

**CORS:** the backend must allow `https://solarkita123.github.io`, the Vercel domain, and `http://localhost:5173` for development.

**Suggested open-source pieces:** OpenEMS for energy/inverter data, Novu for notifications.

## Deployment

Every push to `main` deploys to two places:

- **Vercel:** builds the frontend and serves the backend from `api/` (see `vercel.json`). Environment variables (Supabase keys, `VITE_API_URL`) live in the Vercel project settings, not in this repo.
- **GitHub Pages:** `.github/workflows/deploy.yml` builds the frontend with `BASE_PATH=/<repo-name>/`. Every file in `public/` is referenced through `asset()` (`src/asset.ts`) so paths work under that sub-folder.

To embed the app in another website:

```html
<iframe src="https://solarkita123.github.io/solar-kita-hackathon/" width="400" height="860" style="border:0;border-radius:24px"></iframe>
```

## Map data

Each township's 3D map is built from **OpenStreetMap** (buildings, roads, water, parks) and pre-downloaded into `public/geo/`. Where OSM lacks house footprints, terrace houses are filled in along real residential streets. Solar site locations are illustrative, not real projects.

To refresh the map data, run both scripts in this order:

```bash
node scripts/fetch-geo.mjs [township-id…]    # download OSM data
node scripts/place-sites.mjs [township-id…]  # place the solar sites
```

`place-sites.mjs` only puts a **ground solar farm** on open land: it keeps clear of buildings, lakes, rivers, forests, parks and residential streets, and rejects land surrounded by housing. Crowded townships have no such land, so their Subscription / Investment sites go on **condo roofs** instead (or other large flat roofs such as malls and schools). These are recorded in `src/roof-sites.json`, and the app shows them as *Condo Solar* / *Rooftop Solar* (`siteMeta()` and `fitToRoofs()` in `src/data.ts`). Only the name, description and capacity change; site ids, prices and units stay the same, so existing subscriptions are unaffected.

After refreshing, re-take the `public/previews/` snapshots so the Home thumbnails match the new site positions.

## Photos

Drop images into `public/photos/` and the app picks them up with no code change:

- **Township photos:** named after the township id, e.g. `subang-jaya.jpg` (`.png` / `.webp` and `subang_jaya.jpg` also work). Without one, the township shows its 3D map snapshot. Ids: `subang-jaya`, `putra-heights`, `bukit-jelutong`, `denai-alam`, `saujana-impian`, `melawati`, `klgcc`, `nilai-impian`, `planters-haven`, `ainsdale`, `pagoh`.
- **Roof solar sites:** `condo_solar.jpg` and `rooftop_solar.jpg`. Until added, these sites use the houses-with-solar photo.

Keep each image under about 300 KB.

---

Map data © OpenStreetMap contributors (ODbL).
