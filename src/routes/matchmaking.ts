import { Router, type Request, type Response } from 'express'
import type { MatchmakingService } from '../services/matchmakingService.js'
import type { IPlayerStore } from '../store/playerStore.js'

function playerIdHeader(req: Request): string | undefined {
  const h = req.headers['x-player-id']
  return typeof h === 'string' ? h : Array.isArray(h) ? h[0] : undefined
}

export function matchmakingRouter(mm: MatchmakingService, playerStore: IPlayerStore): Router {
  const r = Router()

  r.post('/join', (req: Request, res: Response) => {
    const id = playerIdHeader(req)
    if (!id) {
      res.status(400).json({ error: 'missing x-player-id' })
      return
    }
    if (!playerStore.get(id)) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const wsClientId = (req.body as { wsClientId?: string }).wsClientId
    if (!wsClientId || typeof wsClientId !== 'string') {
      res.status(400).json({ error: 'wsClientId required' })
      return
    }
    try {
      const result = mm.join(id, wsClientId)
      res.json(result)
    } catch (e) {
      if (e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 404) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      throw e
    }
  })

  r.delete('/cancel', (req: Request, res: Response) => {
    const id = playerIdHeader(req)
    if (!id) {
      res.status(400).json({ error: 'missing x-player-id' })
      return
    }
    mm.cancel(id)
    res.json({ status: 'cancelled' })
  })

  return r
}
