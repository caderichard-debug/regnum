export type TurnTimerFire = (gameId: string, turnWhenScheduled: string) => void

/** Per-game turn deadline: fires once after delay unless cleared. */
export class TurnTimerManager {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(private readonly onFire: TurnTimerFire) {}

  schedule(gameId: string, delayMs: number, turnWhenScheduled: string): void {
    this.clear(gameId)
    const id = setTimeout(() => {
      this.timers.delete(gameId)
      this.onFire(gameId, turnWhenScheduled)
    }, delayMs)
    this.timers.set(gameId, id)
  }

  clear(gameId: string): void {
    const t = this.timers.get(gameId)
    if (t) {
      clearTimeout(t)
      this.timers.delete(gameId)
    }
  }

  clearAll(): void {
    for (const t of this.timers.values()) clearTimeout(t)
    this.timers.clear()
  }
}
