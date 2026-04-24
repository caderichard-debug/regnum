import type { Color, GameState, LedgerEntry, Piece, PieceType, PlayerInfo, Square } from "./types";

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

export function sqToRC(sq: Square): [number, number] {
  const f = sq.charCodeAt(0) - 97;
  const r = 8 - parseInt(sq[1], 10);
  return [r, f];
}
export function rcToSq(r: number, c: number): Square {
  return `${FILES[c]}${8 - r}`;
}
export function inBounds(r: number, c: number) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}
export function colorOf(p: Piece | null): Color | null {
  return p ? (p[0] as Color) : null;
}
export function typeOf(p: Piece | null): PieceType | null {
  return p ? (p[1] as PieceType) : null;
}
export const opp = (c: Color): Color => (c === "w" ? "b" : "w");

export function startingBoard(): (Piece | null)[][] {
  const back: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  const board: (Piece | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = `b${back[c]}` as Piece;
    board[1][c] = "bP";
    board[6][c] = "wP";
    board[7][c] = `w${back[c]}` as Piece;
  }
  return board;
}

export function newGameState(white: PlayerInfo, black: PlayerInfo, turnSeconds = 60): GameState {
  return {
    board: startingBoard(),
    turn: "w",
    gold: { w: 0, b: 0 },
    capturedBy: { w: [], b: [] },
    frozenSquares: {},
    ghostPiece: null,
    usedItems: { w: {}, b: {} },
    checkStatus: "",
    gameOver: false,
    lastBoard: null,
    enPassantTarget: null,
    castlingRights: { wK: true, wQ: true, bK: true, bQ: true },
    turnTimeRemaining: turnSeconds,
    players: { w: white, b: black },
    moveCount: 0,
    ledger: [{ id: crypto.randomUUID(), kind: "system", text: "The game begins.", turn: 0 }],
    winner: null,
  };
}

// ---- Move generation ----

const DIRS = {
  rook: [[-1, 0], [1, 0], [0, -1], [0, 1]],
  bishop: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  knight: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
  king: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
};

function rayMoves(board: (Piece | null)[][], r: number, c: number, color: Color, dirs: number[][]): Square[] {
  const out: Square[] = [];
  for (const [dr, dc] of dirs) {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const t = board[nr][nc];
      if (!t) out.push(rcToSq(nr, nc));
      else { if (colorOf(t) !== color) out.push(rcToSq(nr, nc)); break; }
      nr += dr; nc += dc;
    }
  }
  return out;
}

export function pseudoMoves(state: GameState, sq: Square, attacksOnly = false): Square[] {
  const [r, c] = sqToRC(sq);
  const piece = state.board[r][c];
  if (!piece) return [];
  const color = colorOf(piece)!;
  const t = typeOf(piece)!;
  const out: Square[] = [];
  const b = state.board;

  if (t === "P") {
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    if (inBounds(r + dir, c) && !b[r + dir][c]) {
      out.push(rcToSq(r + dir, c));
      if (r === startRow && !b[r + 2 * dir][c]) out.push(rcToSq(r + 2 * dir, c));
    }
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const tgt = b[nr][nc];
      if (tgt && colorOf(tgt) !== color) out.push(rcToSq(nr, nc));
      // en passant
      if (state.enPassantTarget && rcToSq(nr, nc) === state.enPassantTarget) out.push(rcToSq(nr, nc));
    }
  } else if (t === "N") {
    for (const [dr, dc] of DIRS.knight) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const tgt = b[nr][nc];
      if (!tgt || colorOf(tgt) !== color) out.push(rcToSq(nr, nc));
    }
  } else if (t === "B") out.push(...rayMoves(b, r, c, color, DIRS.bishop));
  else if (t === "R") out.push(...rayMoves(b, r, c, color, DIRS.rook));
  else if (t === "Q") out.push(...rayMoves(b, r, c, color, [...DIRS.rook, ...DIRS.bishop]));
  else if (t === "K") {
    for (const [dr, dc] of DIRS.king) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const tgt = b[nr][nc];
      if (!tgt || colorOf(tgt) !== color) out.push(rcToSq(nr, nc));
    }
    // castling — skip when only collecting attack squares (avoids recursion via inCheck/squareAttacked)
    if (!attacksOnly) {
      const row = color === "w" ? 7 : 0;
      if (r === row && c === 4 && !inCheck(state, color)) {
        const rights = state.castlingRights;
        const canK = color === "w" ? rights.wK : rights.bK;
        const canQ = color === "w" ? rights.wQ : rights.bQ;
        if (canK && !b[row][5] && !b[row][6] && b[row][7] === `${color}R`) {
          if (!squareAttacked(state, rcToSq(row, 5), opp(color)) && !squareAttacked(state, rcToSq(row, 6), opp(color)))
            out.push(rcToSq(row, 6));
        }
        if (canQ && !b[row][1] && !b[row][2] && !b[row][3] && b[row][0] === `${color}R`) {
          if (!squareAttacked(state, rcToSq(row, 3), opp(color)) && !squareAttacked(state, rcToSq(row, 2), opp(color)))
            out.push(rcToSq(row, 2));
        }
      }
    }
  }
  return out;
}

