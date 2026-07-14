import { CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";
import type { SearchProgressItem } from "./types";

export function StatPill({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="glass rounded-lg px-2.5 py-1 flex items-center gap-1.5 border border-white/[0.04] transition-colors group-hover:border-white/10">
      <span className="text-[11px] font-medium tracking-wide uppercase text-yuui-muted">
        {label}
      </span>
      <span className="font-mono text-xs font-bold text-white bg-white/10 rounded px-1.5 py-0.5 leading-none">
        {value}
      </span>
    </div>
  );
}

export function StatusIcon({ status }: { status: SearchProgressItem["status"] }) {
  if (status === "matched")
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />;
  if (status === "low_confidence")
    return <AlertCircle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />;
  if (status === "not_found")
    return <XCircle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />;
  if (status === "error")
    return <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
  return (
    <Loader2 className="h-3.5 w-3.5 text-yuui-accent animate-spin shrink-0" />
  );
}
