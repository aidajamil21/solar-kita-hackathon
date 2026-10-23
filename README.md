<div align="center">

# Solar Kita ☀️

**Small Plots. Big Impact. One Connected Community.**

A connected community solar ecosystem for Sime Darby Property townships.
*Explore. Participate. Grow together.*

[**Live Demo**](https://solar-kita.vercel.app/) · [**Video Demo**](https://drive.google.com/file/d/1wIqlDyF7QM41DNH_ckownFQMKde6QUdL/view)

The live demo is hosted on Vercel and works on both **web and mobile** browsers.

> **Slow or laggy 3D map?** If your laptop or phone struggles with 3D, switch to the lighter **2D map**: use the toggle at the top of the **Explore** tab, or turn off **3D township map** in your **Profile** (`Me` tab).

Built by **MAXCORN** (Maxis Business Enterprise interns)

</div>

---

## Overview

Solar Kita is a mobile-first web app that lets residents of Sime Darby Property townships take part in community solar, whether they own a rooftop or not. Residents explore an interactive 3D map of their township, choose a small share of a professionally managed solar project, earn rewards, and track the energy and environmental impact of their participation. An AI **Solar Analyst** explains their portfolio in plain language.

> **Prototype status:** the app runs against a Supabase-backed API (resident sign-in, subscriptions, rewards, AI analyst) seeded with demo residents, and falls back to built-in demo data when no API is configured (see [Backend](#backend)). Prices, availability, points and generation figures are illustrative, not live offers.

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
| **Go Green** | Walk or cycle in the township to earn points |
| **EV charging** | Book solar-powered EV charger bays |
| **Solar Builder Plan** | Contribute monthly toward solar units instead of paying upfront |
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
| `/assistant` | Solar Analyst AI chat |
| `/green` | Go Green: walk or cycle to earn points |
| `/charge` | EV charger bay booking |
| `/plan` | Solar Builder Plan: monthly contributions |

## Project structure

```
src/                     Frontend (React + TypeScript)
  api/                   Backend client (backend.ts) and data contract (types.ts)
  data.ts                Built-in demo content: townships, solar sites, rewards, levels, badges
  store.tsx              Client state (points, subscriptions, redemptions)
  pages/                 One file per screen
  components/            Shared UI; chat/ (AI cards), map/ (3D township), charts
  roof-sites.json        Sites that sit on roofs, written by place-sites.mjs
server/                  Backend API (Express + Supabase), see server/README.md
  src/                   Routes, services, AI analyst, auth
  schema.txt, seed.sql   Database schema and demo data (run in the Supabase SQL Editor)
api/index.js             Vercel serverless entry that mounts the backend
public/
  geo/                   Pre-downloaded OpenStreetMap data per township
  photos/
    townships/           Township photography (named by township id)
    solar/               Solar project photography (farm, rooftop, condo, EV charger)
    rewards/             Rewards marketplace photography
    map-previews/        3D map snapshots used as thumbnails
  brand/                 Sime Darby Property logo
scripts/
  fetch-geo.mjs          Regenerates public/geo from OpenStreetMap
  place-sites.mjs        Picks where each solar site sits on the map (run after fetch-geo)
```

## Backend

The app talks to a backend in [`server/`](server/README.md): an Express API on Supabase Postgres that handles resident sign-in, subscriptions, points and rewards, Go Green trips, EV bookings, the Solar Builder Plan, alerts, and the **Solar Analyst** AI (Groq, with a rule-based fallback). It is deployed to Vercel together with the frontend through `api/index.js`.

- **Without a backend:** leave `VITE_API_URL` empty and the app runs on the built-in demo data in `src/data.ts`, with no login.
- **With a backend:** set `VITE_API_URL` in `.env.local` (see `.env.example`), configure `server/.env`, and run `cd server && npm install && npm run dev`.
- **Data contract:** the response shapes are defined in `src/api/types.ts`. Every data response carries `DataMeta` (`basis: 'verified' | 'forecast'`, `asOf`, `source`), which the UI uses to label each card *Verified data* or *Forecast*.
- **CORS:** the backend allows the Vercel domain, `https://solarkita123.github.io`, and `http://localhost:5173` for development.

Full endpoint list, database setup and environment variables are in [`server/README.md`](server/README.md).

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

After refreshing, re-take the `public/photos/map-previews/` snapshots so the Home thumbnails match the new site positions.

## Photos

Images live in `public/photos/`, grouped by purpose. Drop a file into the right folder and the app picks it up with no code change:

| Folder | Contents |
|---|---|
| `townships/` | One photo per township, named after the township id, e.g. `subang-jaya.jpg` (`.png` / `.webp` and `subang_jaya.jpg` also work). Without one, the township shows its 3D map snapshot. Ids: `subang-jaya`, `putra-heights`, `bukit-jelutong`, `denai-alam`, `saujana-impian`, `melawati`, `klgcc`, `nilai-impian`, `planters-haven`, `ainsdale`, `pagoh` |
| `solar/` | Project photography. `condo_solar.jpg` and `rooftop_solar.jpg` are used for roof sites; until added they fall back to `houses_with_solar.jpg` |
| `rewards/` | Rewards marketplace photography |
| `map-previews/` | 3D map snapshots, one per township |

Keep each image under about 300 KB.

---

Map data © OpenStreetMap contributors (ODbL).
