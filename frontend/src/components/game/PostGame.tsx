import type { GameState, Color } from "@/lib/chess/types";
import { useEffect, useState } from "react";

interface PostGameProps {
  state: GameState;
  localColor: Color;
  goldEarned: number;
  movesPlayed: number;
  itemsUsed: number;
  biggestGoldTurn: number;
  rematchOutgoing: boolean;
  rematchIncoming: boolean;
  onRematch: () => void;
  onNewOpponent: () => void;
  onAcceptRematch?: () => void;
  onDeclineRematch?: () => void;
}

export function PostGame(props: PostGameProps) {
  const { state, localColor, goldEarned, movesPlayed, itemsUsed, biggestGoldTurn } = props;
  const won = state.winner === localColor;
  const draw = state.winner === "draw";
  const result = draw ? "DRAW" : won ? "VICTORY" : "DEFEAT";
  const colorClass = draw ? "text-silver" : won ? "text-gold-bright" : "text-red-500/80";
  const eloDelta = draw ? 0 : won ? 18 : -14;

  const [shownDelta, setShownDelta] = useState(0);
  useEffect(() => {
    if (eloDelta === 0) return;
    let i = 0;
    const step = eloDelta > 0 ? 1 : -1;
    const id = setInterval(() => {
      i += step;
      setShownDelta(i);
      if (i === eloDelta) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [eloDelta]);

  return (
    <div className="fade-in fixed inset-0 z-40 flex items-center justify-center bg-ink/85 backdrop-blur-md">
      <div className="scale-in w-full max-w-xl rounded-md border border-gold/40 bg-card p-10 text-center shadow-[var(--shadow-deep)]">
        <div className={`font-display text-6xl tracking-[0.2em] ${colorClass}`}>{result}</div>
        <div className="mt-4 italic text-muted-foreground">
          {draw ? "The board falls silent." : won ? "Long may you reign." : "The crown slips from your grasp."}
        </div>

        <div className="mt-6 inline-flex items-baseline gap-2 rounded-md border border-border/60 bg-ink/50 px-4 py-2 font-display text-2xl">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">ELO</span>
          <span className={shownDelta > 0 ? "text-emerald-400" : shownDelta < 0 ? "text-red-400" : "text-muted-foreground"}>
            {shownDelta > 0 ? "+" : ""}{shownDelta}
          </span>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 text-left">
          <Stat label="Total moves" value={String(movesPlayed)} />
          <Stat label="Gold earned" value={`${goldEarned}g`} />
          <Stat label="Items used" value={String(itemsUsed)} />
          <Stat label="Biggest gold turn" value={`+${biggestGoldTurn}g`} />
        </div>

        {props.rematchIncoming && (
          <div className="mt-6 rounded-md border border-gold/40 bg-ink/50 p-4">
            <div className="font-display text-sm uppercase tracking-widest text-gold-bright">
              Rematch requested
            </div>
            <div className="mt-3 flex justify-center gap-3">
              <button onClick={props.onAcceptRematch} className="rounded-md bg-gold px-4 py-2 font-display text-sm uppercase tracking-widest text-ink hover:bg-gold-bright">Accept</button>
              <button onClick={props.onDeclineRematch} className="rounded-md border border-border px-4 py-2 font-display text-sm uppercase tracking-widest text-muted-foreground hover:text-foreground">Decline</button>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-center gap-3">
          <button
            onClick={props.onRematch}
            disabled={props.rematchOutgoing}
            className="rounded-md border-2 border-gold bg-transparent px-6 py-2.5 font-display text-sm uppercase tracking-widest text-gold-bright transition-all hover:bg-gold/10 disabled:opacity-50"
          >
            {props.rematchOutgoing ? "Rematch requested..." : "Rematch"}
          </button>
          <button
            onClick={props.onNewOpponent}
            className="rounded-md border border-border bg-card px-6 py-2.5 font-display text-sm uppercase tracking-widest text-foreground transition-all hover:border-gold/60"
          >
            New Opponent
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-ink/30 p-3">
      <div className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg text-foreground">{value}</div>
    </div>
  );
}