export function squareAttacked(state: GameState, sq: Square, by: Color): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || colorOf(p) !== by) continue;
      // For attacks, pawns attack diagonally regardless of empty target — handle separately
      if (typeOf(p) === "P") {
        const dir = by === "w" ? -1 : 1;
        for (const dc of [-1, 1]) {
          if (rcToSq(r + dir, c + dc) === sq && inBounds(r + dir, c + dc)) return true;
        }
        continue;
      }
      const moves = pseudoMoves({ ...state, turn: by }, rcToSq(r, c), true);
      if (moves.includes(sq)) return true;
    }
  }
  return false;
}

function findKing(board: (Piece | null)[][], color: Color): Square | null {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
    if (board[r][c] === `${color}K`) return rcToSq(r, c);
  return null;
}

export function inCheck(state: GameState, color: Color): boolean {
  const k = findKing(state.board, color);
  if (!k) return false;
  return squareAttacked(state, k, opp(color));
}

export function legalMoves(state: GameState, sq: Square): Square[] {
  const piece = state.board[sqToRC(sq)[0]][sqToRC(sq)[1]];
  if (!piece) return [];
  const color = colorOf(piece)!;
  if (state.frozenSquares[sq]) return [];
  return pseudoMoves(state, sq).filter((to) => {
    const next = applyMoveRaw(state, sq, to);
    // ghost protection
    if (state.ghostPiece && state.ghostPiece.sq === to) return false;
    return !inCheck(next, color);
  });
}

function applyMoveRaw(state: GameState, from: Square, to: Square): GameState {
  const next: GameState = {
    ...state,
    board: state.board.map((r) => r.slice()),
    castlingRights: { ...state.castlingRights },
  };
  const [fr, fc] = sqToRC(from);
  const [tr, tc] = sqToRC(to);
  const piece = next.board[fr][fc]!;
  const t = typeOf(piece)!;
  const color = colorOf(piece)!;

  // en passant capture
  if (t === "P" && to === state.enPassantTarget && !next.board[tr][tc]) {
    next.board[fr][tc] = null;
  }
  // castling
  if (t === "K" && Math.abs(tc - fc) === 2) {
    const row = tr;
    if (tc === 6) { next.board[row][5] = next.board[row][7]; next.board[row][7] = null; }
    else { next.board[row][3] = next.board[row][0]; next.board[row][0] = null; }
  }

  next.board[tr][tc] = piece;
  next.board[fr][fc] = null;

  // promotion (auto-queen)
  if (t === "P" && (tr === 0 || tr === 7)) {
    next.board[tr][tc] = `${color}Q` as Piece;
  }

  // update castling rights
  if (t === "K") {
    if (color === "w") { next.castlingRights.wK = false; next.castlingRights.wQ = false; }
    else { next.castlingRights.bK = false; next.castlingRights.bQ = false; }
  }
  if (t === "R") {
    if (from === "a1") next.castlingRights.wQ = false;
    if (from === "h1") next.castlingRights.wK = false;
    if (from === "a8") next.castlingRights.bQ = false;
    if (from === "h8") next.castlingRights.bK = false;
  }

  // en passant target
  next.enPassantTarget = null;
  if (t === "P" && Math.abs(tr - fr) === 2) {
    next.enPassantTarget = rcToSq((tr + fr) / 2, tc);
  }

  return next;
}

// Income calculation: aggression + positional play
// - Base income per turn: 2g
// - Capture bonus by piece value: P=2, N/B=4, R=6, Q=10
// - Check bonus: 3g
// - Center pawn bonus: 1g per pawn on d4/e4/d5/e5 owned
// - Develop bonus: 1g if a minor piece moved off back rank for first time (tracked via lastBoard)
const PIECE_VALUE: Record<PieceType, number> = { P: 2, N: 4, B: 4, R: 6, Q: 10, K: 0 };

export interface MoveResult {
  state: GameState;
  ledger: LedgerEntry[];
  goldEarned: number;
}

