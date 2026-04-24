import type { Color, GameState, Piece, PieceType, Square } from '../types.js'

/** Row 0 = rank 8, row 7 = rank 1. Col 0 = a, col 7 = h. */
export interface Coords {
  row: number
  col: number
}

const FILES = 'abcdefgh'

export function squareToCoords(sq: Square): Coords | null {
  if (sq.length !== 2) return null
  const file = FILES.indexOf(sq[0]!)
  const rank = Number(sq[1])
  if (file < 0 || rank < 1 || rank > 8) return null
  return { row: 8 - rank, col: file }
}

export function coordsToSquare(c: Coords): Square {
  return `${FILES[c.col]!}${8 - c.row}` as Square
}

function parsePiece(p: Piece | null): { color: Color; type: PieceType } | null {
  if (!p || p.length !== 2) return null
  const color = p[0] as Color
  const type = p[1] as PieceType
  if ((color !== 'w' && color !== 'b') || !'PNBRQK'.includes(type)) return null
  return { color, type }
}

function cloneBoard(board: (Piece | null)[][]): (Piece | null)[][] {
  return board.map((r) => [...r])
}

function getAt(board: (Piece | null)[][], sq: Square): Piece | null {
  const c = squareToCoords(sq)
  if (!c) return null
  return board[c.row]![c.col] ?? null
}

function setAt(board: (Piece | null)[][], sq: Square, piece: Piece | null): void {
  const c = squareToCoords(sq)
  if (!c) return
  board[c.row]![c.col] = piece
}

function findKing(board: (Piece | null)[][], color: Color): Square | null {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const p = board[row]![col]
      const parsed = parsePiece(p)
      if (parsed?.type === 'K' && parsed.color === color) {
        return coordsToSquare({ row, col })
      }
    }
  }
  return null
}

function isInside(c: Coords): boolean {
  return c.row >= 0 && c.row < 8 && c.col >= 0 && c.col < 8
}

function add(c: Coords, dr: number, dc: number): Coords {
  return { row: c.row + dr, col: c.col + dc }
}

/** Ray attacks along directions until blocked; include occupied enemy for capture */
function rayMoves(
  board: (Piece | null)[][],
  from: Coords,
  color: Color,
  dirs: [number, number][],
): Square[] {
  const out: Square[] = []
  for (const [dr, dc] of dirs) {
    let cur = add(from, dr, dc)
    while (isInside(cur)) {
      const p = board[cur.row]![cur.col]
      if (!p) {
        out.push(coordsToSquare(cur))
        cur = add(cur, dr, dc)
        continue
      }
      const oc = parsePiece(p)?.color
      if (oc && oc !== color) out.push(coordsToSquare(cur))
      break
    }
  }
  return out
}

function stepMoves(
  board: (Piece | null)[][],
  from: Coords,
  color: Color,
  steps: [number, number][],
): Square[] {
  const out: Square[] = []
  for (const [dr, dc] of steps) {
    const cur = add(from, dr, dc)
    if (!isInside(cur)) continue
    const p = board[cur.row]![cur.col]
    if (!p) {
      out.push(coordsToSquare(cur))
      continue
    }
    if (parsePiece(p)?.color !== color) out.push(coordsToSquare(cur))
  }
  return out
}

const KNIGHT_STEPS: [number, number][] = [
  [2, 1],
  [2, -1],
  [-2, 1],
  [-2, -1],
  [1, 2],
  [1, -2],
  [-1, 2],
  [-1, -2],
]

const KING_STEPS: [number, number][] = []
for (let dr = -1; dr <= 1; dr++) {
  for (let dc = -1; dc <= 1; dc++) {
    if (dr === 0 && dc === 0) continue
    KING_STEPS.push([dr, dc])
  }
}

