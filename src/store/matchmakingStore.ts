import type { MatchmakingEntry } from '../types.js'

export interface IMatchmakingStore {
  enqueue(entry: MatchmakingEntry): void
  remove(playerId: string): void
  listWaiting(): MatchmakingEntry[]
  get(playerId: string): MatchmakingEntry | undefined
}

export class InMemoryMatchmakingStore implements IMatchmakingStore {
  private readonly byPlayer = new Map<string, MatchmakingEntry>()

  enqueue(entry: MatchmakingEntry): void {
    this.byPlayer.set(entry.playerId, { ...entry })
  }

  remove(playerId: string): void {
    this.byPlayer.delete(playerId)
  }

  listWaiting(): MatchmakingEntry[] {
    return [...this.byPlayer.values()]
  }

  get(playerId: string): MatchmakingEntry | undefined {
    const e = this.byPlayer.get(playerId)
    return e ? { ...e } : undefined
  }
}
