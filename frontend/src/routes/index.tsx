import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ensureServerPlayer, getOrCreatePlayer, updatePlayer } from "@/lib/player";
import { HowToPlay } from "@/components/game/HowToPlay";
import type { PlayerInfo } from "@/lib/chess/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Regnum — Economy Chess" },
      { name: "description", content: "Regnum is real-time economy chess: aggression earns gold to spend on royal favors that bend the rules of the board." },
      { property: "og:title", content: "Regnum — Economy Chess" },
      { property: "og:description", content: "Aggression pays — but peace endures. Play real-time economy chess." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    setPlayer(getOrCreatePlayer());
    void ensureServerPlayer().then(setPlayer).catch(() => {
      // keep local fallback if backend unavailable
    });
  }, []);

  const saveName = () => {
    const name = nameDraft.trim().slice(0, 24);
    if (name) setPlayer(updatePlayer({ name }));
    setEditingName(false);
  };

  return (
    <div className="watermark-board relative min-h-screen overflow-hidden">
      {/* Top-right player */}
      <div className="absolute right-6 top-6 flex items-center gap-3">
        {player && !editingName && (
          <>
            <div className="text-right">
              <div className="font-display text-xs uppercase tracking-widest text-muted-foreground">
                {player.name === "Guest" ? "Guest" : "Champion"}
              </div>
              <div className="font-display text-sm text-gold-bright">{player.name} <span className="text-muted-foreground">· {player.elo}</span></div>
            </div>
            <button
              onClick={() => { setNameDraft(player.name); setEditingName(true); }}
              className="rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground hover:border-gold/60 hover:text-foreground"
            >
              Edit
            </button>
          </>
        )}
        {editingName && (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              placeholder="Your name"
              className="w-40 rounded-md border border-gold/40 bg-card px-3 py-1 font-display text-sm text-foreground outline-none focus:border-gold"
            />
            <button onClick={saveName} className="rounded-md bg-gold px-3 py-1 font-display text-xs uppercase tracking-widest text-ink hover:bg-gold-bright">Save</button>
          </div>
        )}
      </div>

      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="fade-in">
          <div className="font-display text-[12px] uppercase tracking-[0.6em] text-gold/70">An economy of war</div>
          <h1
            className="mt-3 font-display text-[clamp(64px,14vw,180px)] leading-none tracking-[0.08em] text-gold-bright"
            style={{ textShadow: "0 0 40px rgba(201,168,76,0.25), 0 4px 0 rgba(0,0,0,0.4)" }}
          >
            REGNUM
          </h1>
          <div className="mx-auto mt-2 h-px w-64 bg-gradient-to-r from-transparent via-gold to-transparent" />
          <p className="mt-4 font-body text-lg italic text-foreground/80">
            aggression pays — but peace endures
          </p>
        </div>

        <div className="fade-in mt-12 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "150ms" }}>
          <Link
            to="/matchmaking"
            className="rounded-md border-2 border-gold bg-gold/5 px-7 py-3 font-display text-sm uppercase tracking-widest text-gold-bright transition-all hover:bg-gold/15 hover:shadow-[var(--shadow-gold)]"
          >
            Play Online
          </Link>
          <Link
            to="/play"
            search={{ mode: "friend" } as never}
            className="rounded-md border border-border bg-card/60 px-6 py-3 font-display text-sm uppercase tracking-widest text-foreground transition-all hover:border-gold/60"
          >
            Play vs Friend
          </Link>
          <Link
            to="/play"
            search={{ mode: "ai" } as never}
            className="rounded-md border border-border bg-card/60 px-6 py-3 font-display text-sm uppercase tracking-widest text-foreground transition-all hover:border-gold/60"
          >
            Play vs AI
          </Link>
          <button
            onClick={() => setShowHowTo(true)}
            className="rounded-md border border-border bg-card/60 px-6 py-3 font-display text-sm uppercase tracking-widest text-foreground transition-all hover:border-gold/60"
          >
            How to Play
          </button>
        </div>

        <div className="fade-in mt-20 max-w-md text-xs italic text-muted-foreground/70" style={{ animationDelay: "300ms" }}>
          Six royal favors await. Capture, develop, hold the center — your treasury swells.
          Spend it well, my liege.
        </div>
      </div>

      {showHowTo && <HowToPlay onClose={() => setShowHowTo(false)} />}
    </div>
  );
}
