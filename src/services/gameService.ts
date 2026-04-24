import { randomUUID } from 'crypto'
import type { Color, GameState, PieceType, PlayerInfo, Square, StoredGame, WsOutgoingMessage } from '../types.js'
import { applyMove, createInitialBoard, getLegalMoves, hasAnyLegal, isInCheck, squareToCoords } from '../engine/chess.js'
import {
  CENTER_SQUARES,
  ITEM_DEFS,
  decrementFrozenSquares,
  incomeForPlayer,
  isFromFrozen,
  isGhostProtectedCapture,
  parsePieceColor,
  parsePieceType,
  PIECE_VALUE,
} from '../engine/economy.js'
import { applyEloPair } from '../engine/elo.js'
import type { IGameStore } from '../store/gameStore.js'
import type { IPlayerStore } from '../store/playerStore.js'
import { TurnTimerManager } from '../timers/turnTimer.js'
import { DisconnectTimerManager } from '../timers/disconnectTimer.js'
import { broadcastToGame } from '../ws/wsClients.js'

function cloneBoard(board: (import('../types.js').Piece | null)[][]): (import('../types.js').Piece | null)[][] {
  return board.map((r) => [...r])
}

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

function pieceAt(board: GameState['board'], sq: Square): import('../types.js').Piece | null {
  const c = squareToCoords(sq)
  if (!c) return null
  return board[c.row]![c.col] ?? null
}

export type GameErrorCode =
  | 'not_found'
  | 'wrong_player'
  | 'bad_request'
  | 'turn_timeout'
  | 'illegal_move'
  | 'game_over'

export class GameServiceError extends Error {
  constructor(
    message: string,
    readonly code: GameErrorCode,
    readonly status: number,
  ) {
    super(message)
    this.name = 'GameServiceError'
  }
}

export class GameService {
  readonly turnTimers: TurnTimerManager
  readonly disconnectTimers: DisconnectTimerManager

  constructor(
    private readonly gameStore: IGameStore,
    private readonly playerStore: IPlayerStore,
  ) {
    this.turnTimers = new TurnTimerManager((gameId, turnWhenScheduled) => {
      this.onTurnTimerFire(gameId, turnWhenScheduled as Color)
    })
    this.disconnectTimers = new DisconnectTimerManager((gameId, color) => {
      this.onDisconnectTimerFire(gameId, color)
    })
  }

  private broadcast(gameId: string, msg: WsOutgoingMessage): void {
    broadcastToGame(gameId, msg)
  }

  private scheduleTurnTimer(gameId: string, state: GameState): void {
    if (state.gameOver) {
      this.turnTimers.clear(gameId)
      return
    }
    const remaining = Math.max(0, state.turnDeadline - Date.now())
    this.turnTimers.schedule(gameId, remaining, state.turn)
  }

  private load(gameId: string): StoredGame {
    const g = this.gameStore.get(gameId)
    if (!g) throw new GameServiceError('Game not found', 'not_found', 404)
    return g
  }

  private save(gameId: string, stored: StoredGame): void {
    this.gameStore.save(gameId, stored)
  }

  getStored(gameId: string): StoredGame | undefined {
    return this.gameStore.get(gameId)
  }

  getState(gameId: string): GameState {
    return this.load(gameId).state
  }

  createGame(playerWId: string, playerBId: string): { gameId: string; state: GameState } {
    const pw = this.playerStore.get(playerWId)
    const pb = this.playerStore.get(playerBId)
    if (!pw || !pb) throw new GameServiceError('Unknown player', 'not_found', 404)

    const gameId = randomUUID()
    const now = Date.now()
    const duration = 60_000

    const mkInfo = (p: { id: string; name: string; elo: number }): PlayerInfo => ({
      id: p.id,
      name: p.name,
      elo: p.elo,
      connected: false,
    })

    const state: GameState = {
      board: createInitialBoard(),
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
      players: { w: mkInfo(pw), b: mkInfo(pb) },
      turnDeadline: now + duration,
      turnDurationMs: duration,
    }

    const stored: StoredGame = { state, meta: {} }
    this.save(gameId, stored)
    this.scheduleTurnTimer(gameId, state)
    return { gameId, state }
  }