function pseudoLegalMovesFrom(
  board: (Piece | null)[][],
  fromSq: Square,
  enPassantTarget: Square | null,
  castlingRights: GameState['castlingRights'],
): Square[] {
  const from = squareToCoords(fromSq)
  if (!from) return []
  const piece = board[from.row]![from.col]
  const parsed = parsePiece(piece)
  if (!parsed) return []
  const { color, type } = parsed

  switch (type) {
    case 'P': {
      const dir = color === 'w' ? -1 : 1
      const startRank = color === 'w' ? 6 : 1
      const out: Square[] = []
      const one = add(from, dir, 0)
      if (isInside(one) && !board[one.row]![one.col]) {
        out.push(coordsToSquare(one))
        const two = add(from, 2 * dir, 0)
        if (from.row === startRank && !board[two.row]![two.col]) {
          out.push(coordsToSquare(two))
        }
      }
      for (const dc of [-1, 1]) {
        const cap = add(from, dir, dc)
        if (!isInside(cap)) continue
        const target = board[cap.row]![cap.col]
        if (target && parsePiece(target)?.color !== color) {
          out.push(coordsToSquare(cap))
        } else if (!target && enPassantTarget && coordsToSquare(cap) === enPassantTarget) {
          out.push(coordsToSquare(cap))
        }
      }
      return out
    }
    case 'N':
      return stepMoves(board, from, color, KNIGHT_STEPS)
    case 'B':
      return rayMoves(board, from, color, [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ])
    case 'R':
      return rayMoves(board, from, color, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
    case 'Q':
      return rayMoves(board, from, color, [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
    case 'K': {
      const m = stepMoves(board, from, color, KING_STEPS)
      const sq = coordsToSquare(from)
      if (color === 'w' && sq === 'e1') {
        if (castlingRights.wK && !board[7]![5] && !board[7]![6] && board[7]![7] === 'wR') {
          m.push('g1')
        }
        if (castlingRights.wQ && !board[7]![3] && !board[7]![2] && !board[7]![1] && board[7]![0] === 'wR') {
          m.push('c1')
        }
      }
      if (color === 'b' && sq === 'e8') {
        if (castlingRights.bK && !board[0]![5] && !board[0]![6] && board[0]![7] === 'bR') {
          m.push('g8')
        }
        if (castlingRights.bQ && !board[0]![3] && !board[0]![2] && !board[0]![1] && board[0]![0] === 'bR') {
          m.push('c8')
        }
      }
      return m
    }
    default:
      return []
  }
}

/** Whether `byColor` attacks `target` (pawn captures only, no forward empty). */
export function isSquareAttacked(board: (Piece | null)[][], target: Square, byColor: Color): boolean {
  const tc = squareToCoords(target)
  if (!tc) return false
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const p = board[row]![col]
      const pr = parsePiece(p)
      if (!pr || pr.color !== byColor) continue
      const from: Coords = { row, col }
      if (pr.type === 'P') {
        const dir = byColor === 'w' ? -1 : 1
        for (const dc of [-1, 1]) {
          const cap = add(from, dir, dc)
          if (isInside(cap) && coordsToSquare(cap) === target) return true
        }
        continue
      }
      const sq = coordsToSquare(from)
      const moves = pseudoLegalMovesFrom(board, sq, null, {
        wK: true,
        wQ: true,
        bK: true,
        bQ: true,
      })
      if (moves.includes(target)) return true
    }
  }
  return false
}

function kingInCheckAfterMove(
  board: (Piece | null)[][],
  from: Square,
  to: Square,
  color: Color,
  enPassantTarget: Square | null,
): boolean {
  const nb = cloneBoard(board)
  const fc = squareToCoords(from)!
  const tc = squareToCoords(to)!
  const moving = nb[fc.row]![fc.col]
  const captured = nb[tc.row]![tc.col]
  const pr = parsePiece(moving)
  if (!pr) return true

  if (pr.type === 'P' && to === enPassantTarget && !captured) {
    const epRow = color === 'w' ? tc.row + 1 : tc.row - 1
    nb[epRow]![tc.col] = null
  }

  if (pr.type === 'K' && Math.abs(fc.col - tc.col) === 2) {
    if (tc.col === 6) {
      nb[fc.row]![5] = nb[fc.row]![7]
      nb[fc.row]![7] = null
    } else if (tc.col === 2) {
      nb[fc.row]![3] = nb[fc.row]![0]
      nb[fc.row]![0] = null
    }
  }

  let promoted: Piece | null = moving
  if (pr.type === 'P' && (tc.row === 0 || tc.row === 7)) {
    promoted = `${color}Q` as Piece
  }

  nb[tc.row]![tc.col] = promoted
  nb[fc.row]![fc.col] = null

  const kingSq = findKing(nb, color)
  if (!kingSq) return true
  return isSquareAttacked(nb, kingSq, color === 'w' ? 'b' : 'w')
}

/** Castling: king cannot pass through attacked squares */
function filterCastling(
  board: (Piece | null)[][],
  fromSq: Square,
  moves: Square[],
  color: Color,
  enPassantTarget: Square | null,
): Square[] {
  const from = squareToCoords(fromSq)!
  const pr = parsePiece(board[from.row]![from.col])
  if (pr?.type !== 'K') return moves
  const out: Square[] = []
  for (const to of moves) {
    const fc = squareToCoords(fromSq)!
    const tc = squareToCoords(to)!
    if (Math.abs(fc.col - tc.col) === 2) {
      const step = tc.col > fc.col ? 1 : -1
      let col = fc.col
      let pass = true
      while (col !== tc.col) {
        const sq = coordsToSquare({ row: fc.row, col })
        if (kingInCheckAfterMove(board, fromSq, sq, color, enPassantTarget)) {
          pass = false
          break
        }
        col += step
      }
      if (pass) out.push(to)
    } else {
      out.push(to)
    }
  }
  return out
}

export function getLegalMoves(
  board: (Piece | null)[][],
  square: Square,
  castlingRights: GameState['castlingRights'],
  enPassantTarget: Square | null,
): Square[] {
  const piece = getAt(board, square)
  const pr = parsePiece(piece)
  if (!pr) return []
  let moves = pseudoLegalMovesFrom(board, square, enPassantTarget, castlingRights)
  moves = filterCastling(board, square, moves, pr.color, enPassantTarget)
  moves = moves.filter((to) => !kingInCheckAfterMove(board, square, to, pr.color, enPassantTarget))
  return moves
}

export function isInCheck(board: (Piece | null)[][], color: Color): boolean {
  const kingSq = findKing(board, color)
  if (!kingSq) return false
  return isSquareAttacked(board, kingSq, color === 'w' ? 'b' : 'w')
}

export function hasAnyLegal(
  board: (Piece | null)[][],
  color: Color,
  castlingRights: GameState['castlingRights'],
  enPassantTarget: Square | null,
): boolean {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const p = board[row]![col]
      const pr = parsePiece(p)
      if (!pr || pr.color !== color) continue
      const sq = coordsToSquare({ row, col })
      const m = getLegalMoves(board, sq, castlingRights, enPassantTarget)
      if (m.length > 0) return true
    }
  }
  return false
}

