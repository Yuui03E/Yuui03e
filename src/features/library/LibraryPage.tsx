import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLibrary } from "../../store/library";
import AnimeCard from "../../components/AnimeCard";

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass rounded-2xl px-4 py-3">
      <div className="font-display text-xl leading-none text-white">
        {value}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-yuui-muted">
        {label}
      </div>
    </div>
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
    chooseFolder,
    rescan,
    cardSize,
    setCardSize,
  } = useLibrary();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [formatFilter, setFormatFilter] = useState("ALL");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("title");
  const [showStats, setShowStats] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    init();
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

  const filteredAndSorted = useMemo(() => {
    let list = entries;

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((e) => {
        const t = [
          e.media?.title.english,
          e.media?.title.romaji,
          e.media?.title.native,
          e.title,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return t.includes(q);
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

    return [...list].sort((a, b) => {
      if (sortBy === "title") {
        const tA = a.media?.title.english || a.media?.title.romaji || a.title || "";
        const tB = b.media?.title.english || b.media?.title.romaji || b.title || "";
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
  }, [entries, query, statusFilter, formatFilter, groupFilter, sortBy]);

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

      if (e.analysis?.completion && e.analysis.completion >= 100) {
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

    const libraryHealth = entries.length > 0
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

  const totalEps = entries.reduce((n, e) => n + e.episode_count, 0);
  const needReview = entries.filter((e) => !e.matched).length;
  const busy = status === "scanning" || status === "matching";

  return (
    <div className="flex h-full flex-col pt-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 px-6">
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

        <div className="flex items-center gap-3">
          <div
            onClick={() => setShowStats(!showStats)}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <StatPill label="Series" value={entries.length} />
            <StatPill label="Episodes" value={totalEps} />
            <div className="glass rounded-2xl p-3 grid place-items-center transition-colors group-hover:bg-white/[0.08]">
              <span className={`text-white text-xs transition-transform duration-300 ${showStats ? "rotate-180" : ""}`}>
                ▼
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate("/review")}
            className={`glass rounded-2xl px-4 py-3 text-left transition-colors hover:bg-white/[0.08] ${
              needReview > 0 ? "ring-1 ring-yellow-500/40" : ""
            }`}
          >
            <div className="font-display text-xl leading-none text-white">
              {needReview}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-yuui-muted">
              Review
            </div>
          </button>
        </div>
      </div>

      {/* Stats Dashboard slide-down */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden px-8 mt-4"
          >
            <div className="glass rounded-3xl border border-white/[0.06] bg-yuui-surface/40 p-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">Watch Time</span>
                <div className="mt-2 text-2xl font-bold font-display text-white">
                  {stats.totalDays} <span className="text-xs font-semibold text-yuui-muted font-sans">Days</span>
                </div>
                <p className="mt-1 text-xs text-yuui-muted">{stats.totalHours} total hours watched</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">Storage Size</span>
                <div className="mt-2 text-2xl font-bold font-display text-white">
                  {(stats.totalSize / (1024 * 1024 * 1024)).toFixed(1)} <span className="text-xs font-semibold text-yuui-muted font-sans">GB</span>
                </div>
                <p className="mt-1 text-xs text-yuui-muted">
                  {(stats.totalSize / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB in library folder
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">Top Genres</span>
                <div className="mt-2 space-y-1">
                  {stats.genres.map(([genre, count]) => (
                    <div key={genre} className="flex items-center justify-between text-xs">
                      <span className="text-white/80">{genre}</span>
                      <span className="text-yuui-muted font-mono">{count} titles</span>
                    </div>
                  ))}
                  {stats.genres.length === 0 && <p className="text-xs text-yuui-muted">No genres indexed</p>}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">Library Health</span>
                <div className="mt-2 text-2xl font-bold font-display text-white">
                  {stats.libraryHealth}%
                </div>
                <div className="mt-2 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yuui-accent to-yuui-accent2 rounded-full"
                    style={{ width: `${stats.libraryHealth}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-yuui-muted">Percent of fully completed series</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="glass flex flex-1 items-center gap-2 rounded-2xl px-4 py-2.5">
            <span className="text-yuui-muted">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your collection…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-yuui-muted"
            />
          </div>
          <button
            onClick={rescan}
            disabled={busy || !folder}
            className="glass rounded-2xl px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.08] disabled:opacity-40"
          >
            ↻ Rescan
          </button>
          <button
            onClick={chooseFolder}
            disabled={busy}
            className="rounded-2xl bg-gradient-to-r from-yuui-accent to-yuui-accent2 px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.03] disabled:opacity-50"
          >
            + Add Folder
          </button>
        </div>

        {/* Filter selectors grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="glass rounded-2xl px-3 py-1.5 flex items-center justify-between border border-white/[0.04]">
            <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider mr-2 shrink-0">Card Size</span>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="range"
                min="140"
                max="260"
                value={cardSize}
                onChange={(e) => setCardSize(Number(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent"
              />
              <span className="text-[10px] text-white font-semibold font-mono w-8 text-right shrink-0">{cardSize}px</span>
            </div>
          </div>

          <div className="glass rounded-2xl px-3 py-1.5 flex items-center justify-between border border-white/[0.04]">
            <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs text-white outline-none border-none cursor-pointer text-right min-w-[80px]"
            >
              <option value="ALL" className="bg-yuui-panel">All</option>
              <option value="WATCHING" className="bg-yuui-panel">Watching</option>
              <option value="COMPLETED" className="bg-yuui-panel">Completed</option>
              <option value="PLANNING" className="bg-yuui-panel">Planning</option>
              <option value="PAUSED" className="bg-yuui-panel">Paused</option>
              <option value="DROPPED" className="bg-yuui-panel">Dropped</option>
            </select>
          </div>

          <div className="glass rounded-2xl px-3 py-1.5 flex items-center justify-between border border-white/[0.04]">
            <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">Format</span>
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              className="bg-transparent text-xs text-white outline-none border-none cursor-pointer text-right min-w-[80px]"
            >
              <option value="ALL" className="bg-yuui-panel">All</option>
              <option value="TV" className="bg-yuui-panel">TV</option>
              <option value="MOVIE" className="bg-yuui-panel">Movie</option>
              <option value="OVA" className="bg-yuui-panel">OVA</option>
              <option value="ONA" className="bg-yuui-panel">ONA</option>
              <option value="SPECIAL" className="bg-yuui-panel">Special</option>
            </select>
          </div>

          <div className="glass rounded-2xl px-3 py-1.5 flex items-center justify-between border border-white/[0.04]">
            <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">Group</span>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="bg-transparent text-xs text-white outline-none border-none cursor-pointer text-right max-w-[120px]"
            >
              <option value="ALL" className="bg-yuui-panel">All</option>
              {releaseGroups.map((g) => (
                <option key={g} value={g} className="bg-yuui-panel">{g}</option>
              ))}
            </select>
          </div>

          <div className="glass rounded-2xl px-3 py-1.5 flex items-center justify-between border border-white/[0.04]">
            <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">Sort By</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs text-white outline-none border-none cursor-pointer text-right min-w-[80px]"
            >
              <option value="title" className="bg-yuui-panel">Title (A-Z)</option>
              <option value="progress" className="bg-yuui-panel">Progress</option>
              <option value="score" className="bg-yuui-panel">Average Score</option>
              <option value="size" className="bg-yuui-panel">Disk Size</option>
            </select>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 pb-10">
        {error && (
          <div className="glass rounded-2xl border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {busy && (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-yuui-accent" />
            <p className="text-sm text-yuui-muted">{progress}</p>
          </div>
        )}

        {!busy && status === "ready" && filteredAndSorted.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="text-5xl">🌙</div>
            <p className="text-yuui-muted">
              {entries.length === 0
                ? "No anime found in this folder yet."
                : "No results match your search."}
            </p>
          </div>
        )}

        {!busy && filteredAndSorted.length > 0 && (
          <div 
            className="grid gap-5"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`
            }}
          >
            {filteredAndSorted.map((entry, i) => (
              <AnimeCard key={entry.key} entry={entry} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