export function makeMove(state: GameState, from: Square, to: Square): MoveResult | null {
  if (state.gameOver) return null;
  const [fr, fc] = sqToRC(from);
  const piece = state.board[fr][fc];
  if (!piece || colorOf(piece) !== state.turn) return null;
  if (!legalMoves(state, from).includes(to)) return null;

  const mover = state.turn;
  const [tr, tc] = sqToRC(to);
  const captured = state.board[tr][tc];
  // en passant captured pawn
  let enPassantCaptured: Piece | null = null;
  if (typeOf(piece) === "P" && to === state.enPassantTarget && !captured) {
    enPassantCaptured = state.board[fr][tc];
  }

  const lastBoard = state.board.map((r) => r.slice());
  let next = applyMoveRaw(state, from, to);
  next.lastBoard = lastBoard;
  next.moveCount = (state.moveCount ?? 0) + 1;

  // captures tracking
  next.capturedBy = { w: [...state.capturedBy.w], b: [...state.capturedBy.b] };
  const ledger: LedgerEntry[] = [];
  let gold = 0;

  const turnNo = next.moveCount;
  ledger.push({ id: crypto.randomUUID(), kind: "move", text: `${mover === "w" ? "White" : "Black"}: ${from}→${to}`, turn: turnNo });

  if (captured || enPassantCaptured) {
    const cap = (captured ?? enPassantCaptured)!;
    const ct = typeOf(cap)!;
    next.capturedBy[mover].push(ct);
    const bonus = PIECE_VALUE[ct];
    gold += bonus;
    ledger.push({ id: crypto.randomUUID(), kind: "capture", text: `Captured ${pieceName(ct)} (+${bonus}g)`, turn: turnNo });
  }

  // base income
  gold += 2;

  // center pawn bonus
  const centers: Square[] = ["d4", "e4", "d5", "e5"];
  let centerCount = 0;
  for (const sq of centers) {
    const [r, c] = sqToRC(sq);
    if (next.board[r][c] === `${mover}P`) centerCount++;
  }
  if (centerCount > 0) {
    gold += centerCount;
    ledger.push({ id: crypto.randomUUID(), kind: "income", text: `Center hold +${centerCount}g`, turn: turnNo });
  }

  // develop bonus
  if (typeOf(piece) === "N" || typeOf(piece) === "B") {
    const backRow = mover === "w" ? 7 : 0;
    if (fr === backRow) {
      gold += 1;
      ledger.push({ id: crypto.randomUUID(), kind: "income", text: `Development +1g`, turn: turnNo });
    }
  }

  ledger.push({ id: crypto.randomUUID(), kind: "income", text: `Treasury +${gold}g (turn ${turnNo})`, turn: turnNo });

  next.gold = { ...state.gold, [mover]: state.gold[mover] + gold };

  // turn flip
  next.turn = opp(mover);

  // tick frozen squares
  const newFrozen: Record<Square, number> = {};
  for (const [sq, n] of Object.entries(state.frozenSquares)) {
    if (n > 1) newFrozen[sq] = n - 1;
  }
  next.frozenSquares = newFrozen;

  // ghost expires
  next.ghostPiece = null;

  // check / mate
  const oppColor = next.turn;
  const opponentInCheck = inCheck(next, oppColor);
  const hasLegal = anyLegalMove(next, oppColor);
  if (opponentInCheck && !hasLegal) {
    next.checkStatus = "CHECKMATE";
    next.gameOver = true;
    next.winner = mover;
    ledger.push({ id: crypto.randomUUID(), kind: "check", text: `Checkmate. ${mover === "w" ? "White" : "Black"} wins.`, turn: turnNo });
  } else if (!opponentInCheck && !hasLegal) {
    next.checkStatus = "STALEMATE";
    next.gameOver = true;
    next.winner = "draw";
    ledger.push({ id: crypto.randomUUID(), kind: "check", text: `Stalemate. The game is drawn.`, turn: turnNo });
  } else if (opponentInCheck) {
    next.checkStatus = "CHECK";
    gold += 0;
    // check bonus to mover
    next.gold = { ...next.gold, [mover]: next.gold[mover] + 3 };
    ledger.push({ id: crypto.randomUUID(), kind: "check", text: `Check! +3g`, turn: turnNo });
  } else {
    next.checkStatus = "";
  }

  next.ledger = [...(state.ledger ?? []), ...ledger].slice(-200);
  return { state: next, ledger, goldEarned: gold };
}

function anyLegalMove(state: GameState, color: Color): boolean {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (p && colorOf(p) === color) {
      if (legalMoves({ ...state, turn: color }, rcToSq(r, c)).length > 0) return true;
    }
  }
  return false;
}

export function pieceName(t: PieceType): string {
  return ({ P: "Pawn", N: "Knight", B: "Bishop", R: "Rook", Q: "Queen", K: "King" } as const)[t];
}

export const PIECE_GLYPH: Record<Piece, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};
