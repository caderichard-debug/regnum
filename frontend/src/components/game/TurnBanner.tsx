import { cn } from "@/lib/utils";

export function TurnBanner({
  isMyTurn,
  localName,
  opponentName,
  timeRemaining,
  totalSeconds = 60,
}: {
  isMyTurn: boolean;
  localName: string;
  opponentName: string;
  timeRemaining: number;
  totalSeconds?: number;
}) {
  const pct = Math.max(0, Math.min(100, (timeRemaining / totalSeconds) * 100));
  const danger = timeRemaining <= 10;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between font-display text-xs uppercase tracking-[0.25em]">
        <span className={cn(isMyTurn ? "text-gold-bright" : "text-muted-foreground")}>
          {isMyTurn ? "Your turn" : `${opponentName}'s turn`}
        </span>
        <span className={cn("tabular-nums", danger ? "text-red-400" : "text-muted-foreground")}>
          {Math.floor(timeRemaining / 60).toString().padStart(2, "0")}:{(timeRemaining % 60).toString().padStart(2, "0")}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/60 ring-1 ring-border">
        <div
          className={cn(
            "h-full transition-all duration-1000 ease-linear",
            danger ? "bg-red-500" : "bg-gradient-to-r from-gold-bright to-gold-dim",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
