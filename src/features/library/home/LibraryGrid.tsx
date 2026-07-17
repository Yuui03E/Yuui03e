import { motion, AnimatePresence } from "framer-motion";
import AnimeCard from "../../../components/AnimeCard";
import type { StoredEntry, PlaybackHistoryEntry } from "../../../lib/types";

interface LibraryGridProps {
  entries: StoredEntry[];
  status: string;
  progress: string;
  folder: string | null;
  cardSize: number;
  query: string;
  statusFilter: string;
  formatFilter: string;
  groupFilter: string;
  sortBy: string;
  currentTab: string;
  busy: boolean;
  activeVideo: { path: string; episode: number; title: string } | null;
  setActiveVideo: (
    video: { path: string; episode: number; title: string } | null,
  ) => void;
  quickViewKey: string | null;
  setQuickViewKey: (key: string | null) => void;
  playbackHistory: PlaybackHistoryEntry[];
  loadHistory: () => void;
  matchedEntries: { key: string; episode_count: number }[];
  filteredAndSorted: StoredEntry[];
}

export function LibraryGrid(props: LibraryGridProps) {
  const {
    status,
    progress,
    cardSize,
    busy,
    matchedEntries,
    filteredAndSorted,
    playbackHistory,
    setActiveVideo,
    setQuickViewKey,
  } = props;

  return (
    <>
      {/* Loading spinner when no entries yet and busy */}
      {busy && matchedEntries.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-yuui-accent" />
          <p className="text-sm text-yuui-muted">{progress}</p>
        </div>
      )}

      {/* Grid */}
      {(matchedEntries.length > 0 || (!busy && status === "ready")) && (
        <>
          {filteredAndSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center select-none">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="h-12 w-12 text-yuui-muted/50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-full w-full"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894l3.65 3.65M3 3l3.65 3.65"
                  />
                </svg>
              </motion.div>
              <p className="text-yuui-muted">
                {matchedEntries.length === 0
                  ? "No anime found in this folder yet."
                  : "No results match your search."}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              <div
                className="grid gap-5"
                style={{
                  gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`,
                }}
              >
                {filteredAndSorted.map((entry, i) => (
                  <motion.div
                    key={entry.key}
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 260, damping: 25 }}
                  >
                    <AnimeCard
                      entry={entry}
                      index={i}
                      playbackHistory={playbackHistory}
                      onQuickView={(e) => setQuickViewKey(e.key)}
                      onResume={setActiveVideo}
                    />
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </>
      )}
    </>
  );
}