function updateCastlingRights(
  rights: GameState['castlingRights'],
  from: Square,
  to: Square,
  moved: Piece | null,
  captured: Piece | null,
): GameState['castlingRights'] {
  const r = { ...rights }
  const mf = parsePiece(moved)
  if (from === 'e1') {
    r.wK = false
    r.wQ = false
  }
  if (from === 'e8') {
    r.bK = false
    r.bQ = false
  }
  if (from === 'a1' || to === 'a1') r.wQ = false
  if (from === 'h1' || to === 'h1') r.wK = false
  if (from === 'a8' || to === 'a8') r.bQ = false
  if (from === 'h8' || to === 'h8') r.bK = false
  if (mf?.type === 'K' && mf.color === 'w' && from !== 'e1') {
    /* already cleared */
  }
  void captured
  return r
}

function computeEnPassant(from: Coords, to: Coords, piece: Piece | null): Square | null {
  const pr = parsePiece(piece)
  if (pr?.type !== 'P') return null
  if (Math.abs(to.row - from.row) === 2) {
    const midRow = (from.row + to.row) >> 1
    return coordsToSquare({ row: midRow, col: from.col })
  }
  return null
}

export function applyMove(state: GameState, from: Square, to: Square): GameState {
  const board = cloneBoard(state.board)
  const fc = squareToCoords(from)
  const tc = squareToCoords(to)
  if (!fc || !tc) return state
  const moving = board[fc.row]![fc.col]
  const pr = parsePiece(moving)
  if (!pr) return state

  const captured = board[tc.row]![tc.col]
  const nextCaptured = {
    w: [...state.capturedBy.w],
    b: [...state.capturedBy.b],
  }

  if (pr.type === 'P' && to === state.enPassantTarget && !captured) {
    const epRow = pr.color === 'w' ? tc.row + 1 : tc.row - 1
    const capP = board[epRow]![tc.col]
    board[epRow]![tc.col] = null
    const ct = parsePiece(capP)
    if (ct && ct.type !== 'K') {
      nextCaptured[pr.color].push(ct.type)
    }
  } else if (captured) {
    const ct = parsePiece(captured)
    if (ct && ct.type !== 'K') {
      nextCaptured[pr.color].push(ct.type)
    }
  }

  if (pr.type === 'K' && Math.abs(fc.col - tc.col) === 2) {
    if (tc.col === 6) {
      board[fc.row]![5] = board[fc.row]![7]
      board[fc.row]![7] = null
    } else if (tc.col === 2) {
      board[fc.row]![3] = board[fc.row]![0]
      board[fc.row]![0] = null
    }
  }

  let placed: Piece | null = moving
  if (pr.type === 'P' && (tc.row === 0 || tc.row === 7)) {
    placed = `${pr.color}Q` as Piece
  }

  board[tc.row]![tc.col] = placed
  board[fc.row]![fc.col] = null

  const newEp = computeEnPassant(fc, tc, moving)
  const newRights = updateCastlingRights(state.castlingRights, from, to, moving, captured)
  const nextTurn: Color = pr.color === 'w' ? 'b' : 'w'

  let checkStatus: GameState['checkStatus'] = ''
  if (isInCheck(board, nextTurn)) {
    checkStatus = hasAnyLegal(board, nextTurn, newRights, newEp) ? 'CHECK' : 'CHECKMATE'
  } else if (!hasAnyLegal(board, nextTurn, newRights, newEp)) {
    checkStatus = 'STALEMATE'
  }

  const gameOver = checkStatus === 'CHECKMATE' || checkStatus === 'STALEMATE'

  return {
    ...state,
    board,
    turn: nextTurn,
    enPassantTarget: newEp,
    castlingRights: newRights,
    capturedBy: nextCaptured,
    checkStatus,
    gameOver,
    players: {
      w: { ...state.players.w },
      b: { ...state.players.b },
    },
  }
}

export function createInitialBoard(): (Piece | null)[][] {
  const row = () => Array<Piece | null>(8).fill(null)
  const b: (Piece | null)[][] = Array.from({ length: 8 }, row)
  const back = (c: Color): Piece[] =>
    [`${c}R`, `${c}N`, `${c}B`, `${c}Q`, `${c}K`, `${c}B`, `${c}N`, `${c}R`] as Piece[]
  b[0] = back('b') as (Piece | null)[]
  b[1] = Array(8).fill('bP') as (Piece | null)[]
  b[6] = Array(8).fill('wP') as (Piece | null)[]
  b[7] = back('w') as (Piece | null)[]
  return b
}
