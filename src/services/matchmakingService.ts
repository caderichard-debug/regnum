import type { Color } from '../types.js'
import type { MatchmakingEntry } from '../types.js'
import type { IMatchmakingStore } from '../store/matchmakingStore.js'
import type { IPlayerStore } from '../store/playerStore.js'
import type { GameService } from './gameService.js'
import { sendMatchmaking } from '../ws/matchmakingSockets.js'

export type JoinResult =
  | { status: 'waiting' }
  | { status: 'matched'; gameId: string; color: Color }

export class MatchmakingService {
  constructor(
    private readonly mmStore: IMatchmakingStore,
    private readonly playerStore: IPlayerStore,
    private readonly gameService: GameService,
  ) {}

  join(playerId: string, wsClientId: string): JoinResult {
    const p = this.playerStore.get(playerId)
    if (!p) throw Object.assign(new Error('Unknown player'), { status: 404 })

    const now = Date.now()
    const self: MatchmakingEntry = { playerId, elo: p.elo, joinedAt: now, wsClientId }
    this.mmStore.remove(playerId)

    const others = this.mmStore.listWaiting().filter((e) => e.playerId !== playerId)
    let best: MatchmakingEntry | undefined
    let bestDiff = Infinity

    for (const o of others) {
      const minJoined = Math.min(self.joinedAt, o.joinedAt)
      const window = 200 + 50 * Math.floor((now - minJoined) / 10_000)
      const diff = Math.abs(self.elo - o.elo)
      if (diff <= window && diff < bestDiff) {
        bestDiff = diff
        best = o
      }
    }

    if (!best) {
      this.mmStore.enqueue(self)
      return { status: 'waiting' }
    }

    this.mmStore.remove(best.playerId)

    const swap = Math.random() < 0.5
    const whiteId = swap ? best.playerId : self.playerId
    const blackId = swap ? self.playerId : best.playerId
    const selfColor: Color = swap ? 'b' : 'w'
    const bestColor: Color = swap ? 'w' : 'b'

    const { gameId } = this.gameService.createGame(whiteId, blackId)

    sendMatchmaking(self.wsClientId, { type: 'match_found', gameId, color: selfColor })
    sendMatchmaking(best.wsClientId, { type: 'match_found', gameId, color: bestColor })

    return { status: 'matched', gameId, color: selfColor }
  }

  cancel(playerId: string): void {
    this.mmStore.remove(playerId)
  }
}
