// ─── Small building blocks (detail modal) ──────────────────────────────────────
export function Fact({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-white/30 shrink-0">{label}</span>
      <span className={`text-xs text-white/80 text-right ${mono ? "font-mono" : "font-medium"}`}>{value}</span>
    </div>
  );
}

export function Chip({ children, tint }: { children: React.ReactNode; tint?: string }) {
  return (
    <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[11px] text-white/75 font-medium whitespace-nowrap"
      style={tint ? { borderColor: tint + "40", color: tint } : undefined}>
      {children}
    </span>
  );
}
