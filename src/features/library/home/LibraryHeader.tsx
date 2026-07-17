import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { StatPill } from "./StatPill";

interface LibraryHeaderProps {
  folder: string | null;
  matchedEntries: { key: string; episode_count: number }[];
  totalEps: number;
  needReview: number;
  showStats: boolean;
  setShowStats: (show: boolean) => void;
  navigate: (path: string) => void;
  error: string | null;
}

export function LibraryHeader({
  folder,
  matchedEntries,
  totalEps,
  needReview,
  showStats,
  setShowStats,
  navigate,
  error,
}: LibraryHeaderProps) {
  return (
    <div className="w-full mb-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <motion.h1
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-display text-4xl font-bold"
            >
              Your <span className="text-gradient">Library</span>
            </motion.h1>
            <p className="mt-1 truncate text-sm text-yuui-muted">
              {folder ?? "No folder selected"}
            </p>
          </div>

          <div className="flex items-center gap-2 select-none">
            <div
              onClick={() => setShowStats(!showStats)}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <StatPill label="Series" value={matchedEntries.length} />
              <StatPill label="Episodes" value={totalEps} />
              <div className="glass rounded-lg p-1.5 flex items-center justify-center transition-colors group-hover:bg-white/[0.08] border border-white/[0.04]">
                <ChevronDown
                  className={`h-3.5 w-3.5 text-white/70 group-hover:text-white transition-transform duration-300 ${showStats ? "rotate-180" : ""}`}
                />
              </div>
            </div>

            <div
              onClick={() => navigate("/review")}
              className={`glass rounded-lg px-2.5 py-1 flex items-center gap-1.5 cursor-pointer transition-all hover:bg-white/[0.08] hover:scale-[1.02] border ${
                needReview > 0
                  ? "border-yellow-500/40 bg-yellow-500/5 shadow-glow"
                  : "border-white/[0.04]"
              }`}
            >
              <span
                className={`text-[11px] font-medium tracking-wide uppercase ${
                  needReview > 0
                    ? "text-yellow-400 font-bold"
                    : "text-yuui-muted"
                }`}
              >
                Review
              </span>
              <span
                className={`font-mono text-xs font-bold rounded px-1.5 py-0.5 leading-none ${
                  needReview > 0
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-white/10 text-white"
                }`}
              >
                {needReview}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3"></div>
      </div>

      {error && (
        <div className="glass rounded-2xl border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 my-4">
          {error}
        </div>
      )}
    </div>
  );
}
