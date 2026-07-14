import type { Dispatch, SetStateAction } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers } from "lucide-react";
import type { computeStats, computeDuplicates } from "./libraryStats";

export function StatsDashboard({
  showStats,
  stats,
  duplicates,
  showDuplicatesList,
  setShowDuplicatesList,
}: {
  showStats: boolean;
  stats: ReturnType<typeof computeStats>;
  duplicates: ReturnType<typeof computeDuplicates>;
  showDuplicatesList: boolean;
  setShowDuplicatesList: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <>
      {/* Stats Dashboard slide-down */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden px-0 mt-3"
          >
            <div className="glass rounded-3xl border border-white/[0.06] bg-yuui-surface/40 p-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">
                  Watch Time
                </span>
                <div className="mt-2 text-2xl font-bold font-display text-white">
                  ~{stats.totalDays}{" "}
                  <span className="text-xs font-semibold text-yuui-muted font-sans">
                    Days
                  </span>
                </div>
                <p className="mt-1 text-xs text-yuui-muted">
                  ~{stats.totalHours} estimated hours watched
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">
                  Storage Size
                </span>
                <div className="mt-2 text-2xl font-bold font-display text-white">
                  {(stats.totalSize / (1024 * 1024 * 1024)).toFixed(1)}{" "}
                  <span className="text-xs font-semibold text-yuui-muted font-sans">
                    GB
                  </span>
                </div>
                <p className="mt-1 text-xs text-yuui-muted">
                  {(stats.totalSize / (1024 * 1024 * 1024 * 1024)).toFixed(2)}{" "}
                  TB in library folder
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">
                  Top Genres
                </span>
                <div className="mt-2 space-y-1">
                  {stats.genres.map(([genre, count]) => (
                    <div
                      key={genre}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-white/80">{genre}</span>
                      <span className="text-yuui-muted font-mono">
                        {count} titles
                      </span>
                    </div>
                  ))}
                  {stats.genres.length === 0 && (
                    <p className="text-xs text-yuui-muted">No genres indexed</p>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">
                  Library Health
                </span>
                <div className="mt-2 text-2xl font-bold font-display text-white">
                  {stats.libraryHealth}%
                </div>
                <div className="mt-2 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yuui-accent to-yuui-accent2 rounded-full"
                    style={{ width: `${stats.libraryHealth}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-yuui-muted">
                  Percent of fully completed series
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">
                  Disk Cleanup
                </span>
                <div className="mt-2 text-2xl font-bold font-display text-white">
                  {duplicates.length}{" "}
                  <span className="text-xs font-semibold text-yuui-muted font-sans">
                    Dupes
                  </span>
                </div>
                {duplicates.length > 0 ? (
                  <button
                    onClick={() => setShowDuplicatesList(!showDuplicatesList)}
                    className="mt-2 glass rounded-xl px-3 py-1 text-[10px] font-semibold text-yuui-accent hover:bg-yuui-accent/15 transition-colors cursor-pointer select-none"
                  >
                    {showDuplicatesList ? "Hide Duplicates" : "View Duplicates"}
                  </button>
                ) : (
                  <p className="mt-1 text-[11px] text-yuui-muted mt-2">
                    No duplicate episodes
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duplicate list details */}
      <AnimatePresence>
        {showStats && showDuplicatesList && duplicates.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden px-0 mt-2"
          >
            <div className="glass rounded-3xl border border-white/[0.06] bg-yuui-surface/40 p-5 space-y-4 max-h-[300px] overflow-y-auto">
              <h3 className="font-display text-sm font-bold text-white flex items-center gap-2 select-none">
                <Layers className="h-4 w-4 text-yuui-accent" /> Duplicate Files
                Found
              </h3>
              <p className="text-xs text-yuui-muted">
                These episodes have multiple video files in your library folder.
                You can clean them up to free space.
              </p>
              <div className="divide-y divide-white/[0.04] space-y-3 pt-2">
                {duplicates.map((d, idx) => (
                  <div key={idx} className="pt-3 first:pt-0">
                    <span className="text-xs font-bold text-white/90">
                      {d.seriesTitle} — Episode {d.episode}
                    </span>
                    <div className="mt-2 space-y-1.5 pl-3 border-l border-white/[0.06]">
                      {d.files.map((f, fIdx) => (
                        <div
                          key={fIdx}
                          className="flex flex-wrap items-center justify-between text-[11px] gap-2"
                        >
                          <span
                            className="text-yuui-muted font-mono truncate max-w-[70%]"
                            title={f.path}
                          >
                            {f.file_name}
                          </span>
                          <div className="flex items-center gap-2">
                            {f.resolution && (
                              <span className="rounded bg-white/5 px-1.5 py-0.5 text-white/70">
                                {f.resolution}
                              </span>
                            )}
                            <span className="text-yuui-muted font-mono">
                              {(f.size_bytes / (1024 * 1024 * 1024)).toFixed(2)}{" "}
                              GB
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
