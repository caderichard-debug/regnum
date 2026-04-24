import type { WebSocket } from 'ws'
import type { Color } from '../types.js'
import type { WsOutgoingMessage } from '../types.js'

export type GameSockets = { w?: WebSocket; b?: WebSocket }

const gameSockets = new Map<string, GameSockets>()

export function registerGameSocket(gameId: string, color: Color, ws: WebSocket): void {
  let g = gameSockets.get(gameId)
  if (!g) {
    g = {}
    gameSockets.set(gameId, g)
  }
  g[color] = ws
}

export function unregisterGameSocket(gameId: string, color: Color, ws: WebSocket): void {
  const g = gameSockets.get(gameId)
  if (!g || g[color] !== ws) return
  delete g[color]
  if (!g.w && !g.b) gameSockets.delete(gameId)
}

export function getGameSockets(gameId: string): GameSockets | undefined {
  return gameSockets.get(gameId)
}

export function broadcastToGame(gameId: string, message: WsOutgoingMessage): void {
  const g = gameSockets.get(gameId)
  if (!g) return
  const payload = JSON.stringify(message)
  for (const c of [g.w, g.b]) {
    if (c && c.readyState === 1 /* OPEN */) {
      c.send(payload)
    }
  }
}

export function sendToColor(gameId: string, color: Color, message: WsOutgoingMessage): void {
  const g = gameSockets.get(gameId)
  const c = g?.[color]
  if (c && c.readyState === 1) c.send(JSON.stringify(message))
}
