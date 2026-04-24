import assert from 'node:assert'
import { describe, it } from 'node:test'
import { InMemoryGameStore } from '../store/gameStore.js'
import { InMemoryPlayerStore } from '../store/playerStore.js'
import { GameService } from './gameService.js'

describe('GameService move', () => {
  it('rejects wrong player', () => {
    const ps = new InMemoryPlayerStore()
    const gs = new InMemoryGameStore()
    const svc = new GameService(gs, ps)
    ps.upsert({ id: 'a', name: 'A', elo: 1000 })
    ps.upsert({ id: 'b', name: 'B', elo: 1000 })
    const { gameId } = svc.createGame('a', 'b')
    assert.throws(() => svc.applyMoveByPlayer(gameId, 'b', 'e2', 'e4'), /Not your turn/)
  })

  it('allows white e4', () => {
    const ps = new InMemoryPlayerStore()
    const gs = new InMemoryGameStore()
    const svc = new GameService(gs, ps)
    ps.upsert({ id: 'a', name: 'A', elo: 1000 })
    ps.upsert({ id: 'b', name: 'B', elo: 1000 })
    const { gameId } = svc.createGame('a', 'b')
    const st = svc.applyMoveByPlayer(gameId, 'a', 'e2', 'e4')
    assert.strictEqual(st.board[4]![4], 'wP')
    assert.strictEqual(st.turn, 'b')
  })
})

describe('turn timer', () => {
  it('fires and ends game', async () => {
    const ps = new InMemoryPlayerStore()
    const gs = new InMemoryGameStore()
    const svc = new GameService(gs, ps)
    ps.upsert({ id: 'a', name: 'A', elo: 1000 })
    ps.upsert({ id: 'b', name: 'B', elo: 1000 })
    const { gameId } = svc.createGame('a', 'b')
    const stored = gs.get(gameId)!
    stored.state.turnDurationMs = 5
    stored.state.turnDeadline = Date.now() + 5
    gs.save(gameId, stored)
    svc['scheduleTurnTimer'](gameId, gs.get(gameId)!.state)

    await new Promise((r) => setTimeout(r, 40))
    const after = gs.get(gameId)!.state
    assert.strictEqual(after.gameOver, true)
  })
})
