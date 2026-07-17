import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Pause,
  Play,
  AlertCircle,
  Loader2,
  XCircle,
} from "lucide-react";
import type { SearchProgress } from "../../../store/types";
import { StatusIcon } from "./StatPill";

/**
 * The single, advanced AniList search panel. Docked to the right edge of the
 * screen, it shows the whole search queue as a scrollable list, highlights the
 * series currently being checked, and exposes Pause / Resume / Cancel.
 */
export function AniListSearchPanel({
  isSearching,
  isPaused,
  searchProgress,
  searchHistory,
  matchedCount,
  lowConfCount,
  notFoundCount,
  errorCount,
  onPause,
  onResume,
  onCancel,
}: {
  isSearching: boolean;
  isPaused: boolean;
  searchProgress: SearchProgress | null;
  searchHistory: SearchProgress[];
  matchedCount: number;
  lowConfCount: number;
  notFoundCount: number;
  errorCount: number;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}) {
  const activeRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to keep the currently-checking series in view.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [searchProgress?.current]);

  const total = searchProgress?.total ?? 0;
  const current = searchProgress?.current ?? 0;
  const pct = total > 0 ? (current / total) * 100 : 0;

  // Build the visible list: every completed search from history, plus the
  // in-flight one at the bottom if it hasn't landed in history yet.
  const rows: (SearchProgress & { active?: boolean })[] = [...searchHistory];
  if (
    searchProgress &&
    searchProgress.status === "searching" &&
    !rows.some((r) => r.current === searchProgress.current)
  ) {
    rows.push({ ...searchProgress, active: true });
  }

  return (
    <AnimatePresence>
      {isSearching && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="w-full flex flex-col bg-black rounded-3xl border border-white/10 shadow-lg overflow-hidden h-[550px]"
        >
          {/* Header */}
          <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/[0.06]">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                {isPaused ? (
                  <Pause className="h-4 w-4 text-yellow-400" />
                ) : (
                  <Loader2 className="h-4 w-4 text-yuui-accent animate-spin" />
                )}
                <span className="text-[11px] font-bold uppercase tracking-wider text-yuui-accent">
                  {isPaused && searchProgress?.status === "searching"
                    ? "Pausing…"
                    : isPaused
                      ? "Paused"
                      : "Searching AniList"}
                </span>
              </div>
              <span className="text-[11px] font-mono text-white/70 font-semibold">
                {current} / {total}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-2.5">
              <div
                className="h-full bg-gradient-to-r from-yuui-accent to-yuui-accent2 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Summary counts */}
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="text-green-400 flex items-center gap-0.5">
                <CheckCircle2 className="h-2.5 w-2.5" /> {matchedCount}
              </span>
              {lowConfCount > 0 && (
                <span className="text-yellow-400 flex items-center gap-0.5">
                  <AlertCircle className="h-2.5 w-2.5" /> {lowConfCount}
                </span>
              )}
              <span className="text-yellow-500 flex items-center gap-0.5">
                <XCircle className="h-2.5 w-2.5" /> {notFoundCount}
              </span>
              {errorCount > 0 && (
                <span className="text-red-400 flex items-center gap-0.5">
                  <AlertCircle className="h-2.5 w-2.5" /> {errorCount}
                </span>
              )}
            </div>
          </div>

          {/* Scrollable list of every series being checked */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
            {rows.length === 0 && (
              <div className="flex items-center gap-2 px-2 py-3 text-xs text-yuui-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Preparing search queue…
              </div>
            )}
            {rows.map((row, i) => {
              const isActive =
                row.active ||
                (searchProgress?.status === "searching" &&
                  row.current === searchProgress.current);
              return (
                <div
                  key={`${row.current}-${i}`}
                  ref={isActive ? activeRef : null}
                  className={`flex items-start gap-2 rounded-xl px-2.5 py-1.5 transition-colors ${
                    isActive
                      ? "bg-yuui-accent/15 border border-yuui-accent/30"
                      : "border border-transparent hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="mt-0.5">
                    {isActive ? (
                      <Loader2 className="h-3.5 w-3.5 text-yuui-accent animate-spin shrink-0" />
                    ) : (
                      <StatusIcon status={row.status} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs truncate ${
                        isActive ? "text-white font-semibold" : "text-white/80"
                      }`}
                      title={row.title}
                    >
                      {row.title}
                    </div>
                    {row.message && (
                      <div className="mt-0.5 text-[10px] text-red-300/80 leading-snug line-clamp-2">
                        {row.message}
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-white/30 shrink-0 mt-0.5">
                    #{row.current}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Control buttons */}
          <div className="shrink-0 flex items-center gap-2 px-3 py-3 border-t border-white/[0.06]">
            {isPaused ? (
              <button
                onClick={onResume}
                className="flex-1 glass rounded-xl px-2.5 py-2 text-[11px] font-bold text-green-400 hover:bg-green-500/10 transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-green-500/20"
              >
                <Play className="h-3.5 w-3.5" />
                Resume
              </button>
            ) : (
              <button
                onClick={onPause}
                className="flex-1 glass rounded-xl px-2.5 py-2 text-[11px] font-bold text-yellow-400 hover:bg-yellow-500/10 transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-yellow-500/20"
              >
                <Pause className="h-3.5 w-3.5" />
                Pause
              </button>
            )}
            <button
              onClick={onCancel}
              className="flex-1 glass rounded-xl px-2.5 py-2 text-[11px] font-bold text-red-400 hover:bg-red-500/10 transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-red-500/20"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
