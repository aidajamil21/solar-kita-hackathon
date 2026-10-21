# Solar Kita Backend

Backend API for Solar Kita prototype, connected to Supabase Postgres schema.

## Environment

Create/update `server/.env`:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres?sslmode=require
PORT=3000
FRONTEND_URL=http://localhost:5173
```

## Run

```bash
cd server
npm install
npm run dev
```

Server runs at `http://localhost:3000`.

## Auth model (temporary)

Current implementation expects header `x-user-id` on every `/api/*` request.
Use a real Supabase JWT verification middleware next.

## Endpoints

All endpoints are prefixed with `/api` and require `x-user-id`.

- `GET /api/health`
- `GET /api/portfolio/summary`
- `GET /api/returns/realized`
- `POST /api/scenarios/projected` with `{ "amount": number, "years": number }`
- `GET /api/projects/:projectId/performance`
- `GET /api/impact/environmental`
- `GET /api/alerts`
- `POST /api/alerts/:id/read`
- `POST /api/demo/seed` with `{ "conversationId": "uuid" }`
- `GET /api/conversations/:conversationId/messages`
- `POST /api/conversations/:conversationId/messages` with `{ "text": string }`
- `DELETE /api/conversations/:conversationId/messages`

## Notes

- This backend maps to the schema you shared (townships/sites/subscriptions/contributions/payouts/rewards/alerts/messages).
- AI streaming events and tool orchestration are not implemented yet; chat endpoint currently stores user message and creates a simple assistant reply.
