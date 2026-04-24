import type { Color, GameState, Square } from "./chess/types";
import { colorOf, legalMoves, rcToSq, typeOf } from "./chess/engine";

const VAL: Record<string, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

export function pickAIMove(state: GameState, color: Color): { from: Square; to: Square } | null {
  const candidates: { from: Square; to: Square; score: number }[] = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (!p || colorOf(p) !== color) continue;
    const from = rcToSq(r, c);
    for (const to of legalMoves({ ...state, turn: color }, from)) {
      const [tr, tc] = [8 - parseInt(to[1]), to.charCodeAt(0) - 97];
      const target = state.board[tr][tc];
      let score = Math.random();
      if (target) score += 10 + (VAL[typeOf(target)!] ?? 0) * 5;
      // Prefer center
      if ((tr === 3 || tr === 4) && (tc === 3 || tc === 4)) score += 1.5;
      candidates.push({ from, to, score });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}