  colorForPlayer(state: GameState, playerId: string): Color | undefined {
    if (state.players.w.id === playerId) return 'w'
    if (state.players.b.id === playerId) return 'b'
    return undefined
  }

  legalMovesFor(gameId: string, playerId: string, square: Square): Square[] {
    const { state } = this.load(gameId)
    const color = this.colorForPlayer(state, playerId)
    if (!color) throw new GameServiceError('Not a player in this game', 'wrong_player', 403)
    if (state.gameOver) throw new GameServiceError('Game over', 'bad_request', 400)
    if (state.turn !== color) throw new GameServiceError('Not your turn', 'bad_request', 400)
    const piece = pieceAt(state.board, square)
    if (!piece || parsePieceColor(piece) !== color) {
      throw new GameServiceError('No own piece on square', 'bad_request', 400)
    }
    let moves = getLegalMoves(state.board, square, state.castlingRights, state.enPassantTarget)
    moves = moves.filter((to) => !isGhostProtectedCapture(state, square, to, color))
    if (isFromFrozen(state, square)) return []
    return moves
  }

  private finalizeEconomyAfterMove(
    prev: GameState,
    next: GameState,
    from: Square,
    to: Square,
    mover: Color,
    meta: import('../types.js').GameMeta,
  ): { state: GameState; meta: import('../types.js').GameMeta } {
    const capturedType = this.detectCapture(prev, from, to)
    let goldGain = 0
    if (capturedType) {
      goldGain += PIECE_VALUE[capturedType] * 2
    }
    if (CENTER_SQUARES.has(to)) goldGain += 1
    const opp = mover === 'w' ? 'b' : 'w'
    if (isInCheck(next.board, opp)) goldGain += 3

    let inspiredSquare = meta.inspiredSquare ?? null
    if (inspiredSquare === from && capturedType) {
      goldGain += 5
      inspiredSquare = null
    }

    const income = incomeForPlayer(next.board, next.turn)
    const gold = { ...next.gold }
    gold[mover] += goldGain
    gold[next.turn] += income

    let ghostPiece = next.ghostPiece
    if (ghostPiece && (from === ghostPiece.sq || to === ghostPiece.sq)) {
      ghostPiece = null
    }

    const frozenSquares = decrementFrozenSquares(next.frozenSquares)
    const turnDeadline = Date.now() + next.turnDurationMs

    const state: GameState = {
      ...next,
      gold,
      frozenSquares,
      ghostPiece,
      lastBoard: cloneBoard(prev.board),
      turnDeadline,
    }

    return { state, meta: { ...meta, inspiredSquare: inspiredSquare ?? undefined } }
  }

  private detectCapture(prev: GameState, from: Square, to: Square): PieceType | null {
    const dest = pieceAt(prev.board, to)
    if (dest && parsePieceColor(dest) !== prev.turn) {
      return parsePieceType(dest)
    }
    if (prev.enPassantTarget === to && pieceAt(prev.board, from)?.[1] === 'P') {
      return 'P'
    }
    return null
  }

