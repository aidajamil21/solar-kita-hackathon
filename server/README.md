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

## Sign-in

Residents sign in with just their email (no password) on the app's login page:

- `POST /api/auth/login` with `{ email }` returns `{ isNew: false, token, email, name }` for an existing account, or `{ isNew: true }` for a new email.
- `POST /api/auth/register` with `{ email, name, townshipId }` creates the Supabase Auth user (profile via the existing trigger, +50 welcome points) and returns a token.
- Every other `/api/*` call needs `Authorization: Bearer <token>`. Tokens are HMAC-signed by the server (`SESSION_SECRET`, or a secret derived from the service-role key) and last 30 days.

This is prototype-grade: anyone who knows a resident's email can sign in as them. Before real use, send a one-time code (Supabase `signInWithOtp`) and check it in `/api/auth/login`.

`GET /api/health` is public.

## Endpoints

All endpoints are prefixed with `/api` and need the sign-in token (see above).

App data (what the frontend loads at startup and writes through):

- `GET /api/health`
- `GET /api/catalogue`: townships, sites (with `taken` = units held by other residents) and rewards, in the frontend's shapes
- `GET /api/me`: name, points, lifetime points, township, map mode, holdings, redemptions, activity, check-ins
- `PATCH /api/me` with `{ townshipId?, mapMode?, fullName? }`
- `POST /api/subscriptions` with `{ siteId, units: number[] }`: claims units, records the contribution, awards points, books this month's credit, raises an alert (409 if a unit is taken)
- `POST /api/redemptions` with `{ rewardId, code? }` (400 if not enough points)
- `POST /api/checkins` (+10 points once a day, 409 if already checked in)
- `POST /api/demo/reset`: restores the caller's personal data to their seeded starting state (from `src/mockdata.js`); accounts that aren't demo residents become a fresh account

Go Green (walk or cycle in your township to earn points; needs `green.sql`):

- `GET /api/green/rules`: points per km, speed limits, daily cap, area radius
- `GET /api/green/trips`: recent walks and rides
- `POST /api/green/trips` with `{ mode: 'walk' | 'cycle', source: 'gps' | 'demo', path: [{ lat, lon, t }] }`: the server recomputes distance and speed from the path, checks the trip is mostly within the area around the resident's township, then awards whole points (1 per 3 km walked, 1 per 5 km cycled, max 20 a day)

Solar Builder Plan (monthly payments, each returned over 120 months + 3% a year on the outstanding part; needs `plan.sql`):

- `GET /api/plan`: the plan, payments, totals (paid, returned, extra, still to come) and monthly credits. Monthly payments and credits are brought up to date whenever the plan or `/api/me` is read (there's no background job).
- `POST /api/plan` with `{ monthlyAmount, siteId }`: starts the plan and takes the first payment
- `PATCH /api/plan` with `{ monthlyAmount?, status?: 'active' | 'paused' }`
- `DELETE /api/plan`: stops future payments; earlier payments keep coming back
- `POST /api/plan/skip-month`: prototype demo tool that moves the plan one month into the past (disabled when `SHOW_TEST_ACCOUNTS=false`)

Plan payments are also written to `contributions` and their credits to `payouts` (linked by `plan_payment_id`), so portfolio totals, the credit ledger and the AI analyst include them. Points: 1 per RM 5, +50 at a 6-month streak, +100 every 12.

AI analyst tools:

- `GET /api/portfolio/summary`
- `GET /api/returns/realized`
- `POST /api/scenarios/projected` with `{ "amount": number, "years": number }`
- `GET /api/projects/:projectId/performance`
- `GET /api/impact/environmental`

Alerts and chat:

- `GET /api/alerts`, `POST /api/alerts/:id/read`, `POST /api/alerts/read-all`
- `GET|POST|DELETE /api/chat/messages`: the signed-in resident's own conversation
- `GET|POST|DELETE /api/conversations/:conversationId/messages` (POST `{ text }` returns the Solar Analyst's reply with tool calls, data cards and follow-up suggestions; the conversation is created on first use)

Errors return `{ error }` with a 4xx status for bad input and 500 for server faults.

## Notes

- Database setup (Supabase SQL Editor): run `schema.txt`, then `seed.sql`. `seed.sql` is standalone: it also creates the Go Green, Solar Builder Plan and EV charging tables (the same as `green.sql`, `plan.sql` and `ev.sql`, which stay for upgrading an existing database). It wipes all `public.*` tables and re-creates the 12 demo residents (`neighbour01`..`neighbour12@demo.solarkita.my`), each with holdings, credits, points, redemptions and notifications, and for some, Go Green trips, a Solar Builder Plan and EV charging sessions. It is generated together with `src/mockdata.js` (used by "Reset demo data") from the frontend data, so ids, prices and taken units match the app.
- Supabase's REST API returns at most 1,000 rows per request by default; `solar_readings` holds one row per site per day, so per-site queries stay under that.
- This backend maps to the schema you shared (townships/sites/subscriptions/contributions/payouts/rewards/alerts/messages).
- The Solar Analyst (`src/llm.js`) runs on Groq (`GROQ_LLM_API`, default model `openai/gpt-oss-120b`, fallback `openai/gpt-oss-20b`) with read-only tools: `get_user_portfolio`, `get_project_performance`, `calculate_investment_return`, `compare_investment_scenarios`, `get_environmental_impact`, `get_recent_alerts` and `find_projects` (public catalogue). Tools always run for the signed-in resident; the model is never given a user id. Each reply carries data cards built from the tool results (not from the model's text), page buttons (`links`) checked against a fixed list of pages, and follow-up suggestions. Groq's free tier allows about 8,000 tokens a minute per model (a question uses about 3,000), so the prompt and tool results are kept compact. If Groq isn't configured, fails, or both models are rate-limited, the rule-based analyst (`src/assistant.js`) answers instead. Set `ANALYST_DEBUG=1` to log token use.
- Code layout: `services.js` reads data, `actions.js` writes it, `llm.js` / `assistant.js` answer chat, `routes.js` maps HTTP to those.
