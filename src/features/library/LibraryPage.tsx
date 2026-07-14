import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLibrary } from "../../store/library";
import AnimeCard from "../../components/AnimeCard";
import QuickViewModal from "../../components/QuickViewModal";
import VideoPlayerOverlay from "../../components/VideoPlayerOverlay";
import { ChevronDown, EyeOff, AlertCircle } from "lucide-react";
import { StatPill } from "./home/StatPill";
import { AniListSearchPanel } from "./home/AniListSearchPanel";
import { filterEntries } from "./home/filterEntries";
import { computeStats, computeDuplicates } from "./home/libraryStats";
import { usePlaybackHistory } from "./home/usePlaybackHistory";
import { LibraryToolbar } from "./home/LibraryToolbar";
import { SmartCollectionTabs } from "./home/SmartCollectionTabs";
import { StatsDashboard } from "./home/StatsDashboard";
import { FilterDropdown } from "./home/FilterDropdown";

export default function LibraryPage() {
  const {
    entries,
    status,
    progress,
    error,
    folder,
    init,
    addPaths,
    removePath,
    folders,
    rescan,
    cardSize,
    setCardSize,
    saveUserData,
    syncProgressToAnilist,
    searchProgress,
    searchHistory,
    isSearching,
    isPaused,
    cancelSync,
    pauseSync,
    resumeSync,
  } = useLibrary();
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [formatFilter, setFormatFilter] = useState("ALL");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("title");
  const [showStats, setShowStats] = useState(false);
  const [quickViewKey, setQuickViewKey] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState("ALL");
  const [showDuplicatesList, setShowDuplicatesList] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<
    "status" | "format" | "group" | "sort" | null
  >(null);
  const [removeFolderOpen, setRemoveFolderOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<{
    path: string;
    episode: number;
    title: string;
  } | null>(null);
  const navigate = useNavigate();

  const { playbackHistory, loadHistory } = usePlaybackHistory();

  useEffect(() => {
    init();
    loadHistory();
  }, [init]);

  const releaseGroups = useMemo(() => {
    const groups = new Set<string>();
    entries.forEach((e) => {
      e.release_groups.forEach((g) => {
        if (g) groups.add(g);
      });
    });
    return Array.from(groups).sort();
  }, [entries]);

  const activePlaybackHistory = useMemo(() => {
    return playbackHistory.filter((item) =>
      entries.some((e) => e.files.some((f: any) => f.path === item.file_path)),
    );
  }, [playbackHistory, entries]);

  const filteredAndSorted = useMemo(
    () =>
      filterEntries(
        entries,
        query,
        statusFilter,
        formatFilter,
        groupFilter,
        sortBy,
        currentTab,
        activePlaybackHistory,
      ),
    [
      entries,
      query,
      statusFilter,
      formatFilter,
      groupFilter,
      sortBy,
      currentTab,
      activePlaybackHistory,
    ],
  );

  const duplicates = useMemo(() => computeDuplicates(entries), [entries]);

  const stats = useMemo(() => computeStats(entries), [entries]);

  const matchedEntries = useMemo(
    () => entries.filter((e) => e.matched && e.episode_count > 0),
    [entries],
  );
  const totalEps = matchedEntries.reduce((n, e) => n + e.episode_count, 0);
  const needReview = entries.filter((e) => !e.matched && e.episode_count > 0).length;
  const busy = status === "scanning" || status === "matching";

  // Search progress summary
  const matchedCount = searchHistory.filter(
    (s) => s.status === "matched",
  ).length;
  const notFoundCount = searchHistory.filter(
    (s) => s.status === "not_found",
  ).length;
  const errorCount = searchHistory.filter((s) => s.status === "error").length;
  const lowConfCount = searchHistory.filter(
    (s) => s.status === "low_confidence",
  ).length;

  return (
    <div className="h-full overflow-y-auto px-6 pt-3 pb-10">
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
              <span className={`text-[11px] font-medium tracking-wide uppercase ${needReview > 0 ? "text-yellow-400 font-bold" : "text-yuui-muted"}`}>
                Review
              </span>
              <span className={`font-mono text-xs font-bold rounded px-1.5 py-0.5 leading-none ${
                needReview > 0 
                  ? "bg-yellow-500/20 text-yellow-400" 
                  : "bg-white/10 text-white"
              }`}>
                {needReview}
              </span>
            </div>
          </div>
        </div>

        {/* The live AniList search status now lives in a single docked panel
              on the right side of the screen (see AniListSearchPanel below). */}
        <div className="flex items-center gap-3"></div>
      </div>

      {/* Top Search Toolbar */}
      <LibraryToolbar
        query={query}
        setQuery={setQuery}
        searchFocused={searchFocused}
        setSearchFocused={setSearchFocused}
        rescan={rescan}
        busy={busy}
        folder={folder}
        folders={folders}
        addPaths={addPaths}
        removePath={removePath}
        removeFolderOpen={removeFolderOpen}
        setRemoveFolderOpen={setRemoveFolderOpen}
        setToastMsg={setToastMsg}
      />

      {/* Smart Collections Tabs */}
      <SmartCollectionTabs
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
      />

      {/* Stats Dashboard slide-down + duplicate list details */}
      <StatsDashboard
        showStats={showStats}
        stats={stats}
        duplicates={duplicates}
        showDuplicatesList={showDuplicatesList}
        setShowDuplicatesList={setShowDuplicatesList}
      />

      {/* Filter selectors grid */}
      <FilterDropdown
        cardSize={cardSize}
        setCardSize={setCardSize}
        activeDropdown={activeDropdown}
        setActiveDropdown={setActiveDropdown}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        formatFilter={formatFilter}
        setFormatFilter={setFormatFilter}
        groupFilter={groupFilter}
        setGroupFilter={setGroupFilter}
        releaseGroups={releaseGroups}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />

      {/* Body section layout - splits into two columns when searching */}
      <div className="mt-4 flex gap-6 items-start">
        {/* Left Side: Main content grid & status messages */}
        <div className="flex-grow flex-1 min-w-0">
          {error && (
            <div className="glass rounded-2xl border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {/* Matched series render live — even while a scan is still running,
              they appear as soon as the backend confirms a match. The full-screen
              spinner only shows when we have nothing to display yet. */}
          {busy && matchedEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 py-24">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-yuui-accent" />
              <p className="text-sm text-yuui-muted">{progress}</p>
            </div>
          )}

          {(matchedEntries.length > 0 || (!busy && status === "ready")) && (
            <>
              {filteredAndSorted.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-24 text-center select-none">
                  <EyeOff className="h-12 w-12 text-yuui-muted/50 mb-2" />
                  <p className="text-yuui-muted">
                    {matchedEntries.length === 0
                      ? "No anime found in this folder yet."
                      : "No results match your search."}
                  </p>
                </div>
              ) : (
                <div
                  className="grid gap-5"
                  style={{
                    gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`,
                  }}
                >
                  {filteredAndSorted.map((entry, i) => (
                    <AnimeCard
                      key={entry.key}
                      entry={entry}
                      index={i}
                      playbackHistory={playbackHistory}
                      onQuickView={(e) => setQuickViewKey(e.key)}
                      onResume={setActiveVideo}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Side: AniList search panel */}
        {isSearching && (
          <aside className="w-[340px] shrink-0">
            <AniListSearchPanel
              isSearching={isSearching}
              isPaused={isPaused}
              searchProgress={searchProgress}
              searchHistory={searchHistory}
              matchedCount={matchedCount}
              lowConfCount={lowConfCount}
              notFoundCount={notFoundCount}
              errorCount={errorCount}
              onPause={pauseSync}
              onResume={resumeSync}
              onCancel={cancelSync}
            />
          </aside>
        )}
      </div>

      {activeVideo && (
        <VideoPlayerOverlay
          filePath={activeVideo.path}
          episodeNumber={activeVideo.episode}
          title={activeVideo.title}
          hasNextEpisode={(() => {
            const entry = entries.find((e) =>
              e.files.some((f) => f.path === activeVideo.path),
            );
            if (!entry) return false;
            const max = entry.media?.episodes ?? entry.episode_count;
            return activeVideo.episode < max;
          })()}
          onPlayNext={() => {
            const entry = entries.find((e) =>
              e.files.some((f) => f.path === activeVideo.path),
            );
            if (!entry) return;
            const nextEp = activeVideo.episode + 1;
            const nextFile = entry.files.find((f: any) => f.episode === nextEp);
            if (nextFile) {
              setActiveVideo({
                path: nextFile.path,
                episode: nextEp,
                title: nextFile.title || `${entry.title} - Episode ${nextEp}`,
              });
            } else {
              setActiveVideo(null);
            }
          }}
          onClose={() => {
            setActiveVideo(null);
            loadHistory();
          }}
          onWatched={async () => {
            const entry = entries.find((e) =>
              e.files.some((f) => f.path === activeVideo.path),
            );
            if (entry) {
              const currentProgress = entry.user?.progress ?? 0;
              const isCompleted =
                activeVideo.episode ===
                (entry.media?.episodes ?? entry.episode_count);
              if (activeVideo.episode > currentProgress) {
                const patch = {
                  ...entry.user,
                  progress: activeVideo.episode,
                  status: isCompleted
                    ? "Completed"
                    : entry.user?.status || "Watching",
                };
                await saveUserData(entry.key, patch);
              }
              if (entry.media?.id) {
                await syncProgressToAnilist(
                  entry.media.id,
                  activeVideo.episode,
                  isCompleted,
                );
              }
            }
          }}
        />
      )}

      {/* Toast notification — bottom-right */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-[100] glass rounded-xl px-4 py-3 border border-yellow-500/30 bg-yellow-500/5 shadow-lg max-w-sm"
          >
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0" />
              <p className="text-xs text-white/90 leading-snug">{toastMsg}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right-click quick view + edit */}
      {quickViewKey && (() => {
        const qvEntry = entries.find((e) => e.key === quickViewKey);
        if (!qvEntry) return null;
        return <QuickViewModal entry={qvEntry} onClose={() => setQuickViewKey(null)} />;
      })()}
    </div>
  );
}
