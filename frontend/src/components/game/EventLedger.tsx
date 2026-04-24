import type { LedgerEntry } from "@/lib/chess/types";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

const COLOR: Record<LedgerEntry["kind"], string> = {
  income: "text-gold-bright",
  capture: "text-red-400",
  item: "text-emerald-400",
  check: "text-amber-400",
  move: "text-foreground/80",
  system: "text-muted-foreground italic",
};

export function EventLedger({ entries }: { entries: LedgerEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries]);

  return (
    <div className="flex h-[110px] flex-col rounded-md border border-border/60 bg-ink/40">
      <div className="border-b border-border/40 px-3 py-1 font-display text-[10px] uppercase tracking-widest text-muted-foreground">
        Event Ledger
      </div>
      <div ref={ref} className="gold-scroll flex-1 space-y-0.5 overflow-y-auto px-3 py-1.5 font-mono text-[11px]">
        {entries.length === 0 ? (
          <div className="italic text-muted-foreground">No events yet.</div>
        ) : entries.map((e) => (
          <div key={e.id} className={cn(COLOR[e.kind])}>
            <span className="mr-2 text-muted-foreground/60">#{e.turn}</span>
            {e.text}
          </div>
        ))}
      </div>
    </div>
  );
}
