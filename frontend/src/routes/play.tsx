import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { aiOpponent, ensureServerPlayer, getOrCreatePlayer, randomOpponent, updatePlayer } from "@/lib/player";
import { useGame } from "@/hooks/useGame";
import { ChessBoard } from "@/components/game/ChessBoard";
import { PlayerPanel } from "@/components/game/PlayerPanel";
import { TurnBanner } from "@/components/game/TurnBanner";
import { EventLedger } from "@/components/game/EventLedger";
import { HowToPlay } from "@/components/game/HowToPlay";
import { PostGame } from "@/components/game/PostGame";
import type { Color, PlayerInfo } from "@/lib/chess/types";

const searchSchema = z.object({
  mode: z.enum(["online", "ai", "friend"]).catch("ai"),
  gameId: z.string().optional(),
  color: z.enum(["w", "b"]).optional(),
});

export const Route = createFileRoute("/play")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Game — Regnum" },
      { name: "description", content: "Play a game of Regnum economy chess." },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const navigate = useNavigate();
  const { mode, gameId, color } = Route.useSearch();
  const [showHowTo, setShowHowTo] = useState(false);
  const [matchKey, setMatchKey] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [setup, setSetup] = useState<{ white: PlayerInfo; black: PlayerInfo; localColor: Color } | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setMounted(true);
      const me = mode === "online" ? await ensureServerPlayer() : getOrCreatePlayer();
      if (!active) return;
      let opponent: PlayerInfo;
      if (mode === "ai") opponent = aiOpponent();
      else if (mode === "friend") opponent = { ...me, id: "friend-" + (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random())), name: "Friend" };
      else opponent = randomOpponent();
      const localColor: Color = mode === "online" ? (color ?? "w") : Math.random() < 0.5 ? "w" : "b";
      setSetup(localColor === "w"
        ? { white: me, black: opponent, localColor }
        : { white: opponent, black: me, localColor });
    };
    void run();
    return () => { active = false; };
  }, [mode, color, matchKey]);

  if (!mounted || !setup) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink">
        <div className="font-display text-sm uppercase tracking-[0.4em] text-gold-bright">Setting the board…</div>
      </div>
    );
  }
  return <PlayInner key={matchKey} setup={setup} mode={mode} gameId={gameId} navigate={navigate} showHowTo={showHowTo} setShowHowTo={setShowHowTo} onNewMatch={() => setMatchKey((n) => n + 1)} />;
}

interface PlayInnerProps {
  setup: { white: PlayerInfo; black: PlayerInfo; localColor: Color };
  mode: "online" | "ai" | "friend";
  gameId?: string;
  navigate: ReturnType<typeof useNavigate>;
  showHowTo: boolean;
  setShowHowTo: (b: boolean) => void;
  onNewMatch: () => void;
}

