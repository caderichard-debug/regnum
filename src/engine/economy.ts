import type { Color, GameState, Piece, PieceType, Square } from '../types.js'
import { isInCheck } from './chess.js'

export const PIECE_VALUE: Record<PieceType, number> = {
  P: 1,
  N: 3,
  B: 3,
  R: 5,
  Q: 9,
  K: 0,
}

export const CENTER_SQUARES = new Set<Square>([
  'd4',
  'd5',
  'e4',
  'e5',
  'c3',
  'c6',
  'f3',
  'f6',
])

export function parsePieceType(p: Piece | null): PieceType | null {
  if (!p || p.length !== 2) return null
  return p[1] as PieceType
}

export function parsePieceColor(p: Piece | null): Color | null {
  if (!p || p.length !== 2) return null
  const c = p[0]
  return c === 'w' || c === 'b' ? c : null
}

export function decrementFrozenSquares(frozen: Record<Square, number>): Record<Square, number> {
  const next: Record<Square, number> = {}
  for (const [sq, n] of Object.entries(frozen)) {
    const v = Math.max(0, n - 1)
    if (v > 0) next[sq as Square] = v
  }
  return next
}

export function countCenterPieces(board: GameState['board'], color: Color): number {
  let n = 0
  for (const sq of CENTER_SQUARES) {
    const p = getPieceAt(board, sq)
    if (p && parsePieceColor(p) === color) n++
  }
  return n
}

function getPieceAt(board: GameState['board'], sq: Square): Piece | null {
  const file = sq[0]!.charCodeAt(0) - 'a'.charCodeAt(0)
  const rank = Number(sq[1])
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null
  const row = 8 - rank
  return board[row]![file] ?? null
}

export function incomeForPlayer(board: GameState['board'], color: Color): number {
  return 2 + countCenterPieces(board, color)
}

/** Ghost blocks capture on ghostPiece.sq while set (friendly piece there cannot be taken). */
export function isGhostProtectedCapture(
  state: GameState,
  _from: Square,
  to: Square,
  moverColor: Color,
): boolean {
  const g = state.ghostPiece
  if (!g || g.sq !== to) return false
  const occ = getPieceAt(state.board, to)
  if (!occ) return false
  const victimColor = parsePieceColor(occ)
  if (!victimColor || victimColor === moverColor) return false
  return true
}

export function isFromFrozen(state: GameState, from: Square): boolean {
  return (state.frozenSquares[from] ?? 0) > 0
}

export const ITEM_DEFS: Record<
  string,
  { cost: number; once: boolean; endsTurn: boolean }
> = {
  inspire: { cost: 10, once: false, endsTurn: true },
  promote: { cost: 15, once: false, endsTurn: true },
  recall: { cost: 18, once: true, endsTurn: false },
  ghost: { cost: 22, once: false, endsTurn: false },
  sabotage: { cost: 38, once: false, endsTurn: false },
  reinforce: { cost: 28, once: false, endsTurn: false },
}
