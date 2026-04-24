import type { PlayerRecord } from '../types.js'

export interface IPlayerStore {
  get(id: string): PlayerRecord | undefined
  upsert(record: PlayerRecord): void
  updateElo(id: string, elo: number): void
}

export class InMemoryPlayerStore implements IPlayerStore {
  private readonly map = new Map<string, PlayerRecord>()

  get(id: string): PlayerRecord | undefined {
    return this.map.get(id)
  }

  upsert(record: PlayerRecord): void {
    this.map.set(record.id, { ...record })
  }

  updateElo(id: string, elo: number): void {
    const p = this.map.get(id)
    if (p) this.map.set(id, { ...p, elo })
  }
}
