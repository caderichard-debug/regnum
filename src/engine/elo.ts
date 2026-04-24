const K = 32

export function expectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + 10 ** ((opponentElo - playerElo) / 400))
}

export function newElo(playerElo: number, opponentElo: number, score: 0 | 0.5 | 1): number {
  const exp = expectedScore(playerElo, opponentElo)
  return Math.round(playerElo + K * (score - exp))
}

export function applyEloPair(
  eloW: number,
  eloB: number,
  outcome: 'w' | 'b' | 'draw',
): { newW: number; newB: number; deltaW: number; deltaB: number } {
  const scoreW: 0 | 0.5 | 1 = outcome === 'w' ? 1 : outcome === 'draw' ? 0.5 : 0
  const scoreB: 0 | 0.5 | 1 = outcome === 'b' ? 1 : outcome === 'draw' ? 0.5 : 0
  const newW = newElo(eloW, eloB, scoreW)
  const newB = newElo(eloB, eloW, scoreB)
  return { newW, newB, deltaW: newW - eloW, deltaB: newB - eloB }
}
