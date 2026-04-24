import { Router, type Request, type Response } from 'express'
import { randomUUID } from 'crypto'
import type { IPlayerStore } from '../store/playerStore.js'

function playerIdHeader(req: Request): string | undefined {
  const h = req.headers['x-player-id']
  return typeof h === 'string' ? h : Array.isArray(h) ? h[0] : undefined
}

export function playerRouter(playerStore: IPlayerStore): Router {
  const r = Router()

  r.post('/guest', (_req: Request, res: Response) => {
    const id = randomUUID()
    const suffix = Math.floor(1000 + Math.random() * 9000)
    const name = `Guest#${suffix}`
    const elo = 1000
    playerStore.upsert({ id, name, elo })
    res.json({ playerId: id, name, elo })
  })

  r.get('/me', (req: Request, res: Response) => {
    const id = playerIdHeader(req)
    if (!id) {
      res.status(400).json({ error: 'missing x-player-id' })
      return
    }
    const p = playerStore.get(id)
    if (!p) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json(p)
  })

  return r
}
