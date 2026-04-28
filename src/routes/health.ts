import { Router, type Request, type Response } from 'express'
import { dbPool } from '../db/pool.js'

export function healthRouter(): Router {
  const r = Router()

  r.get('/', (_req: Request, res: Response) => {
    res.json({ ok: true })
  })

  r.get('/db', async (_req: Request, res: Response) => {
    try {
      const result = await dbPool.query<{ now: string }>('select now()::text as now')
      res.json({ ok: true, db: 'connected', now: result.rows[0]?.now ?? null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_db_error'
      res.status(500).json({ ok: false, db: 'disconnected', error: message })
    }
  })

  return r
}