  applyMoveByPlayer(gameId: string, playerId: string, from: Square, to: Square): GameState {
    const stored = this.load(gameId)
    let { state, meta } = stored
    const color = this.colorForPlayer(state, playerId)
    if (!color) throw new GameServiceError('Not a player in this game', 'wrong_player', 403)
    if (state.gameOver) throw new GameServiceError('Game over', 'bad_request', 400)
    if (state.turn !== color) throw new GameServiceError('Not your turn', 'bad_request', 400)
    if (Date.now() > state.turnDeadline) {
      throw new GameServiceError('Turn expired', 'turn_timeout', 400)
    }
    if (isFromFrozen(state, from)) {
      throw new GameServiceError('Piece is frozen', 'bad_request', 400)
    }
    if (isGhostProtectedCapture(state, from, to, color)) {
      throw new GameServiceError('Ghost protection', 'bad_request', 400)
    }

    const legal = getLegalMoves(state.board, from, state.castlingRights, state.enPassantTarget).filter(
      (sq) => !isGhostProtectedCapture(state, from, sq, color),
    )
    if (!legal.includes(to)) {
      throw new GameServiceError('Illegal move', 'illegal_move', 400)
    }

    const mover = state.turn
    const chessOut = applyMove(state, from, to)
    const { state: afterEcon, meta: meta2 } = this.finalizeEconomyAfterMove(state, chessOut, from, to, mover, meta)

    let finalState = afterEcon
    let eloChange: { w: number; b: number } | undefined
    if (finalState.checkStatus === 'CHECKMATE') {
      const winner: Color = finalState.turn === 'w' ? 'b' : 'w'
      const eloWBefore = finalState.players.w.elo
      const eloBBefore = finalState.players.b.elo
      finalState = this.endGameWithElo({ ...finalState, gameOver: false }, winner)
      eloChange = {
        w: finalState.players.w.elo - eloWBefore,
        b: finalState.players.b.elo - eloBBefore,
      }
    } else if (finalState.checkStatus === 'STALEMATE') {
      const eloWBefore = finalState.players.w.elo
      const eloBBefore = finalState.players.b.elo
      finalState = this.endGameWithElo({ ...finalState, gameOver: false }, 'draw')
      eloChange = {
        w: finalState.players.w.elo - eloWBefore,
        b: finalState.players.b.elo - eloBBefore,
      }
    }

    this.turnTimers.clear(gameId)
    this.save(gameId, { state: finalState, meta: meta2 })
    this.broadcastState(gameId, finalState, eloChange)
    if (!finalState.gameOver) this.scheduleTurnTimer(gameId, finalState)
    else this.cleanupTimers(gameId)
    return finalState
  }

  private endGameWithElo(state: GameState, outcome: 'w' | 'b' | 'draw'): GameState {
    const w = this.playerStore.get(state.players.w.id)
    const b = this.playerStore.get(state.players.b.id)
    if (!w || !b) return { ...state, gameOver: true }

    const { newW, newB } = applyEloPair(w.elo, b.elo, outcome)
    this.playerStore.updateElo(w.id, newW)
    this.playerStore.updateElo(b.id, newB)

    const players = {
      w: { ...state.players.w, elo: newW },
      b: { ...state.players.b, elo: newB },
    }
    return { ...state, players, gameOver: true }
  }

  private broadcastState(gameId: string, state: GameState, eloChange?: { w: number; b: number }): void {
    const msg: WsOutgoingMessage = eloChange
      ? { type: 'state_update', state, eloChange }
      : { type: 'state_update', state }
    this.broadcast(gameId, msg)
  }

  private cleanupTimers(gameId: string): void {
    this.turnTimers.clear(gameId)
    this.disconnectTimers.clearGame(gameId)
  }

  private onTurnTimerFire(gameId: string, expectedTurn: Color): void {
    const stored = this.gameStore.get(gameId)
    if (!stored || stored.state.gameOver) return
    if (stored.state.turn !== expectedTurn) return

    const loser = expectedTurn
    const winner: Color = loser === 'w' ? 'b' : 'w'
    const eloWBefore = stored.state.players.w.elo
    const eloBBefore = stored.state.players.b.elo
    const finalState = this.endGameWithElo({ ...stored.state, gameOver: false }, winner)
    const patched: GameState = { ...finalState, checkStatus: '' }
    this.save(gameId, { state: patched, meta: stored.meta })
    this.broadcast(gameId, { type: 'turn_timeout', player: loser })
    this.broadcastState(gameId, patched, {
      w: patched.players.w.elo - eloWBefore,
      b: patched.players.b.elo - eloBBefore,
    })
    this.cleanupTimers(gameId)
  }

  private onDisconnectTimerFire(gameId: string, color: Color): void {
    const stored = this.gameStore.get(gameId)
    if (!stored || stored.state.gameOver) return
    const winner: Color = color === 'w' ? 'b' : 'w'
    const eloWBefore = stored.state.players.w.elo
    const eloBBefore = stored.state.players.b.elo
    const finalState = this.endGameWithElo({ ...stored.state, gameOver: false }, winner)
    const patched: GameState = { ...finalState, checkStatus: '' }
    this.save(gameId, { state: patched, meta: stored.meta })
    this.broadcast(gameId, { type: 'forfeit_win', reason: 'disconnect' })
    this.broadcastState(gameId, patched, {
      w: patched.players.w.elo - eloWBefore,
      b: patched.players.b.elo - eloBBefore,
    })
    this.cleanupTimers(gameId)
  }

