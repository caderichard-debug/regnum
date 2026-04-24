import { useMemo } from "react";
import type { Color, GameState, Square } from "@/lib/chess/types";
import { FILES, PIECE_GLYPH } from "@/lib/chess/engine";
import { cn } from "@/lib/utils";

interface BoardProps {
  state: GameState;
  selected: Square | null;
  legal: Square[];
  localColor: Color;
  onSquareClick: (sq: Square) => void;
  highlightTarget?: boolean;
}

export function ChessBoard({ state, selected, legal, localColor, onSquareClick, highlightTarget }: BoardProps) {
  // Always orient board so local player is at the bottom.
  const rows = useMemo(() => {
    const r = [0, 1, 2, 3, 4, 5, 6, 7];
    return localColor === "w" ? r : r.slice().reverse();
  }, [localColor]);
  const cols = useMemo(() => {
    const c = [0, 1, 2, 3, 4, 5, 6, 7];
    return localColor === "w" ? c : c.slice().reverse();
  }, [localColor]);

  const lastFrom = state.lastBoard ? findDelta(state.lastBoard, state.board, "from") : null;
  const lastTo = state.lastBoard ? findDelta(state.lastBoard, state.board, "to") : null;

  return (
    <div
      className="grid h-full w-full select-none rounded-md shadow-[var(--shadow-deep)] ring-1 ring-[var(--gold-dim)]/40"
      style={{ gridTemplateColumns: "repeat(8, 1fr)", gridTemplateRows: "repeat(8, 1fr)" }}
    >
      {rows.map((r) =>
        cols.map((c) => {
          const sq = `${FILES[c]}${8 - r}` as Square;
          const piece = state.board[r][c];
          const isLight = (r + c) % 2 === 0;
          const isSelected = selected === sq;
          const isLegal = legal.includes(sq);
          const isCapture = isLegal && !!piece;
          const isFrozen = !!state.frozenSquares[sq];
          const isGhost = state.ghostPiece?.sq === sq;
          const isLast = sq === lastFrom || sq === lastTo;
          const showCoord = c === (localColor === "w" ? 0 : 7) || r === (localColor === "w" ? 7 : 0);

          return (
            <button
              key={sq}
              onClick={() => onSquareClick(sq)}
              className={cn(
                "relative flex items-center justify-center transition-colors",
                isLight ? "bg-board-light" : "bg-board-dark",
                isSelected && "ring-4 ring-emerald-500/80 ring-inset",
                isLast && !isSelected && "ring-2 ring-amber-500/60 ring-inset",
                isFrozen && "frozen-square",
                highlightTarget && "cursor-crosshair",
              )}
              aria-label={sq}
            >
              {/* Coordinate label */}
              {showCoord && (
                <span
                  className={cn(
                    "pointer-events-none absolute font-display text-[10px] uppercase tracking-wider",
                    isLight ? "text-stone-700/70" : "text-stone-100/60",
                  )}
                  style={{
                    bottom: r === (localColor === "w" ? 7 : 0) ? 2 : undefined,
                    right: r === (localColor === "w" ? 7 : 0) ? 4 : undefined,
                    top: r !== (localColor === "w" ? 7 : 0) ? 2 : undefined,
                    left: c === (localColor === "w" ? 0 : 7) ? 4 : undefined,
                  }}
                >
                  {r === (localColor === "w" ? 7 : 0) ? FILES[c] : 8 - r}
                </span>
              )}

              {/* Capture tint */}
              {isCapture && (
                <span className="pointer-events-none absolute inset-0 bg-red-700/30" />
              )}

              {/* Legal move dot */}
              {isLegal && !isCapture && (
                <span className="pointer-events-none absolute h-3 w-3 rounded-full bg-emerald-700/60" />
              )}

              {/* Piece */}
              {piece && (
                <span
                  className={cn(
                    "pointer-events-none absolute inset-0 z-10 flex items-center justify-center font-serif leading-none",
                    piece[0] === "w" ? "text-stone-50" : "text-stone-900",
                    isGhost && "ghost-piece",
                  )}
                  style={{
                    fontSize: "min(7vh, 7vw, 60px)",
                    textShadow:
                      piece[0] === "w"
                        ? "0 1px 0 #000, 0 0 2px rgba(0,0,0,0.6)"
                        : "0 1px 0 #f5e9c8, 0 0 2px rgba(0,0,0,0.4)",
                  }}
                >
                  {PIECE_GLYPH[piece]}
                </span>
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}

function findDelta(prev: (string | null)[][], cur: (string | null)[][], which: "from" | "to"): Square | null {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = prev[r][c]; const k = cur[r][c];
    if (p !== k) {
      if (which === "from" && p && !k) return `${FILES[c]}${8 - r}`;
      if (which === "to" && k && p !== k) return `${FILES[c]}${8 - r}`;
    }
  }
  return null;
}
