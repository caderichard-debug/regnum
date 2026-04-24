import type { Server } from 'http'
import { WebSocketServer, type WebSocket } from 'ws'
import type { GameService } from '../services/gameService.js'
import type { IPlayerStore } from '../store/playerStore.js'
import type { Color, WsIncomingGameMessage, WsIncomingMatchmakingMessage } from '../types.js'
import { registerGameSocket, unregisterGameSocket } from './wsClients.js'
import { registerMatchmakingSocket, unregisterMatchmakingSocket } from './matchmakingSockets.js'

function send(ws: WebSocket, obj: unknown): void {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj))
}

function parseJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return undefined
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

export function attachWebSockets(
  server: Server,
  gameService: GameService,
  playerStore: IPlayerStore,
): void {
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (request, socket, head) => {
    const host = request.headers.host ?? 'localhost'
    const url = new URL(request.url ?? '/', `http://${host}`)
    if (url.pathname.startsWith('/ws/game/')) {
      const gameId = url.pathname.slice('/ws/game/'.length)
      if (!gameId) {
        socket.destroy()
        return
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        handleGameSocket(ws, gameId, gameService, playerStore)
      })
      return
    }
    if (url.pathname === '/ws/matchmaking') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        handleMatchmakingSocket(ws)
      })
      return
    }
    socket.destroy()
  })
}

function handleMatchmakingSocket(ws: WebSocket): void {
  let clientId: string | undefined
  ws.on('message', (data) => {
    const msg = parseJson(data.toString()) as WsIncomingMatchmakingMessage | undefined
    if (!msg || typeof msg !== 'object' || msg.type !== 'listen') {
      send(ws, { type: 'error', message: 'expected { type: listen, wsClientId }' })
      return
    }
    if (typeof msg.wsClientId !== 'string') {
      send(ws, { type: 'error', message: 'wsClientId required' })
      return
    }
    if (clientId && clientId !== msg.wsClientId) {
      unregisterMatchmakingSocket(clientId, ws)
    }
    clientId = msg.wsClientId
    registerMatchmakingSocket(clientId, ws)
    send(ws, { type: 'connected', ok: true })
  })
  ws.on('close', () => {
    if (clientId) unregisterMatchmakingSocket(clientId, ws)
  })
}

function handleGameSocket(
  ws: WebSocket,
  urlGameId: string,
  gameService: GameService,
  playerStore: IPlayerStore,
): void {
  let authed: { gameId: string; playerId: string; color: Color } | undefined

  ws.on('message', (data) => {
    const raw = parseJson(data.toString()) as WsIncomingGameMessage | undefined
    if (!raw || typeof raw !== 'object' || !('type' in raw)) {
      send(ws, { type: 'error', message: 'invalid message' })
      return
    }

    if (!authed) {
      if (raw.type !== 'auth') {
        send(ws, { type: 'error', message: 'auth required' })
        return
      }
      if (raw.gameId !== urlGameId) {
        send(ws, { type: 'error', message: 'gameId mismatch' })
        return
      }
      if (!playerStore.get(raw.playerId)) {
        send(ws, { type: 'error', message: 'unknown player' })
        return
      }
      const stored = gameService.getStored(raw.gameId)
      if (!stored) {
        send(ws, { type: 'error', message: 'unknown game' })
        return
      }
      const color = gameService.colorForPlayer(stored.state, raw.playerId)
      if (!color) {
        send(ws, { type: 'error', message: 'not in game' })
        return
      }
      authed = { gameId: raw.gameId, playerId: raw.playerId, color }
      registerGameSocket(raw.gameId, color, ws)
      try {
        gameService.onPlayerConnected(raw.gameId, raw.playerId)
      } catch (e) {
        send(ws, { type: 'error', message: String(e) })
        ws.close()
      }
      return
    }

    const { gameId, playerId } = authed
    try {
      switch (raw.type) {
        case 'ping':
          send(ws, { type: 'pong' })
          break
        case 'move':
          if (!('from' in raw) || !('to' in raw)) {
            send(ws, { type: 'error', message: 'from/to required' })
            break
          }
          gameService.applyMoveByPlayer(gameId, playerId, raw.from, raw.to)
          break
        case 'item':
          gameService.useItem(gameId, playerId, raw.itemKey, raw.targetSquare)
          break
        case 'rematch_request':
          try {
            gameService.rematchRequest(gameId, playerId)
          } catch (e) {
            send(ws, { type: 'error', message: e instanceof Error ? e.message : 'rematch error' })
          }
          break
        case 'rematch_response':
          try {
            gameService.rematchRespond(gameId, playerId, raw.accept)
          } catch (e) {
            send(ws, { type: 'error', message: e instanceof Error ? e.message : 'rematch error' })
          }
          break
        default:
          send(ws, { type: 'error', message: 'unknown type' })
      }
    } catch (e) {
      send(ws, { type: 'error', message: e instanceof Error ? e.message : 'error' })
    }
  })

  ws.on('close', () => {
    if (!authed) return
    unregisterGameSocket(authed.gameId, authed.color, ws)
    gameService.onPlayerDisconnected(authed.gameId, authed.playerId)
  })
}
