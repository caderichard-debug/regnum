import { Router, type Request, type Response } from 'express'
import type { GameService, GameServiceError } from '../services/gameService.js'
import type { IPlayerStore } from '../store/playerStore.js'

function playerIdHeader(req: Request): string | undefined {
  const h = req.headers['x-player-id']
  return typeof h === 'string' ? h : Array.isArray(h) ? h[0] : undefined
}

function gid(req: Request): string {
  return String(req.params.gameId)
}

function handleGameError(res: Response, e: unknown): boolean {
  if (e && typeof e === 'object' && (e as GameServiceError).name === 'GameServiceError') {
    const err = e as GameServiceError
    const body: { error: string } = { error: err.message }
    if (err.code === 'turn_timeout') {
      res.status(400).json({ error: 'turn_timeout' })
      return true
    }
    res.status(err.status).json(body)
    return true
  }
  return false
}

export function gameRouter(gameService: GameService, playerStore: IPlayerStore): Router {
  const r = Router()

  r.post('/', (req: Request, res: Response) => {
    const { playerWId, playerBId } = (req.body ?? {}) as { playerWId?: string; playerBId?: string }
    if (!playerWId || !playerBId) {
      res.status(400).json({ error: 'playerWId and playerBId required' })
      return
    }
    if (!playerStore.get(playerWId) || !playerStore.get(playerBId)) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    try {
      const { gameId, state } = gameService.createGame(playerWId, playerBId)
      res.json({ gameId, state })
    } catch (e) {
      if (handleGameError(res, e)) return
      throw e
    }
  })

  r.get('/:gameId', (req: Request, res: Response) => {
    try {
      res.json(gameService.getState(gid(req)))
    } catch (e) {
      if (handleGameError(res, e)) return
      throw e
    }
  })

  r.get('/:gameId/legal-moves', (req: Request, res: Response) => {
    const id = playerIdHeader(req)
    if (!id) {
      res.status(400).json({ error: 'missing x-player-id' })
      return
    }
    const square = req.query.square as string | undefined
    if (!square) {
      res.status(400).json({ error: 'square query required' })
      return
    }
    try {
      const moves = gameService.legalMovesFor(gid(req), id, square)
      res.json({ moves })
    } catch (e) {
      if (handleGameError(res, e)) return
      throw e
    }
  })

  r.post('/:gameId/move', (req: Request, res: Response) => {
    const id = playerIdHeader(req)
    if (!id) {
      res.status(400).json({ error: 'missing x-player-id' })
      return
    }
    const { from, to } = (req.body ?? {}) as { from?: string; to?: string }
    if (!from || !to) {
      res.status(400).json({ error: 'from and to required' })
      return
    }
    try {
      const state = gameService.applyMoveByPlayer(gid(req), id, from, to)
      res.json(state)
    } catch (e) {
      if (handleGameError(res, e)) return
      throw e
    }
  })

  r.post('/:gameId/item', (req: Request, res: Response) => {
    const id = playerIdHeader(req)
    if (!id) {
      res.status(400).json({ error: 'missing x-player-id' })
      return
    }
    const { itemKey, targetSquare } = (req.body ?? {}) as { itemKey?: string; targetSquare?: string }
    if (!itemKey) {
      res.status(400).json({ error: 'itemKey required' })
      return
    }
    try {
      const state = gameService.useItem(gid(req), id, itemKey, targetSquare)
      res.json(state)
    } catch (e) {
      if (handleGameError(res, e)) return
      throw e
    }
  })

  r.post('/:gameId/rematch', (req: Request, res: Response) => {
    const id = playerIdHeader(req)
    if (!id) {
      res.status(400).json({ error: 'missing x-player-id' })
      return
    }
    const { accept } = (req.body ?? {}) as { accept?: boolean }
    try {
      const out = gameService.rematchRest(gid(req), id, accept)
      res.json(out)
    } catch (e) {
      if (handleGameError(res, e)) return
      throw e
    }
  })

  r.post('/:gameId/forfeit', (req: Request, res: Response) => {
    const id = playerIdHeader(req)
    if (!id) {
      res.status(400).json({ error: 'missing x-player-id' })
      return
    }
    try {
      const state = gameService.forfeit(gid(req), id)
      res.json(state)
    } catch (e) {
      if (handleGameError(res, e)) return
      throw e
    }
  })

  return r
}
