export function Avatar({
  src,
  name,
  sub,
}: {
  src?: string | null;
  name?: string | null;
  sub?: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-yuui-panel">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-yuui-accent/15 text-lg">
            👤
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm text-white/90">{name ?? "—"}</div>
        {sub && <div className="truncate text-xs text-yuui-muted">{sub}</div>}
      </div>
    </div>
  );
}
