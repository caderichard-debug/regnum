# Frontend + Backend Integration Notes

## Local startup

1. Backend:
   - `cd /Users/caderichard/Regnum`
   - `npm run dev`
2. Frontend:
   - `cd /Users/caderichard/Regnum/frontend`
   - `npm run dev -- --port 5173`

## Frontend env vars

Set in frontend environment if you need non-default endpoints:

- `VITE_API_BASE_URL` (default `http://localhost:3000`)
- `VITE_WS_BASE_URL` (default `ws://localhost:3000`)

## Backend env vars

- `DATABASE_URL` (Neon Postgres connection string, prefer pooled endpoint host)
- `NEON_ORG_ID=org-bitter-tooth-16919735`
- `NEON_PROJECT_ID=dawn-bonus-34358263`

## Production deployment mapping

- Frontend: Vercel project with root directory `frontend`
- Backend: Railway service from repo root
- Database: Neon project `dawn-bonus-34358263`

## Runtime flow

1. Frontend ensures server player via `POST /api/player/guest` or `GET /api/player/me`.
2. Matchmaking page opens `ws://.../ws/matchmaking`, sends `{ type: "listen", wsClientId }`.
3. Frontend calls `POST /api/matchmaking/join` with `x-player-id` and `wsClientId`.
4. On `match_found`, frontend routes to `/play?mode=online&gameId=<id>&color=<w|b>`.
5. Play page opens `ws://.../ws/game/:gameId`, sends auth `{ type: "auth", playerId, gameId }`.
6. Gameplay messages (`move`, `item`, rematch messages, `ping`) flow over WS.

## Integration-specific frontend files

- `frontend/src/lib/config.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/socket.ts`
- `frontend/src/lib/matchmakingSocket.ts`
- `frontend/src/routes/matchmaking.tsx`
- `frontend/src/routes/play.tsx`
- `frontend/src/hooks/useGame.ts`

