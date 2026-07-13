import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLibrary } from "../../store/library";
import AnimeCard from "../../components/AnimeCard";
import QuickViewModal from "../../components/QuickViewModal";
import VideoPlayerOverlay from "../../components/VideoPlayerOverlay";
import {
  Grid,
  CheckCircle2,
  Heart,
  EyeOff,
  Film,
  ChevronDown,
  Layers,
  Sparkles,
  Search,
  Plus,
  RefreshCw,
  History,
  XCircle,
  Pause,
  Play,
  AlertCircle,
  Loader2,
  Trash2,
  FolderX,
} from "lucide-react";
import { pickMultiplePaths, recentPlayback } from "../../lib/api";

function StatPill({ label, value }: { label: string; value: string | number }) {
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

interface SearchProgressItem {
  current: number;
  total: number;
  title: string;
  status:
    | "searching"
    | "matched"
    | "not_found"
    | "low_confidence"
    | "error"
    | "cancelled";
  message: string | null;
}

function StatusIcon({ status }: { status: SearchProgressItem["status"] }) {
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

/**
 * The single, advanced AniList search panel. Docked to the right edge of the
 * screen, it shows the whole search queue as a scrollable list, highlights the
 * series currently being checked, and exposes Pause / Resume / Cancel.
 */
function AniListSearchPanel({
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
  searchProgress: SearchProgressItem | null;
  searchHistory: SearchProgressItem[];
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
  const rows: (SearchProgressItem & { active?: boolean })[] = [
    ...searchHistory,
  ];
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
                  {isPaused ? "Paused" : "Searching AniList"}
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
  const [playbackHistory, setPlaybackHistory] = useState<any[]>([]);
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

  const loadHistory = async () => {
    try {
      const history = await recentPlayback();
      setPlaybackHistory(history);
    } catch (err) {
      console.error("Failed to load playback history:", err);
    }
  };

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

  const filteredAndSorted = useMemo(() => {
    // Only matched series belong in the Library grid. Unmatched series live in
    // the Review section until the user pins a match for them.
    let list = entries.filter((e) => e.matched && e.episode_count > 0);

    if (query.trim()) {
      const parts = query.split(/\s+/);
      const filters: {
        genres: string[];
        studios: string[];
        years: string[];
        statuses: string[];
        resolutions: string[];
        codecs: string[];
        folders: string[];
        isFavorite: boolean | null;
        text: string[];
      } = {
        genres: [],
        studios: [],
        years: [],
        statuses: [],
        resolutions: [],
        codecs: [],
        folders: [],
        isFavorite: null,
        text: [],
      };

      parts.forEach((part) => {
        const lower = part.toLowerCase();
        if (lower.startsWith("genre:") || lower.startsWith("g:")) {
          const val = part.slice(part.indexOf(":") + 1).toLowerCase();
          if (val) filters.genres.push(val);
        } else if (lower.startsWith("studio:") || lower.startsWith("s:")) {
          const val = part.slice(part.indexOf(":") + 1).toLowerCase();
          if (val) filters.studios.push(val);
        } else if (lower.startsWith("year:") || lower.startsWith("y:")) {
          const val = part.slice(part.indexOf(":") + 1).toLowerCase();
          if (val) filters.years.push(val);
        } else if (lower.startsWith("status:")) {
          const val = part.slice(part.indexOf(":") + 1).toLowerCase();
          if (val) filters.statuses.push(val);
        } else if (
          lower.startsWith("resolution:") ||
          lower.startsWith("res:")
        ) {
          const val = part.slice(part.indexOf(":") + 1).toLowerCase();
          if (val) filters.resolutions.push(val);
        } else if (lower.startsWith("codec:")) {
          const val = part.slice(part.indexOf(":") + 1).toLowerCase();
          if (val) filters.codecs.push(val);
        } else if (lower.startsWith("folder:") || lower.startsWith("path:")) {
          const val = part.slice(part.indexOf(":") + 1).toLowerCase();
          if (val) filters.folders.push(val);
        } else if (
          lower === "is:favorite" ||
          lower === "favorites" ||
          lower === "favorite"
        ) {
          filters.isFavorite = true;
        } else if (lower === "is:unwatched") {
          filters.statuses.push("unwatched");
        } else {
          filters.text.push(lower);
        }
      });

      list = list.filter((e) => {
        // 1. Text filter (Title, Folder, Release Groups, Genres, Studios, Year, Res, Codec, VA)
        if (filters.text.length > 0) {
          const textMatch = filters.text.every((term) => {
            const inTitle = [
              e.media?.title.english,
              e.media?.title.romaji,
              e.media?.title.native,
              e.title,
            ]
              .filter((x): x is string => !!x)
              .some((t) => t.toLowerCase().includes(term));

            const inFolder = e.folder.toLowerCase().includes(term);
            const inGroups = e.release_groups.some((g) =>
              g.toLowerCase().includes(term),
            );
            const inGenres = e.media?.genres?.some((g: string) =>
              g.toLowerCase().includes(term),
            );
            const inStudios = (
              e.media?.studios?.nodes as any[] | undefined
            )?.some((s) => s.name.toLowerCase().includes(term));
            const inYear = e.media?.seasonYear?.toString() === term;
            const inRes = e.files?.some((f: any) =>
              f.resolution?.toLowerCase().includes(term),
            );
            const inCodec = e.files?.some((f: any) =>
              f.codec?.toLowerCase().includes(term),
            );
            const inVA = (
              e.media?.characters?.edges as any[] | undefined
            )?.some(
              (edge) =>
                edge.node?.name?.full?.toLowerCase().includes(term) ||
                edge.voiceActors?.some((va: any) =>
                  va.name?.full?.toLowerCase().includes(term),
                ),
            );

            return (
              inTitle ||
              inFolder ||
              inGroups ||
              inGenres ||
              inStudios ||
              inYear ||
              inRes ||
              inCodec ||
              inVA
            );
          });
          if (!textMatch) return false;
        }

        // 2. Genre filter
        if (filters.genres.length > 0) {
          const hasGenres = filters.genres.every((fg) =>
            e.media?.genres?.some((g: string) => g.toLowerCase().includes(fg)),
          );
          if (!hasGenres) return false;
        }

        // 3. Studio filter
        if (filters.studios.length > 0) {
          const hasStudios = filters.studios.every((fs) =>
            (e.media?.studios?.nodes as any[] | undefined)?.some((s) =>
              s.name.toLowerCase().includes(fs),
            ),
          );
          if (!hasStudios) return false;
        }

        // 4. Year filter
        if (filters.years.length > 0) {
          const matchesYear = filters.years.some((fy) =>
            e.media?.seasonYear?.toString().includes(fy),
          );
          if (!matchesYear) return false;
        }

        // 5. Status filter
        if (filters.statuses.length > 0) {
          const matchesStatus = filters.statuses.every((fs) => {
            if (fs === "unwatched") {
              return (e.user?.progress ?? 0) === 0;
            }
            return e.user?.status?.toLowerCase() === fs;
          });
          if (!matchesStatus) return false;
        }

        // 6. Resolution filter
        if (filters.resolutions.length > 0) {
          const matchesRes = filters.resolutions.every((fr) =>
            e.files?.some((f: any) => f.resolution?.toLowerCase().includes(fr)),
          );
          if (!matchesRes) return false;
        }

        // 7. Codec filter
        if (filters.codecs.length > 0) {
          const matchesCodec = filters.codecs.every((fc) =>
            e.files?.some((f: any) => f.codec?.toLowerCase().includes(fc)),
          );
          if (!matchesCodec) return false;
        }

        // 8. Folder filter
        if (filters.folders.length > 0) {
          const matchesFolder = filters.folders.every((ff) =>
            e.folder.toLowerCase().includes(ff),
          );
          if (!matchesFolder) return false;
        }

        // 9. Favorite filter
        if (filters.isFavorite !== null) {
          if (e.user?.favorite !== filters.isFavorite) return false;
        }

        return true;
      });
    }

    if (statusFilter !== "ALL") {
      list = list.filter((e) => e.user?.status?.toUpperCase() === statusFilter);
    }

    if (formatFilter !== "ALL") {
      list = list.filter((e) => e.media?.format === formatFilter);
    }

    if (groupFilter !== "ALL") {
      list = list.filter((e) => e.release_groups.includes(groupFilter));
    }

    // Apply Smart Collection tabs
    if (currentTab === "COMPLETED") {
      list = list.filter((e) => e.user?.status === "Completed");
    } else if (currentTab === "FAVORITES") {
      list = list.filter((e) => e.user?.favorite);
    } else if (currentTab === "CONTINUE_WATCHING") {
      list = list.filter((e) =>
        e.files.some((f: any) =>
          activePlaybackHistory.some((h) => h.file_path === f.path),
        ),
      );
    } else if (currentTab === "MOVIES_OVAS") {
      list = list.filter(
        (e) =>
          e.media?.format === "MOVIE" ||
          e.media?.format === "OVA" ||
          e.media?.format === "SPECIAL",
      );
    }

    return [...list].sort((a, b) => {
      if (sortBy === "title") {
        const tA =
          a.media?.title.english || a.media?.title.romaji || a.title || "";
        const tB =
          b.media?.title.english || b.media?.title.romaji || b.title || "";
        return tA.localeCompare(tB);
      }
      if (sortBy === "progress") {
        return (b.user?.progress ?? 0) - (a.user?.progress ?? 0);
      }
      if (sortBy === "score") {
        return (b.media?.averageScore ?? 0) - (a.media?.averageScore ?? 0);
      }
      if (sortBy === "size") {
        const sizeA = a.files.reduce((sum, f) => sum + f.size_bytes, 0);
        const sizeB = b.files.reduce((sum, f) => sum + f.size_bytes, 0);
        return sizeB - sizeA;
      }
      return 0;
    });
  }, [
    entries,
    query,
    statusFilter,
    formatFilter,
    groupFilter,
    sortBy,
    currentTab,
  ]);

  const duplicates = useMemo(() => {
    const list: {
      seriesTitle: string;
      episode: number;
      files: {
        path: string;
        file_name: string;
        resolution?: string;
        size_bytes: number;
      }[];
    }[] = [];

    entries.forEach((e) => {
      const epMap: { [ep: number]: any[] } = {};
      e.files.forEach((f: any) => {
        if (f.episode != null) {
          if (!epMap[f.episode]) epMap[f.episode] = [];
          epMap[f.episode].push(f);
        }
      });

      Object.entries(epMap).forEach(([ep, files]) => {
        if (files.length > 1) {
          list.push({
            seriesTitle:
              e.media?.title.english || e.media?.title.romaji || e.title,
            episode: Number(ep),
            files,
          });
        }
      });
    });

    return list;
  }, [entries]);

  const stats = useMemo(() => {
    let totalWatchedEps = 0;
    let totalSize = 0;
    const genres: { [name: string]: number } = {};
    const groups: { [name: string]: number } = {};
    let completedCount = 0;

    entries.forEach((e) => {
      totalWatchedEps += e.user?.progress ?? 0;
      const entrySize = e.files.reduce((sum, f) => sum + f.size_bytes, 0);
      totalSize += entrySize;

      if (e.media?.genres) {
        e.media.genres.forEach((g) => {
          genres[g] = (genres[g] || 0) + 1;
        });
      }

      e.release_groups.forEach((g) => {
        if (g) groups[g] = (groups[g] || 0) + 1;
      });

      if (e.analysis?.completion && e.analysis.completion >= 0.999) {
        completedCount += 1;
      }
    });

    const sortedGenres = Object.entries(genres)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const sortedGroups = Object.entries(groups)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const totalHours = Math.round((totalWatchedEps * 24) / 60);
    const totalDays = (totalHours / 24).toFixed(1);

    const libraryHealth =
      entries.length > 0
        ? Math.round((completedCount / entries.length) * 100)
        : 0;

    return {
      totalDays,
      totalHours,
      totalSize,
      genres: sortedGenres,
      groups: sortedGroups,
      libraryHealth,
    };
  }, [entries]);

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
              className="flex items-center gap-3 cursor-pointer group"
            >
              <StatPill label="Series" value={matchedEntries.length} />
              <StatPill label="Episodes" value={totalEps} />
              <div className="glass rounded-2xl p-3 grid place-items-center transition-colors group-hover:bg-white/[0.08]">
                <ChevronDown
                  className={`h-3.5 w-3.5 text-white transition-transform duration-300 ${showStats ? "rotate-180" : ""}`}
                />
              </div>
            </div>

            <div
              onClick={() => navigate("/review")}
              className={`glass rounded-xl px-3 py-2 cursor-pointer transition-all hover:bg-white/[0.08] hover:scale-[1.02] ${
                needReview > 0
                  ? "border border-yellow-500/40 bg-yellow-500/5 shadow-glow"
                  : ""
              }`}
            >
              <div className="font-display text-lg leading-none text-white">
                {needReview}
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-yuui-muted">
                Review
              </div>
            </div>
          </div>
        </div>

        {/* The live AniList search status now lives in a single docked panel
              on the right side of the screen (see AniListSearchPanel below). */}
        <div className="flex items-center gap-3"></div>
      </div>

      {/* Top Search Toolbar */}
      <div className="flex flex-col gap-2 px-0 pt-2">
        <div className="flex items-center gap-1.5">
          <div className="glass flex flex-1 items-center gap-2 rounded-xl px-3 py-2 min-w-0">
            <Search className="h-3.5 w-3.5 text-yuui-muted shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search by title, genre, studio, resolution, favorites..."
              className="w-full bg-transparent text-xs outline-none placeholder:text-yuui-muted"
            />
            {query && (
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery("");
                }}
                className="text-yuui-muted hover:text-white text-xs px-1 select-none cursor-pointer shrink-0"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={rescan}
            disabled={busy || !folder}
            className="glass rounded-xl px-3 py-2 text-xs transition-colors hover:bg-white/[0.08] disabled:opacity-40"
          >
            <span className="flex items-center gap-1.5">
              <RefreshCw
                className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`}
              />
              Rescan
            </span>
          </button>

          <button
            onClick={async () => {
              const current = folders;
              const paths = await pickMultiplePaths(true);
              if (paths.length === 0) return;
              const dups = paths.filter((p) => current.includes(p));
              const newPaths = paths.filter((p) => !current.includes(p));
              if (newPaths.length > 0) await addPaths(newPaths);
              if (dups.length > 0) {
                const msg = dups.length === 1
                  ? `"${dups[0].split("\\").pop()?.split("/").pop() ?? dups[0]}" is already in your library`
                  : `${dups.length} folders already exist in your library`;
                setToastMsg(msg);
                setTimeout(() => setToastMsg(null), 3500);
              }
            }}
            disabled={busy}
            className="glass rounded-xl px-3 py-2 text-xs transition-all duration-300 disabled:opacity-40 cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/15 hover:text-emerald-400 hover:shadow-[0_0_12px_rgba(16,185,129,0.5)]"
          >
            <span className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Folder
            </span>
          </button>

          {/* Remove Folder button */}
          {folders.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setRemoveFolderOpen(!removeFolderOpen)}
                className={`glass rounded-xl px-3 py-2 text-xs transition-all duration-300 disabled:opacity-40 cursor-pointer ${
                  removeFolderOpen
                    ? "border-red-500/80 bg-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.6)]"
                    : "hover:border-red-500/50 hover:bg-red-500/15 hover:text-red-400 hover:shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                }`}
                title="Remove a folder"
              >
                <span className="flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </span>
              </button>

              {removeFolderOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setRemoveFolderOpen(false)}
                  />
                  <div className="absolute top-full mt-1.5 right-0 min-w-[240px] bg-black rounded-2xl p-1 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/15 flex flex-col gap-0.5">
                    {folders.map((p) => (
                      <button
                        key={p}
                        onClick={async () => {
                          await removePath(p);
                          setRemoveFolderOpen(false);
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left text-white/80 hover:bg-red-500/10 hover:text-red-400 transition-all cursor-pointer"
                      >
                        <FolderX className="h-3.5 w-3.5 shrink-0 text-red-400/60" />
                        <span className="truncate" title={p}>
                          {p}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <AnimatePresence>
          {searchFocused && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex flex-wrap items-center gap-2 px-1 text-[11px] text-yuui-muted"
            >
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-yuui-accent" /> Filter
                suggestions:
              </span>
              {[
                { label: "favorites", val: "favorites" },
                { label: "genre:Action", val: "genre:Action" },
                { label: "studio:Trigger", val: "studio:Trigger" },
                { label: "year:2018", val: "year:2018" },
                { label: "res:1080p", val: "res:1080p" },
                { label: "codec:h265", val: "codec:h265" },
              ].map((s) => (
                <button
                  key={s.label}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setQuery((prev) => {
                      const trimmed = prev.trim();
                      return trimmed ? `${trimmed} ${s.val}` : s.val;
                    });
                  }}
                  className="glass px-2 py-0.5 rounded-md hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer text-[10px]"
                >
                  {s.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Smart Collections Tabs */}
      <div className="flex items-center gap-1.5 px-0 mt-3 border-b border-white/[0.04] pb-2 overflow-x-auto scrollbar-none">
        {[
          { id: "ALL", label: "All Titles", icon: Grid },
          {
            id: "CONTINUE_WATCHING",
            label: "Continue Watching",
            icon: History,
          },
          { id: "COMPLETED", label: "Completed", icon: CheckCircle2 },
          { id: "FAVORITES", label: "Favorites", icon: Heart },
          { id: "MOVIES_OVAS", label: "Movies & OVAs", icon: Film },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold select-none transition-all cursor-pointer border ${
                currentTab === tab.id
                  ? "bg-yuui-accent/15 text-yuui-accent border-yuui-accent/30 font-bold font-sans"
                  : "text-yuui-muted hover:text-white border-transparent hover:bg-white/[0.02] font-sans"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

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

      {/* Filter selectors grid */}
      <div className="flex flex-col gap-2 px-0 py-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="glass rounded-2xl px-3 py-1.5 flex items-center justify-between border border-white/[0.04]">
            <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider mr-2 shrink-0">
              Card Size
            </span>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="range"
                min="140"
                max="260"
                value={cardSize}
                onChange={(e) => setCardSize(Number(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent"
              />
              <span className="text-[10px] text-white font-semibold font-mono w-8 text-right shrink-0">
                {cardSize}px
              </span>
            </div>
          </div>

          {/* Status Dropdown */}
          <div className="relative">
            <div
              onClick={() =>
                setActiveDropdown(activeDropdown === "status" ? null : "status")
              }
              className="glass rounded-2xl px-3 py-1.5 flex items-center justify-between gap-2 border border-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer text-xs select-none"
            >
              <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">
                Status
              </span>
              <span className="flex items-center gap-1 text-xs text-white font-semibold capitalize">
                {statusFilter === "ALL" ? "All" : statusFilter.toLowerCase()}
                <ChevronDown className="h-3 w-3 text-yuui-muted" />
              </span>
            </div>

            {activeDropdown === "status" && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setActiveDropdown(null)}
                />
                <div className="absolute top-full mt-1.5 right-0 min-w-full w-max max-w-[200px] bg-black rounded-2xl p-1 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/15 flex flex-col gap-0.5">
                  {[
                    { val: "ALL", label: "All" },
                    { val: "WATCHING", label: "Watching" },
                    { val: "COMPLETED", label: "Completed" },
                    { val: "PLANNING", label: "Planning" },
                    { val: "PAUSED", label: "Paused" },
                    { val: "DROPPED", label: "Dropped" },
                  ].map((opt) => (
                    <div
                      key={opt.val}
                      onClick={() => {
                        setStatusFilter(opt.val);
                        setActiveDropdown(null);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:bg-white/[0.04] ${
                        statusFilter === opt.val
                          ? "text-accent bg-accent/15 font-bold"
                          : "text-neutral-300 hover:text-white"
                      }`}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Format Dropdown */}
          <div className="relative">
            <div
              onClick={() =>
                setActiveDropdown(activeDropdown === "format" ? null : "format")
              }
              className="glass rounded-2xl px-3 py-1.5 flex items-center justify-between gap-2 border border-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer text-xs select-none"
            >
              <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">
                Format
              </span>
              <span className="flex items-center gap-1 text-xs text-white font-semibold">
                {formatFilter === "ALL" ? "All" : formatFilter}
                <ChevronDown className="h-3 w-3 text-yuui-muted" />
              </span>
            </div>

            {activeDropdown === "format" && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setActiveDropdown(null)}
                />
                <div className="absolute top-full mt-1.5 right-0 min-w-full w-max max-w-[200px] bg-black rounded-2xl p-1 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/15 flex flex-col gap-0.5">
                  {[
                    { val: "ALL", label: "All" },
                    { val: "TV", label: "TV" },
                    { val: "MOVIE", label: "Movie" },
                    { val: "OVA", label: "OVA" },
                    { val: "ONA", label: "ONA" },
                    { val: "SPECIAL", label: "Special" },
                  ].map((opt) => (
                    <div
                      key={opt.val}
                      onClick={() => {
                        setFormatFilter(opt.val);
                        setActiveDropdown(null);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:bg-white/[0.04] ${
                        formatFilter === opt.val
                          ? "text-accent bg-accent/15 font-bold"
                          : "text-neutral-300 hover:text-white"
                      }`}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Group Dropdown */}
          <div className="relative">
            <div
              onClick={() =>
                setActiveDropdown(activeDropdown === "group" ? null : "group")
              }
              className="glass rounded-2xl px-3 py-1.5 flex items-center justify-between gap-2 border border-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer text-xs select-none"
            >
              <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">
                Group
              </span>
              <span className="flex items-center gap-1 text-xs text-white font-semibold truncate max-w-[80px]">
                {groupFilter === "ALL" ? "All" : groupFilter}
                <ChevronDown className="h-3 w-3 text-yuui-muted" />
              </span>
            </div>

            {activeDropdown === "group" && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setActiveDropdown(null)}
                />
                <div className="absolute top-full mt-1.5 right-0 min-w-full w-max max-w-[200px] bg-black rounded-2xl p-1 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/15 flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                  <div
                    onClick={() => {
                      setGroupFilter("ALL");
                      setActiveDropdown(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:bg-white/[0.04] ${
                      groupFilter === "ALL"
                        ? "text-accent bg-accent/15 font-bold"
                        : "text-neutral-300 hover:text-white"
                    }`}
                  >
                    All
                  </div>
                  {releaseGroups.map((g) => (
                    <div
                      key={g}
                      onClick={() => {
                        setGroupFilter(g);
                        setActiveDropdown(null);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:bg-white/[0.04] truncate ${
                        groupFilter === g
                          ? "text-accent bg-accent/15 font-bold"
                          : "text-neutral-300 hover:text-white"
                      }`}
                    >
                      {g}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Sort By Dropdown */}
          <div className="relative">
            <div
              onClick={() =>
                setActiveDropdown(activeDropdown === "sort" ? null : "sort")
              }
              className="glass rounded-2xl px-3 py-1.5 flex items-center justify-between gap-2 border border-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer text-xs select-none"
            >
              <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">
                Sort By
              </span>
              <span className="flex items-center gap-1 text-xs text-white font-semibold capitalize">
                {sortBy === "title"
                  ? "Title"
                  : sortBy === "size"
                    ? "Size"
                    : sortBy}
                <ChevronDown className="h-3 w-3 text-yuui-muted" />
              </span>
            </div>

            {activeDropdown === "sort" && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setActiveDropdown(null)}
                />
                <div className="absolute top-full mt-1.5 right-0 min-w-full w-max max-w-[200px] bg-black rounded-2xl p-1 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/15 flex flex-col gap-0.5">
                  {[
                    { val: "title", label: "Title (A-Z)" },
                    { val: "progress", label: "Progress" },
                    { val: "score", label: "Average Score" },
                    { val: "size", label: "Disk Size" },
                  ].map((opt) => (
                    <div
                      key={opt.val}
                      onClick={() => {
                        setSortBy(opt.val);
                        setActiveDropdown(null);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:bg-white/[0.04] ${
                        sortBy === opt.val
                          ? "text-accent bg-accent/15 font-bold"
                          : "text-neutral-300 hover:text-white"
                      }`}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

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
