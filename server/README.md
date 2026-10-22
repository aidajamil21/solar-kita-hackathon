# Solar Kita Backend

Backend API for Solar Kita prototype, connected to Supabase Postgres schema.

## Environment

Create/update `server/.env` (see `.env.example`):

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
PORT=2000
FRONTEND_URL=http://localhost:5173
```

The server talks to Supabase through its HTTPS API (port 443) with the service-role key, so it
works on networks that block the Postgres ports (5432/6543). The service role bypasses RLS, so
every route filters by the caller's user id itself. Keep the key in `server/.env` only.

## Run

```bash
cd server
npm install
npm run dev
```

Server runs at `http://localhost:2000`.

## Auth model (temporary)

Current implementation expects header `x-user-id` on every `/api/*` request.
Use a real Supabase JWT verification middleware next.

## Endpoints

All endpoints are prefixed with `/api` and require `x-user-id` (the resident's auth.users id).

App data (what the frontend loads at startup and writes through):

- `GET /api/health`
- `GET /api/catalogue`: townships, sites (with `taken` = units held by other residents) and rewards, in the frontend's shapes
- `GET /api/me`: name, points, lifetime points, township, map mode, holdings, redemptions, activity, check-ins
- `PATCH /api/me` with `{ townshipId?, mapMode?, fullName? }`
- `POST /api/subscriptions` with `{ siteId, units: number[] }`: claims units, records the contribution, awards points, books this month's credit, raises an alert (409 if a unit is taken)
- `POST /api/redemptions` with `{ rewardId, code? }` (400 if not enough points)
- `POST /api/checkins` (+10 points once a day, 409 if already checked in)
- `POST /api/demo/reset`: restores the caller's personal data to the seeded demo state

Go Green (walk or cycle in your township to earn points; needs `green.sql`):

- `GET /api/green/rules`: points per km, speed limits, daily cap, area radius
- `GET /api/green/trips`: recent walks and rides
- `POST /api/green/trips` with `{ mode: 'walk' | 'cycle', source: 'gps' | 'demo', path: [{ lat, lon, t }] }`: the server recomputes distance and speed from the path, checks the trip is mostly within the area around the resident's township, then awards whole points (1 per 3 km walked, 1 per 5 km cycled, max 20 a day)

AI analyst tools:

- `GET /api/portfolio/summary`
- `GET /api/returns/realized`
- `POST /api/scenarios/projected` with `{ "amount": number, "years": number }`
- `GET /api/projects/:projectId/performance`
- `GET /api/impact/environmental`

Alerts and chat:

- `GET /api/alerts`, `POST /api/alerts/:id/read`, `POST /api/alerts/read-all`
- `GET|POST|DELETE /api/conversations/:conversationId/messages` (POST `{ text }` returns the Solar Analyst's reply with tool calls, data cards and follow-up suggestions; the conversation is created on first use)

Errors return `{ error }` with a 4xx status for bad input and 500 for server faults.

## Notes

- Database setup (Supabase SQL Editor): run `schema.txt`, then `seed.sql`, then `green.sql` (Go Green trips). `seed.sql` is generated from the frontend data (same site ids, prices, taken units, demo resident holdings, points and alerts) and wipes all `public.*` tables first. `seed.txt` is the older seed and is superseded.
- Supabase's REST API returns at most 1,000 rows per request by default; `solar_readings` holds one row per site per day, so per-site queries stay under that.
- This backend maps to the schema you shared (townships/sites/subscriptions/contributions/payouts/rewards/alerts/messages).
- The Solar Analyst (`src/assistant.js`) is rule-based: it picks the matching tool for the question, answers from live data and labels projections as forecasts. Swapping in an LLM later only needs `answer()` replaced.
- Code layout: `services.js` reads data, `actions.js` writes it, `assistant.js` answers chat, `routes.js` maps HTTP to those.
