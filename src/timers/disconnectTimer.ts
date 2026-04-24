export type DisconnectFire = (gameId: string, color: 'w' | 'b') => void

function key(gameId: string, color: 'w' | 'b'): string {
  return `${gameId}:${color}`
}

export class DisconnectTimerManager {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(private readonly onFire: DisconnectFire) {}

  schedule(gameId: string, color: 'w' | 'b', delayMs: number): void {
    const k = key(gameId, color)
    this.clear(gameId, color)
    const id = setTimeout(() => {
      this.timers.delete(k)
      this.onFire(gameId, color)
    }, delayMs)
    this.timers.set(k, id)
  }

  /** Returns true if a pending timer was cleared (reconnect within window). */
  clear(gameId: string, color: 'w' | 'b'): boolean {
    const k = key(gameId, color)
    const t = this.timers.get(k)
    if (t) {
      clearTimeout(t)
      this.timers.delete(k)
      return true
    }
    return false
  }

  clearGame(gameId: string): void {
    this.clear(gameId, 'w')
    this.clear(gameId, 'b')
  }

  clearAll(): void {
    for (const t of this.timers.values()) clearTimeout(t)
    this.timers.clear()
  }
}
