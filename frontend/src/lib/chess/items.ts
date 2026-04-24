import type { GameState, LedgerEntry, Piece, Square } from "./types";
import { colorOf, opp, sqToRC, typeOf, inCheck } from "./engine";

export interface ItemResult {
  state: GameState;
  ledger: LedgerEntry[];
}

const SHOP_COSTS: Record<string, number> = {
  inspire: 10,
  promote: 15,
  recall: 18,
  ghost: 22,
  reinforce: 28,
  sabotage: 38,
};

export function canAfford(state: GameState, key: string): boolean {
  const cost = SHOP_COSTS[key] ?? 0;
  return state.gold[state.turn] >= cost;
}

export function applyItem(state: GameState, key: string, target?: Square): ItemResult | null {
  if (state.gameOver) return null;
  if (!canAfford(state, key)) return null;
  const player = state.turn;
  if (state.usedItems[player]?.[key] && (key === "recall")) return null;

  const cost = SHOP_COSTS[key];
  const turnNo = state.moveCount ?? 0;

  // helpers
  const cloneBoard = () => state.board.map((r) => r.slice());

  if (key === "recall") {
    if (!state.lastBoard) return null;
    const next: GameState = {
      ...state,
      board: state.lastBoard.map((r) => r.slice()),
      lastBoard: null,
      gold: { ...state.gold, [player]: state.gold[player] - cost },
      usedItems: { ...state.usedItems, [player]: { ...state.usedItems[player], recall: true } },
      ledger: [...(state.ledger ?? [])],
      // Recalling means it's still your turn
      turn: state.turn,
    };
    const ledger: LedgerEntry[] = [{ id: crypto.randomUUID(), kind: "item", text: `Recall used (−${cost}g). Last move undone.`, turn: turnNo }];
    next.ledger = [...(next.ledger ?? []), ...ledger].slice(-200);
    return { state: next, ledger };
  }

  if (key === "inspire") {
    if (!target) return null;
    const [r, c] = sqToRC(target);
    const piece = state.board[r][c];
    if (!piece || piece !== `${player}P`) return null;
    const dir = player === "w" ? -1 : 1;
    const r1 = r + dir, r2 = r + 2 * dir;
    if (r2 < 0 || r2 > 7) return null;
    if (state.board[r1][c] || state.board[r2][c]) return null;
    const board = cloneBoard();
    board[r2][c] = piece;
    board[r][c] = null;
    const next: GameState = {
      ...state,
      board,
      lastBoard: cloneBoard(),
      gold: { ...state.gold, [player]: state.gold[player] - cost },
      turn: opp(player),
      moveCount: (state.moveCount ?? 0) + 1,
    };
    if (inCheck(next, player)) return null;
    const ledger: LedgerEntry[] = [{ id: crypto.randomUUID(), kind: "item", text: `⚡ Inspire: pawn ${target} → ${target[0]}${parseInt(target[1]) + (player === "w" ? 2 : -2)}`, turn: turnNo + 1 }];
    next.ledger = [...(state.ledger ?? []), ...ledger].slice(-200);
    return { state: next, ledger };
  }

  if (key === "promote") {
    if (!target) return null;
    const [r, c] = sqToRC(target);
    const piece = state.board[r][c];
    if (!piece || piece !== `${player}P`) return null;
    const board = cloneBoard();
    board[r][c] = `${player}Q` as Piece;
    const next: GameState = {
      ...state,
      board,
      lastBoard: cloneBoard(),
      gold: { ...state.gold, [player]: state.gold[player] - cost },
      turn: opp(player),
    };
    const ledger: LedgerEntry[] = [{ id: crypto.randomUUID(), kind: "item", text: `♛ Fast Promote at ${target}`, turn: turnNo }];
    next.ledger = [...(state.ledger ?? []), ...ledger].slice(-200);
    return { state: next, ledger };
  }

  if (key === "ghost") {
    if (!target) return null;
    const [r, c] = sqToRC(target);
    const piece = state.board[r][c];
    if (!piece || colorOf(piece) !== player) return null;
    const next: GameState = {
      ...state,
      ghostPiece: { sq: target, piece },
      gold: { ...state.gold, [player]: state.gold[player] - cost },
      turn: opp(player),
    };
    const ledger: LedgerEntry[] = [{ id: crypto.randomUUID(), kind: "item", text: `👻 Ghost at ${target}`, turn: turnNo }];
    next.ledger = [...(state.ledger ?? []), ...ledger].slice(-200);
    return { state: next, ledger };
  }

  if (key === "reinforce") {
    if (!target) return null;
    if (!state.capturedBy[player].includes("P")) return null;
    const [r, c] = sqToRC(target);
    if (state.board[r][c]) return null;
    const expectedRow = player === "w" ? 6 : 1;
    if (r !== expectedRow) return null;
    const board = cloneBoard();
    board[r][c] = `${player}P`;
    const captured = [...state.capturedBy[player]];
    captured.splice(captured.indexOf("P"), 1);
    const next: GameState = {
      ...state,
      board,
      capturedBy: { ...state.capturedBy, [player]: captured },
      gold: { ...state.gold, [player]: state.gold[player] - cost },
      turn: opp(player),
    };
    const ledger: LedgerEntry[] = [{ id: crypto.randomUUID(), kind: "item", text: `♟ Reinforce: pawn returned to ${target}`, turn: turnNo }];
    next.ledger = [...(state.ledger ?? []), ...ledger].slice(-200);
    return { state: next, ledger };
  }

  if (key === "sabotage") {
    if (!target) return null;
    const [r, c] = sqToRC(target);
    const piece = state.board[r][c];
    if (!piece || colorOf(piece) === player) return null;
    if (typeOf(piece) === "K") return null;
    const next: GameState = {
      ...state,
      frozenSquares: { ...state.frozenSquares, [target]: 2 }, // ticks down on opponent's turn
      gold: { ...state.gold, [player]: state.gold[player] - cost },
      turn: opp(player),
    };
    const ledger: LedgerEntry[] = [{ id: crypto.randomUUID(), kind: "item", text: `🔒 Sabotage: ${target} frozen`, turn: turnNo }];
    next.ledger = [...(state.ledger ?? []), ...ledger].slice(-200);
    return { state: next, ledger };
  }

  return null;
}
