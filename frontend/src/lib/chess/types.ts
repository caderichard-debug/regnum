export type Color = "w" | "b";
export type PieceType = "P" | "N" | "B" | "R" | "Q" | "K";
export type Piece = `${Color}${PieceType}`;
export type Square = string; // e.g. "e4"

export interface PlayerInfo {
  id: string;
  name: string;
  elo: number;
  connected: boolean;
}

export interface GameState {
  board: (Piece | null)[][]; // [row 0 = rank 8 ... row 7 = rank 1][file 0 = a ... file 7 = h]
  turn: Color;
  gold: { w: number; b: number };
  capturedBy: { w: PieceType[]; b: PieceType[] };
  frozenSquares: Record<Square, number>;
  ghostPiece: { sq: Square; piece: Piece } | null;
  usedItems: { w: Record<string, boolean>; b: Record<string, boolean> };
  checkStatus: "" | "CHECK" | "CHECKMATE" | "STALEMATE";
  gameOver: boolean;
  lastBoard: (Piece | null)[][] | null;
  enPassantTarget: Square | null;
  castlingRights: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
  turnTimeRemaining: number;
  turnDeadline?: number;
  turnDurationMs?: number;
  players: { w: PlayerInfo; b: PlayerInfo };
  moveCount?: number;
  ledger?: LedgerEntry[];
  winner?: Color | "draw" | null;
}

export interface LedgerEntry {
  id: string;
  kind: "move" | "capture" | "income" | "item" | "check" | "system";
  text: string;
  turn: number;
}

export interface ShopItem {
  key: string;
  icon: string;
  name: string;
  cost: number;
  description: string;
  oncePerGame?: boolean;
  needsTarget?: boolean;
  targetHint?: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  { key: "inspire", icon: "⚡", name: "Inspire", cost: 10, description: "Any pawn advances 2 squares this turn.", needsTarget: true, targetHint: "Click one of your pawns to advance 2 squares." },
  { key: "promote", icon: "♛", name: "Promote", cost: 15, description: "Promote a pawn near promotion to a queen.", needsTarget: true, targetHint: "Click one of your pawns on the pre-promotion rank." },
  { key: "recall", icon: "↩", name: "Recall", cost: 18, description: "Undo your last move (once per game).", oncePerGame: true },
  { key: "ghost", icon: "👻", name: "Ghost", cost: 22, description: "One piece can't be captured next move.", needsTarget: true, targetHint: "Click one of your pieces to make it untouchable." },
  { key: "reinforce", icon: "♟", name: "Reinforce", cost: 28, description: "Return a captured pawn to your 2nd rank.", needsTarget: true, targetHint: "Click an empty square on your 2nd rank." },
  { key: "sabotage", icon: "🔒", name: "Sabotage", cost: 38, description: "Freeze an enemy piece for 1 turn.", needsTarget: true, targetHint: "Click an enemy piece to freeze it." },
];
