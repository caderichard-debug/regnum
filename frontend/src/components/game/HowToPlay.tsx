import { SHOP_ITEMS } from "@/lib/chess/types";

export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="scale-in max-h-[88vh] w-full max-w-4xl overflow-y-auto gold-scroll rounded-md border border-gold/40 bg-card p-8 shadow-[var(--shadow-deep)]"
      >
        <div className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h2 className="font-display text-3xl text-gold-bright">How to Play Regnum</h2>
            <p className="mt-1 italic text-muted-foreground">Aggression pays — but peace endures.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1 font-display text-xs uppercase tracking-widest text-muted-foreground hover:border-gold/60 hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Section title="The Economy">
            Every turn you play, your treasury grows. Spend gold on royal favors —
            potent items that bend the rules of chess in your favor.
          </Section>
          <Example>
            <ul className="space-y-1 text-sm">
              <li>+2g — base income each move</li>
              <li>+P:2 N/B:4 R:6 Q:10 — capture bonuses</li>
              <li>+3g — when you place opponent in check</li>
              <li>+1g — per central pawn (d4/e4/d5/e5)</li>
              <li>+1g — when developing a knight or bishop</li>
            </ul>
          </Example>

          <Section title="The Board">
            Standard chess rules apply — castling, en passant, promotion. Pawns
            auto-promote to queens on the back rank. The local player is always
            seated at the bottom of the board.
          </Section>
          <Example>
            <p className="text-sm text-muted-foreground">
              Selected squares glow green. Legal moves show a dot, captures tint red.
              Frozen squares pulse blue. Ghosted pieces shimmer.
            </p>
          </Example>
        </div>

        <h3 className="mt-8 font-display text-xl uppercase tracking-widest text-gold">The Six Royal Favors</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {SHOP_ITEMS.map((item) => (
            <div key={item.key} className="flex items-start gap-4 rounded-md border border-border/60 bg-ink/40 p-4">
              <div className="text-3xl">{item.icon}</div>
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-sm uppercase tracking-wider text-foreground">{item.name}</span>
                  <span className="font-display text-sm text-gold-bright">{item.cost}g</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-base uppercase tracking-widest text-gold">{title}</h3>
      <p className="mt-2 leading-relaxed text-foreground/85">{children}</p>
    </div>
  );
}
function Example({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/40 bg-ink/30 p-4">
      {children}
    </div>
  );
}
