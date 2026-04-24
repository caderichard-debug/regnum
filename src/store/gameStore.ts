import type { StoredGame } from '../types.js'

export interface IGameStore {
  get(gameId: string): StoredGame | undefined
  save(gameId: string, stored: StoredGame): void
  delete(gameId: string): void
  has(gameId: string): boolean
}

export class InMemoryGameStore implements IGameStore {
  private readonly map = new Map<string, StoredGame>()

  get(gameId: string): StoredGame | undefined {
    const v = this.map.get(gameId)
    return v ? { state: cloneState(v.state), meta: { ...v.meta } } : undefined
  }

  save(gameId: string, stored: StoredGame): void {
    this.map.set(gameId, { state: cloneState(stored.state), meta: { ...stored.meta } })
  }

  delete(gameId: string): void {
    this.map.delete(gameId)
  }

  has(gameId: string): boolean {
    return this.map.has(gameId)
  }
}

function cloneState<T>(s: T): T {
  return JSON.parse(JSON.stringify(s)) as T
}