  /** Player connected via WS — updates flag and schedules/clears disconnect. */
  onPlayerConnected(gameId: string, playerId: string): GameState {
    const stored = this.load(gameId)
    const c = this.colorForPlayer(stored.state, playerId)
    if (!c) throw new GameServiceError('Not a player', 'wrong_player', 403)
    const state: GameState = {
      ...stored.state,
      players: {
        ...stored.state.players,
        [c]: { ...stored.state.players[c], connected: true },
      },
    }
    const hadDisconnectTimer = this.disconnectTimers.clear(gameId, c)
    this.save(gameId, { ...stored, state })
    if (hadDisconnectTimer) {
      this.broadcast(gameId, { type: 'opponent_reconnected' })
    }
    this.broadcastState(gameId, state)
    return state
  }

  onPlayerDisconnected(gameId: string, playerId: string): void {
    const stored = this.load(gameId)
    const c = this.colorForPlayer(stored.state, playerId)
    if (!c) return
    const state: GameState = {
      ...stored.state,
      players: {
        ...stored.state.players,
        [c]: { ...stored.state.players[c], connected: false },
      },
    }
    this.save(gameId, { ...stored, state })
    this.broadcast(gameId, { type: 'opponent_disconnected' })
    this.broadcastState(gameId, state)
    if (!state.gameOver) {
      this.disconnectTimers.schedule(gameId, c, 30_000)
    }
  }

  forfeit(gameId: string, playerId: string): GameState {
    const stored = this.load(gameId)
    if (stored.state.gameOver) throw new GameServiceError('Game over', 'bad_request', 400)
    const c = this.colorForPlayer(stored.state, playerId)
    if (!c) throw new GameServiceError('Not a player', 'wrong_player', 403)
    const winner: Color = c === 'w' ? 'b' : 'w'
    const eloWBefore = stored.state.players.w.elo
    const eloBBefore = stored.state.players.b.elo
    const next = this.endGameWithElo(stored.state, winner)
    const finalState: GameState = { ...next, checkStatus: '' }
    this.save(gameId, { state: finalState, meta: stored.meta })
    this.broadcast(gameId, { type: 'forfeit_win', reason: 'forfeit' })
    this.broadcastState(gameId, finalState, {
      w: finalState.players.w.elo - eloWBefore,
      b: finalState.players.b.elo - eloBBefore,
    })
    this.cleanupTimers(gameId)
    return finalState
  }

  /** First request: no pending rematch. Optional `accept` ignored. */
  rematchRequest(gameId: string, playerId: string): void {
    const stored = this.load(gameId)
    const c = this.colorForPlayer(stored.state, playerId)
    if (!c) throw new GameServiceError('Not a player', 'wrong_player', 403)
    if (stored.meta.rematchRequestedBy !== undefined) {
      throw new GameServiceError('Rematch already pending', 'bad_request', 400)
    }
    this.save(gameId, { ...stored, meta: { ...stored.meta, rematchRequestedBy: c } })
    this.broadcast(gameId, { type: 'rematch_requested' })
  }

  /** Opponent responds to pending rematch. */
  rematchRespond(gameId: string, playerId: string, accept: boolean): { newGameId?: string } {
    const stored = this.load(gameId)
    const c = this.colorForPlayer(stored.state, playerId)
    if (!c) throw new GameServiceError('Not a player', 'wrong_player', 403)
    const reqBy = stored.meta.rematchRequestedBy
    if (reqBy === undefined) {
      throw new GameServiceError('No rematch request', 'bad_request', 400)
    }
    if (reqBy === c) {
      throw new GameServiceError('Cannot respond to own request', 'bad_request', 400)
    }
    if (!accept) {
      this.save(gameId, { ...stored, meta: { ...stored.meta, rematchRequestedBy: undefined } })
      this.broadcast(gameId, { type: 'rematch_declined' })
      return {}
    }
    const created = this.createGame(stored.state.players.b.id, stored.state.players.w.id)
    this.save(gameId, { ...stored, meta: { ...stored.meta, rematchRequestedBy: undefined } })
    this.broadcast(gameId, { type: 'rematch_accepted', newGameId: created.gameId })
    return { newGameId: created.gameId }
  }

