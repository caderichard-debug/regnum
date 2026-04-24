import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ensureServerPlayer } from "@/lib/player";
import type { PlayerInfo } from "@/lib/chess/types";
import { connectMatchmaking } from "@/lib/matchmakingSocket";
import { matchmakingCancel, matchmakingJoin } from "@/lib/api";

export const Route = createFileRoute("/matchmaking")({
  head: () => ({
    meta: [
      { title: "Matchmaking — Regnum" },
      { name: "description", content: "Searching for a worthy opponent..." },
    ],
  }),
  component: MatchmakingPage,
});

const MESSAGES = [
  "Seeking a worthy opponent...",
  "Consulting the oracles...",
  "The board awaits...",
  "Sharpening the blades of war...",
  "Gathering the council...",
];

function MatchmakingPage() {
  const navigate = useNavigate();
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [matchFlash, setMatchFlash] = useState(false);
  const [error, setError] = useState<string>("");
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    let active = true;
    let playerId = "";
    const wsClientId = crypto.randomUUID();
    const socket = connectMatchmaking(
      wsClientId,
      (event) => {
        if (!active || event.type !== "match_found") return;
        setMatchFlash(true);
        setTimeout(() => {
          navigate({
            to: "/play",
            search: { mode: "online", gameId: event.gameId, color: event.color } as never,
          });
        }, 500);
      },
      async () => {
        try {
          const me = await ensureServerPlayer();
          if (!active) return;
          playerId = me.id;
          setPlayer(me);
          const joinedOut = await matchmakingJoin(me.id, wsClientId);
          if (!active) return;
          setJoined(true);
          if (joinedOut.status === "matched") {
            setMatchFlash(true);
            setTimeout(() => {
              navigate({
                to: "/play",
                search: { mode: "online", gameId: joinedOut.gameId, color: joinedOut.color } as never,
              });
            }, 500);
          }
        } catch {
          if (!active) return;
          setError("Matchmaking connection failed.");
        }
      },
    );

    return () => {
      active = false;
      if (playerId) {
        void matchmakingCancel(playerId);
      }
      socket.close();
    };
  }, [navigate]);

  useEffect(() => {
    const i = setInterval(() => setMsgIdx((n) => (n + 1) % MESSAGES.length), 2200);
    const e = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => { clearInterval(i); clearInterval(e); };
  }, []);

  const eta = Math.max(0, 8 - elapsed);

  return (
    <div className="watermark-board relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="fade-in flex flex-col items-center">
        <div className="relative flex h-44 w-44 items-center justify-center">
          <div className="spin-slow absolute inset-0 rounded-full border-2 border-gold/30 border-t-gold-bright" />
          <div className="pulse-gold flex h-32 w-32 items-center justify-center rounded-full border border-gold/40 bg-ink/80">
            <span className="text-7xl text-gold-bright">♚</span>
          </div>
        </div>

        <div className="mt-10 h-6 font-display text-sm uppercase tracking-[0.3em] text-gold-bright">
          {matchFlash
            ? "Opponent found — prepare yourself."
            : error
              ? error
              : joined
                ? MESSAGES[msgIdx]
                : "Joining queue..."}
        </div>

        {player && (
          <div className="mt-6">
            <div className="font-display text-xl text-foreground">{player.name}</div>
            <div className="text-sm text-muted-foreground">ELO {player.elo}</div>
          </div>
        )}

        {elapsed >= 5 && !matchFlash && (
          <div className="mt-3 text-xs text-muted-foreground">
            Estimated wait: ~{eta}s
          </div>
        )}

        <button
          onClick={async () => {
            if (player?.id) await matchmakingCancel(player.id);
            navigate({ to: "/" });
          }}
          className="mt-12 font-display text-xs uppercase tracking-widest text-muted-foreground hover:text-gold-bright"
        >
          Cancel Search
        </button>
      </div>

      {matchFlash && (
        <div className="fade-in pointer-events-none absolute inset-0 bg-gold-bright/20" />
      )}
    </div>
  );
}
