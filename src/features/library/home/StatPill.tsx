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
    <div className="glass rounded-xl px-3 py-2">
      <div className="font-display text-lg leading-none text-white">
        {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-yuui-muted">
        {label}
      </div>
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
