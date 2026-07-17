import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLibrary } from "../../store/library";
import type { PlaybackHistoryEntry } from "../../lib/types";
import { usePlaybackHistory } from "./home/usePlaybackHistory";
import { filterEntries } from "./home/filterEntries";
import { computeStats, computeDuplicates } from "./home/libraryStats";
import { LibraryToolbar } from "./home/LibraryToolbar";
import { SmartCollectionTabs } from "./home/SmartCollectionTabs";
import { StatsDashboard } from "./home/StatsDashboard";
import { FilterDropdown } from "./home/FilterDropdown";
import ToastNotification from "./home/ToastNotification";
import { useQuickEdit } from "./useQuickEdit";
import { LibraryHeader } from "./home/LibraryHeader";
import { LibraryGrid } from "./home/LibraryGrid";
import { ActiveVideoOverlay } from "./home/ActiveVideoOverlay";
import { AniListSearchPanel } from "./home/AniListSearchPanel";
import type { ActiveVideo } from "../../lib/types/video";

export default function LibraryPage() {
  const {
    entries,
    status,
    progress,
    error,
    folder,
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
  const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null);
  const navigate = useNavigate();

  const { playbackHistory, loadHistory } = usePlaybackHistory();

  // Player session for the active video overlay
  const playerEntry = useMemo(
    () =>
      activeVideo
        ? (entries.find((e) =>
            e.files.some((f: any) => f.path === activeVideo.path),
          ) ?? null)
        : null,
    [activeVideo, entries],
  );

  useEffect(() => {
    loadHistory();
  }, []);

  const releaseGroups = useMemo(() => {
    const groups = new Set<string>();
    entries.forEach((e) => {
      e.release_groups.forEach((g) => {
        if (g) groups.add(g);
      });
    });
    return Array.from(groups).sort();
  }, [entries]);

  // Stabilize activePlaybackHistory to prevent unnecessary filterEntries recalculations
  // Use a ref to track the previous filtered result and only recompute when the
  // relevant IDs actually change (not just when arrays get new references).
  const activePlaybackHistoryRef = useRef<PlaybackHistoryEntry[]>([]);
  const activePlaybackHistory = useMemo(() => {
    // Create a Set of all file paths in current entries for O(1) lookup
    const entryFilePaths = new Set<string>();
    entries.forEach((e) =>
      e.files.forEach((f: any) => entryFilePaths.add(f.path)),
    );

    // Filter playback history using the Set
    const filtered = playbackHistory.filter((item) =>
      entryFilePaths.has(item.file_path),
    );

    // Only update ref if the content actually changed (by comparing IDs)
    const prev = activePlaybackHistoryRef.current;
    const hasChanged =
      prev.length !== filtered.length ||
      prev.some((item, i) => item.file_path !== filtered[i]?.file_path);

    if (hasChanged) {
      activePlaybackHistoryRef.current = filtered;
    }

    return activePlaybackHistoryRef.current;
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

  const qvEntry = useMemo(
    () => entries.find((e) => e.key === quickViewKey) ?? null,
    [entries, quickViewKey],
  );

  const {
    editStatus: qvEditStatus,
    setEditStatus: setQvEditStatus,
    editProgress: qvEditProgress,
    setEditProgress: setQvEditProgress,
    editScore: qvEditScore,
    setEditScore: setQvEditScore,
    editNotes: qvEditNotes,
    setEditNotes: setQvEditNotes,
    editFav: qvEditFav,
    setEditFav: setQvEditFav,
    isSaving: qvIsSaving,
    justSaved: qvJustSaved,
    handleSave: qvHandleSave,
  } = useQuickEdit({
    syncKey: quickViewKey,
    getUserData: () => qvEntry?.user ?? null,
    entryKey: qvEntry?.key ?? null,
    mediaId: (qvEntry?.media as any)?.id,
  });

  const matchedEntries = useMemo(
    () => entries.filter((e) => e.matched && e.episode_count > 0),
    [entries],
  );
  const totalEps = matchedEntries.reduce((n, e) => n + e.episode_count, 0);
  const needReview = entries.filter(
    (e) => !e.matched && e.episode_count > 0,
  ).length;
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

  const handleSaveProgress = async (episode: number, status: string) => {
    if (!playerEntry) return;
    const baseUser = playerEntry.user ?? {
      status: null,
      score: null,
      progress: 0,
      notes: null,
      favorite: false,
    };
    await saveUserData(playerEntry.key, {
      ...baseUser,
      progress: episode,
      status,
    });
    if (playerEntry.media?.id) {
      await syncProgressToAnilist(
        playerEntry.media.id,
        episode,
        status === "Completed",
        status,
      );
    }
  };

  return (
    <div className="h-full overflow-y-auto px-6 pt-3 pb-10">
      {/* Header - now in LibraryHeader component */}
      <LibraryHeader
        folder={folder}
        matchedEntries={matchedEntries}
        totalEps={totalEps}
        needReview={needReview}
        showStats={showStats}
        setShowStats={setShowStats}
        navigate={navigate}
        error={error}
      />

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
          {/* Grid - now in LibraryGrid component */}
          <LibraryGrid
            entries={entries}
            status={status}
            progress={progress}
            folder={folder}
            cardSize={cardSize}
            query={query}
            statusFilter={statusFilter}
            formatFilter={formatFilter}
            groupFilter={groupFilter}
            sortBy={sortBy}
            currentTab={currentTab}
            busy={busy}
            activeVideo={activeVideo}
            setActiveVideo={setActiveVideo}
            quickViewKey={quickViewKey}
            setQuickViewKey={setQuickViewKey}
            playbackHistory={playbackHistory}
            loadHistory={loadHistory}
            matchedEntries={matchedEntries}
            filteredAndSorted={filteredAndSorted}
          />
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

      {/* Active video overlay - now in ActiveVideoOverlay component */}
      <ActiveVideoOverlay
        activeVideo={activeVideo}
        playerEntry={playerEntry}
        entries={entries}
        onClose={() => {
          setActiveVideo(null);
          loadHistory();
        }}
        onSetActiveVideo={setActiveVideo}
        onSaveProgress={handleSaveProgress}
      />

      {/* Toast notification — bottom-right */}
      <ToastNotification message={toastMsg} />

      {/* Right-click quick view + edit */}
      {qvEntry && (
        <EntryDetailModal
          entry={qvEntry}
          onClose={() => setQuickViewKey(null)}
          variant="quick"
          editStatus={qvEditStatus}
          setEditStatus={setQvEditStatus}
          editProgress={qvEditProgress}
          setEditProgress={setQvEditProgress}
          editScore={qvEditScore}
          setEditScore={setQvEditScore}
          editNotes={qvEditNotes}
          setEditNotes={setQvEditNotes}
          editFav={qvEditFav}
          setEditFav={setQvEditFav}
          isSaving={qvIsSaving}
          justSaved={qvJustSaved}
          onSave={qvHandleSave}
        />
      )}
    </div>
  );
}

// Need to import EntryDetailModal
import EntryDetailModal from "../../components/EntryDetailModal";
