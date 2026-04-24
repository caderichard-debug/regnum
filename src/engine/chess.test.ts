import assert from 'node:assert'
import { describe, it } from 'node:test'
import {
  applyMove,
  createInitialBoard,
  getLegalMoves,
  isInCheck,
  squareToCoords,
  coordsToSquare,
} from './chess.js'
import type { GameState } from '../types.js'

function baseState(over: Partial<GameState> = {}): GameState {
  const board = createInitialBoard()
  return {
    board,
    turn: 'w',
    gold: { w: 20, b: 20 },
    capturedBy: { w: [], b: [] },
    frozenSquares: {},
    ghostPiece: null,
    usedItems: { w: {}, b: {} },
    checkStatus: '',
    gameOver: false,
    lastBoard: null,
    enPassantTarget: null,
    castlingRights: { wK: true, wQ: true, bK: true, bQ: true },
    players: {
      w: { id: 'w1', name: 'W', elo: 1000, connected: true },
      b: { id: 'b1', name: 'B', elo: 1000, connected: true },
    },
    turnDeadline: Date.now() + 60_000,
    turnDurationMs: 60_000,
    ...over,
  }
}

describe('chess coords', () => {
  it('maps a8 and h1', () => {
    assert.deepStrictEqual(squareToCoords('a8'), { row: 0, col: 0 })
    assert.deepStrictEqual(squareToCoords('h1'), { row: 7, col: 7 })
    assert.strictEqual(coordsToSquare({ row: 7, col: 4 }), 'e1')
  })
})

describe('getLegalMoves opening', () => {
  it('e2 pawn has two forward moves', () => {
    const b = createInitialBoard()
    const m = getLegalMoves(b, 'e2', { wK: true, wQ: true, bK: true, bQ: true }, null)
    assert.deepStrictEqual(new Set(m), new Set(['e3', 'e4']))
  })

  it('initial position white not in check', () => {
    assert.strictEqual(isInCheck(createInitialBoard(), 'w'), false)
  })
})

describe('applyMove', () => {
  it('plays e4', () => {
    const s0 = baseState()
    const s1 = applyMove(s0, 'e2', 'e4')
    assert.strictEqual(s1.board[4]![4], 'wP')
    assert.strictEqual(s1.board[6]![4], null)
    assert.strictEqual(s1.turn, 'b')
    assert.strictEqual(s1.enPassantTarget, 'e3')
  })
})
