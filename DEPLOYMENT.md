# Deployment Setup

This project is configured for:

- Frontend: Vercel
- Backend API/WebSocket: Railway
- Database: Neon

## 1) Frontend on Vercel

1. Import this repository in Vercel.
2. Set the Vercel project **Root Directory** to `frontend`.
3. Build settings are already defined in `frontend/vercel.json`.
4. Add Vercel environment variables:
   - `VITE_API_BASE_URL=https://<your-railway-service>.up.railway.app`
   - `VITE_WS_BASE_URL=wss://<your-railway-service>.up.railway.app`
5. Deploy.

Notes:
- `frontend/vercel.json` includes a rewrite to `index.html` so client-side routes work.
- Use `wss://` for WebSocket connections in production.

## 2) Backend on Railway

Create a Railway service from this repo root and use:

- Build command: `npm install && npm run build`
- Start command: `npm run start`

Set Railway environment variables:

- `PORT` (Railway usually injects this automatically)
- `DATABASE_URL` (Neon pooled connection string)
- `NEON_ORG_ID=org-bitter-tooth-16919735`
- `NEON_PROJECT_ID=dawn-bonus-34358263`
- (optional) `NODE_ENV=production`

## 3) Database on Neon

Use project:

- org: `org-bitter-tooth-16919735`
- project: `dawn-bonus-34358263`

Use pooled connection strings (`-pooler`) for runtime connections from Railway.

## 4) Post-deploy checks

- Frontend loads from Vercel URL.
- API health: `https://<railway-service>.up.railway.app/api/health`
- DB health: `https://<railway-service>.up.railway.app/api/health/db`
- Frontend game flow can connect to Railway WebSocket endpoints.