function PlayInner({ setup, mode, gameId, navigate, showHowTo, setShowHowTo, onNewMatch }: PlayInnerProps) {
  useEffect(() => {
    if (mode === "online" && !gameId) {
      navigate({ to: "/matchmaking" });
    }
  }, [mode, gameId, navigate]);

  const game = useGame({
    mode,
    localColor: setup.localColor,
    white: setup.white,
    black: setup.black,
    gameId,
    playerId: setup.localColor === "w" ? setup.white.id : setup.black.id,
    turnSeconds: 60,
  });

  const opponentColor: Color = setup.localColor === "w" ? "b" : "w";
  const localPlayer = game.state.players[setup.localColor];
  const opponentPlayer = game.state.players[opponentColor];

  // Awarded ELO once on game over
  useEffect(() => {
    if (!game.state.gameOver || mode === "online") return;
    if (game.state.winner === setup.localColor) {
      updatePlayer({ elo: localPlayer.elo + 18 });
    } else if (game.state.winner && game.state.winner !== "draw") {
      updatePlayer({ elo: Math.max(100, localPlayer.elo - 14) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.state.gameOver]);

  // Stats
  const movesPlayed = game.state.moveCount ?? 0;
  const goldEarned = game.state.gold[setup.localColor];
  const itemsUsed = Object.keys(game.state.usedItems[setup.localColor] ?? {}).length;
  const biggestGoldTurn = useMemo(() => {
    let max = 0; let cur = 0; let curTurn = -1;
    for (const e of game.state.ledger ?? []) {
      if (e.kind === "income" && e.text.startsWith("Treasury")) {
        const m = e.text.match(/\+(\d+)g/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (e.turn !== curTurn) { curTurn = e.turn; cur = 0; }
          cur += n;
          if (cur > max) max = cur;
        }
      }
    }
    return max;
  }, [game.state.ledger]);

  const isLocalActive = game.state.turn === setup.localColor;

  return (
    <div className="flex h-screen flex-col bg-ink">
      {/* Header */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-border/40 px-4 py-2">
        <button
          onClick={() => navigate({ to: "/" })}
          className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-gold-bright"
        >
          ← Abandon
        </button>
        <div className="font-display text-sm uppercase tracking-[0.4em] text-gold-bright">
          REGNUM <span className="ml-2 text-muted-foreground/70">·</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {mode === "online" ? "Ranked Match" : mode === "ai" ? "vs AI" : "vs Friend"}
          </span>
        </div>
        <button
          onClick={() => setShowHowTo(true)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 font-display text-xs text-muted-foreground hover:border-gold/60 hover:text-gold-bright"
          title="How to play"
        >
          ?
        </button>
      </header>

      {/* Three-column game area */}
      <div className="flex flex-1 min-h-0 gap-2 p-2">
        <PlayerPanel
          state={game.state}
          color={setup.localColor}
          side="left"
          isLocal
          isActiveTurn={isLocalActive}
          goldFlash={game.goldFlash}
          activeItemKey={game.activeItem?.key ?? null}
          onActivateItem={game.activateItem}
        />

        {/* Center board column */}
        <main className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div className="w-full max-w-[680px]">
            <TurnBanner
              isMyTurn={game.isMyTurn}
              localName={localPlayer.name}
              opponentName={opponentPlayer.name}
              timeRemaining={game.state.turnTimeRemaining}
              totalSeconds={60}
            />
          </div>

          <div className="flex min-h-0 w-full flex-1 items-center justify-center">
            <div
              className="relative"
              style={{ height: "min(100%, 680px)", aspectRatio: "1 / 1", maxWidth: "100%" }}
            >
              <ChessBoard
                state={game.state}
                selected={game.selected}
                legal={game.legal}
                localColor={setup.localColor}
                onSquareClick={game.onSquareClick}
                highlightTarget={!!game.activeItem}
              />
            </div>
          </div>

          {/* Status bar */}
          <div className="w-full max-w-[680px]">
            <div className="flex min-h-[36px] items-center justify-between rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-sm">
              <div className="truncate">
                {game.activeItem ? (
                  <span className="text-emerald-400">⚡ {game.statusMsg}</span>
                ) : game.state.checkStatus === "CHECK" ? (
                  <span className="text-amber-400">⚠ Check!</span>
                ) : game.statusMsg ? (
                  <span className="text-muted-foreground">{game.statusMsg}</span>
                ) : (
                  <span className="italic text-muted-foreground/70">
                    {game.isMyTurn ? "Your move." : "Awaiting opponent."}
                  </span>
                )}
              </div>
              {game.activeItem && (
                <button
                  onClick={game.cancelItem}
                  className="font-display text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              )}
            </div>
            <div className="mt-2">
              <EventLedger entries={game.state.ledger ?? []} />
            </div>
          </div>
        </main>

        <PlayerPanel
          state={game.state}
          color={opponentColor}
          side="right"
          isLocal={false}
          isActiveTurn={!isLocalActive}
          goldFlash={game.goldFlash}
        />
      </div>

      {/* Opponent disconnected overlay */}
      {game.opponentDisconnected && !game.state.gameOver && (
        <DisconnectBanner name={opponentPlayer.name} />
      )}

      {showHowTo && <HowToPlay onClose={() => setShowHowTo(false)} />}

      {game.state.gameOver && (
        <PostGame
          state={game.state}
          localColor={setup.localColor}
          goldEarned={goldEarned}
          movesPlayed={movesPlayed}
          itemsUsed={itemsUsed}
          biggestGoldTurn={biggestGoldTurn}
          rematchOutgoing={game.rematchOutgoing}
          rematchIncoming={game.rematchIncoming}
          onRematch={() => {
            if (mode === "online") game.requestRematch();
            else onNewMatch();
          }}
          onNewOpponent={() => {
            if (mode === "online") navigate({ to: "/matchmaking" });
            else onNewMatch();
          }}
        />
      )}
    </div>
  );
}

function DisconnectBanner({ name }: { name: string }) {
  const [secs, setSecs] = useState(30);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="fade-in absolute left-1/2 top-20 -translate-x-1/2 rounded-md border border-amber-500/60 bg-ink/95 px-5 py-3 shadow-[var(--shadow-deep)]">
      <div className="font-display text-sm uppercase tracking-widest text-amber-400">
        {name} disconnected
      </div>
      <div className="text-xs text-muted-foreground">Forfeiting in {secs}s if they do not return.</div>
    </div>
  );
}
