import type { WebSocket } from 'ws'
import type { WsOutgoingMessage } from '../types.js'

const byClientId = new Map<string, WebSocket>()

export function registerMatchmakingSocket(wsClientId: string, ws: WebSocket): void {
  byClientId.set(wsClientId, ws)
}

export function unregisterMatchmakingSocket(wsClientId: string, ws: WebSocket): void {
  if (byClientId.get(wsClientId) === ws) byClientId.delete(wsClientId)
}

export function sendMatchmaking(wsClientId: string, message: WsOutgoingMessage): void {
  const ws = byClientId.get(wsClientId)
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(message))
}
