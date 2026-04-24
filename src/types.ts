export type Color = 'w' | 'b'
export type PieceType = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'
export type Piece = `${Color}${PieceType}`
export type Square = string

export interface PlayerInfo {
  id: string
  name: string
  elo: number
  connected: boolean
}

export interface GameState {
  board: (Piece | null)[][]
  turn: Color
  gold: { w: number; b: number }
  capturedBy: { w: PieceType[]; b: PieceType[] }
  frozenSquares: Record<Square, number>
  ghostPiece: { sq: Square; piece: Piece } | null
  usedItems: { w: Record<string, boolean>; b: Record<string, boolean> }
  checkStatus: '' | 'CHECK' | 'CHECKMATE' | 'STALEMATE'
  gameOver: boolean
  lastBoard: (Piece | null)[][] | null
  enPassantTarget: Square | null
  castlingRights: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean }
  players: { w: PlayerInfo; b: PlayerInfo }
  turnDeadline: number
  turnDurationMs: number
}

export interface MatchmakingEntry {
  playerId: string
  elo: number
  joinedAt: number
  wsClientId: string
}

export interface PlayerRecord {
  id: string
  name: string
  elo: number
}

/** Server-side game record (rematch / inspire buff not in client GameState contract) */
export interface GameMeta {
  rematchRequestedBy?: Color
  /** Square of piece that gets +5g on next capture */
  inspiredSquare?: Square | null
}

export interface StoredGame {
  state: GameState
  meta: GameMeta
}

export type WsIncomingGameMessage =
  | { type: 'auth'; playerId: string; gameId: string }
  | { type: 'move'; from: Square; to: Square }
  | { type: 'item'; itemKey: string; targetSquare?: Square }
  | { type: 'rematch_request' }
  | { type: 'rematch_response'; accept: boolean }
  | { type: 'ping' }

export type WsIncomingMatchmakingMessage =
  | { type: 'listen'; wsClientId: string }

export type WsOutgoingMessage =
  | { type: 'state_update'; state: GameState; eloChange?: { w: number; b: number } }
  | { type: 'error'; message: string }
  | { type: 'connected'; ok: true }
  | { type: 'pong' }
  | { type: 'match_found'; gameId: string; color: Color }
  | { type: 'rematch_requested' }
  | { type: 'rematch_accepted'; newGameId: string }
  | { type: 'rematch_declined' }
  | { type: 'opponent_disconnected' }
  | { type: 'opponent_reconnected' }
  | { type: 'forfeit_win'; reason: 'forfeit' | 'disconnect' }
  | { type: 'turn_timeout'; player: Color }
  | { type: 'connected'; ok: true }