  /** REST: first call without pending acts as request; with pending from opponent, acts as response. */
  rematchRest(gameId: string, playerId: string, accept?: boolean): { ok: true; newGameId?: string; status?: string } {
    const stored = this.load(gameId)
    const c = this.colorForPlayer(stored.state, playerId)
    if (!c) throw new GameServiceError('Not a player', 'wrong_player', 403)
    const reqBy = stored.meta.rematchRequestedBy
    if (reqBy === undefined) {
      this.rematchRequest(gameId, playerId)
      return { ok: true, status: 'requested' }
    }
    if (reqBy === c) {
      return { ok: true, status: 'pending' }
    }
    if (accept === undefined) {
      throw new GameServiceError('accept required', 'bad_request', 400)
    }
    const { newGameId } = this.rematchRespond(gameId, playerId, accept)
    return { ok: true, newGameId }
  }

  useItem(gameId: string, playerId: string, itemKey: string, targetSquare?: Square): GameState {
    const def = ITEM_DEFS[itemKey]
    if (!def) throw new GameServiceError('Unknown item', 'bad_request', 400)

    const stored = this.load(gameId)
    let { state, meta } = stored
    const color = this.colorForPlayer(state, playerId)
    if (!color) throw new GameServiceError('Not a player', 'wrong_player', 403)
    if (state.gameOver) throw new GameServiceError('Game over', 'bad_request', 400)
    if (state.turn !== color) {
      throw new GameServiceError('Not your turn', 'bad_request', 400)
    }
    if (Date.now() > state.turnDeadline) {
      throw new GameServiceError('Turn expired', 'turn_timeout', 400)
    }
    if (def.once && state.usedItems[color][itemKey]) {
      throw new GameServiceError('Item already used', 'bad_request', 400)
    }
    if (state.gold[color] < def.cost) {
      throw new GameServiceError('Insufficient gold', 'bad_request', 400)
    }

    let nextState = deepClone(state)
    const nextMeta = { ...meta }
    nextState.gold = { ...nextState.gold, [color]: nextState.gold[color] - def.cost }

    const usedItems = {
      w: { ...nextState.usedItems.w },
      b: { ...nextState.usedItems.b },
    }
    if (def.once) usedItems[color][itemKey] = true
    nextState.usedItems = usedItems

    switch (itemKey) {
      case 'inspire': {
        if (!targetSquare) throw new GameServiceError('targetSquare required', 'bad_request', 400)
        const p = pieceAt(nextState.board, targetSquare)
        if (!p || parsePieceColor(p) !== color) {
          throw new GameServiceError('Invalid target', 'bad_request', 400)
        }
        nextMeta.inspiredSquare = targetSquare
        break
      }
      case 'promote': {
        if (!targetSquare) throw new GameServiceError('targetSquare required', 'bad_request', 400)
        const p = pieceAt(nextState.board, targetSquare)
        if (!p || p[1] !== 'P' || parsePieceColor(p) !== color) {
          throw new GameServiceError('Invalid promote target', 'bad_request', 400)
        }
        const c = squareToCoords(targetSquare)!
        const okRank = color === 'w' ? c.row === 1 : c.row === 6
        if (!okRank) throw new GameServiceError('Pawn not on promotion rank', 'bad_request', 400)
        nextState.board[c.row]![c.col] = `${color}Q` as import('../types.js').Piece
        break
      }
      case 'recall': {
        if (!targetSquare) throw new GameServiceError('targetSquare required', 'bad_request', 400)
        if (pieceAt(nextState.board, targetSquare)) {
          throw new GameServiceError('Target not empty', 'bad_request', 400)
        }
        if ((nextState.frozenSquares[targetSquare] ?? 0) > 0) {
          throw new GameServiceError('Square frozen', 'bad_request', 400)
        }
        const arr = nextState.capturedBy[color]
        if (arr.length === 0) throw new GameServiceError('Nothing to recall', 'bad_request', 400)
        const typ = arr.shift()!
        nextState.board = cloneBoard(nextState.board)
        const cc = squareToCoords(targetSquare)!
        nextState.board[cc.row]![cc.col] = `${color}${typ}` as import('../types.js').Piece
        break
      }
      case 'ghost': {
        if (!targetSquare) throw new GameServiceError('targetSquare required', 'bad_request', 400)
        const p = pieceAt(nextState.board, targetSquare)
        if (!p || parsePieceColor(p) !== color) {
          throw new GameServiceError('Invalid ghost target', 'bad_request', 400)
        }
        nextState.ghostPiece = { sq: targetSquare, piece: p }
        break
      }
      case 'sabotage': {
        const squares: Square[] = []
        for (let row = 0; row < 8; row++) {
          for (let col = 0; col < 8; col++) {
            const sq = `${'abcdefgh'[col]}${8 - row}` as Square
            const pc = nextState.board[row]![col]
            if (pc && parsePieceColor(pc) !== color) squares.push(sq)
          }
        }
        if (squares.length === 0) throw new GameServiceError('No target', 'bad_request', 400)
        const pick = squares[Math.floor(Math.random() * squares.length)]!
        nextState.frozenSquares = { ...nextState.frozenSquares, [pick]: (nextState.frozenSquares[pick] ?? 0) + 2 }
        break
      }
      case 'reinforce': {
        if (!targetSquare) throw new GameServiceError('targetSquare required', 'bad_request', 400)
        if (pieceAt(nextState.board, targetSquare)) {
          throw new GameServiceError('Target not empty', 'bad_request', 400)
        }
        const cc = squareToCoords(targetSquare)!
        const ok = color === 'w' ? cc.row === 6 : cc.row === 1
        if (!ok) throw new GameServiceError('Invalid reinforce rank', 'bad_request', 400)
        nextState.board = cloneBoard(nextState.board)
        nextState.board[cc.row]![cc.col] = `${color}P` as import('../types.js').Piece
        break
      }
      default:
        throw new GameServiceError('Unknown item', 'bad_request', 400)
    }

    let eloChange: { w: number; b: number } | undefined
    if (def.endsTurn) {
      nextState.frozenSquares = decrementFrozenSquares(nextState.frozenSquares)
      const income = incomeForPlayer(nextState.board, color === 'w' ? 'b' : 'w')
      const opp = color === 'w' ? 'b' : 'w'
      nextState.gold = { ...nextState.gold, [opp]: nextState.gold[opp] + income }
      nextState.turn = opp
      nextState.turnDeadline = Date.now() + nextState.turnDurationMs
      nextState = {
        ...nextState,
        checkStatus: '',
        enPassantTarget: null,
      }
      if (isInCheck(nextState.board, nextState.turn)) {
        nextState.checkStatus = hasAnyLegal(
          nextState.board,
          nextState.turn,
          nextState.castlingRights,
          nextState.enPassantTarget,
        )
          ? 'CHECK'
          : 'CHECKMATE'
      } else if (!hasAnyLegal(nextState.board, nextState.turn, nextState.castlingRights, nextState.enPassantTarget)) {
        nextState.checkStatus = 'STALEMATE'
      }
      if (nextState.checkStatus === 'CHECKMATE' || nextState.checkStatus === 'STALEMATE') {
        const eloWBefore = nextState.players.w.elo
        const eloBBefore = nextState.players.b.elo
        if (nextState.checkStatus === 'CHECKMATE') {
          const winner: Color = nextState.turn === 'w' ? 'b' : 'w'
          nextState = this.endGameWithElo({ ...nextState, gameOver: false }, winner)
        } else {
          nextState = this.endGameWithElo({ ...nextState, gameOver: false }, 'draw')
        }
        eloChange = {
          w: nextState.players.w.elo - eloWBefore,
          b: nextState.players.b.elo - eloBBefore,
        }
      }
    }

    if (def.endsTurn || nextState.gameOver) {
      this.turnTimers.clear(gameId)
    }
    this.save(gameId, { state: nextState, meta: nextMeta })
    this.broadcastState(gameId, nextState, eloChange)
    if (nextState.gameOver) {
      this.cleanupTimers(gameId)
    } else if (def.endsTurn) {
      this.scheduleTurnTimer(gameId, nextState)
    }
    return nextState
  }
}

