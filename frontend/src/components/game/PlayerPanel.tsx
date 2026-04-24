import type { Color, GameState, PieceType } from "@/lib/chess/types";
import { SHOP_ITEMS } from "@/lib/chess/types";
import { PIECE_GLYPH } from "@/lib/chess/engine";
import { cn } from "@/lib/utils";

interface PlayerPanelProps {
  state: GameState;
  color: Color;
  side: "left" | "right";
  isLocal: boolean;
  isActiveTurn: boolean;
  goldFlash?: { color: Color; amount: number; key: number } | null;
  activeItemKey?: string | null;
  onActivateItem?: (key: string, hint: string, needsTarget: boolean) => void;
}

export function PlayerPanel({
  state, color, isLocal, isActiveTurn, goldFlash, activeItemKey, onActivateItem,
}: PlayerPanelProps) {
  const player = state.players[color];
  const gold = state.gold[color];
  const captured = state.capturedBy[color];
  const used = state.usedItems[color] ?? {};

  const initial = player.name.charAt(0).toUpperCase();

  return (
    <aside
      className="flex h-full w-[220px] flex-shrink-0 flex-col gap-2 border border-border/60 p-2.5"
      style={{ background: "var(--gradient-panel)" }}
    >
      {/* Identity */}
      <div className={cn(
        "flex items-center gap-3 rounded-md border border-border/60 p-3 transition-shadow",
        isActiveTurn && "ring-2 ring-gold/60 shadow-[var(--shadow-gold)]",
      )}>
        <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-gold-bright to-gold-dim font-display text-lg text-ink">
          {initial}
          <span className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card",
            player.connected ? "bg-emerald-500" : "bg-red-600",
          )} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm uppercase tracking-wider text-foreground">
            {player.name}
          </div>
          <div className="text-xs text-muted-foreground">
            {color === "w" ? "White" : "Black"} · ELO {player.elo}
          </div>
        </div>
      </div>

      {/* Treasury */}
      <div className="relative rounded-md border border-gold/30 bg-ink/40 p-3">
        <div className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">Treasury</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl">🪙</span>
          <span className="font-display text-2xl text-gold-bright">{gold}</span>
          <span className="text-xs text-muted-foreground">gold</span>
        </div>
        <div className="text-[11px] text-muted-foreground">+2g base · +bonuses</div>
        {goldFlash && goldFlash.color === color && (
          <span
            key={goldFlash.key}
            className="gold-flash pointer-events-none absolute right-3 top-2 font-display text-sm text-gold-bright"
          >
            +{goldFlash.amount}g
          </span>
        )}
      </div>

      {/* Captured pieces */}
      <div className="rounded-md border border-border/60 bg-ink/30 p-3">
        <div className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">Captured</div>
        <div className="mt-1 flex min-h-[24px] flex-wrap gap-0.5 text-lg leading-none text-foreground/90">
          {captured.length === 0 ? (
            <span className="text-xs italic text-muted-foreground/70">None yet</span>
          ) : (
            captured.map((t: PieceType, i: number) => (
              <span key={i}>{PIECE_GLYPH[`${color === "w" ? "b" : "w"}${t}` as keyof typeof PIECE_GLYPH]}</span>
            ))
          )}
        </div>
      </div>

      {/* Shop — only on local player */}
      {isLocal && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-1 font-display text-[10px] uppercase tracking-widest text-muted-foreground">
            Royal Shop
          </div>
          <div className="gold-scroll flex flex-col gap-1.5 overflow-y-auto pr-1">
            {SHOP_ITEMS.map((item) => {
              const affordable = gold >= item.cost;
              const spent = item.oncePerGame && used[item.key];
              const disabled = !affordable || spent || !isActiveTurn;
              const active = activeItemKey === item.key;
              return (
                <button
                  key={item.key}
                  disabled={disabled}
                  onClick={() => onActivateItem?.(item.key, item.targetHint ?? "", !!item.needsTarget)}
                  className={cn(
                    "group flex items-start gap-2 rounded-md border p-2 text-left transition-all",
                    "border-border/60 bg-card/60",
                    !disabled && "hover:border-gold/60 hover:bg-card/90 hover:shadow-[var(--shadow-gold)]",
                    disabled && "opacity-40 grayscale",
                    active && "border-gold ring-2 ring-gold/60",
                  )}
                >
                  <span className="text-xl leading-none">{item.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-xs uppercase tracking-wider text-foreground">
                        {item.name}
                      </span>
                      <span className="font-display text-xs text-gold-bright">{item.cost}g</span>
                    </span>
                    <span className="block text-[11px] leading-snug text-muted-foreground">
                      {spent ? "Already used." : item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
