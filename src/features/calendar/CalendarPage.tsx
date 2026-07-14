import { useState } from "react";
import { motion } from "framer-motion";
import { useAiringSchedule } from "./useAiringSchedule";
import CalendarToolbar from "./CalendarToolbar";
import WeeklyBoard from "./WeeklyBoard";
import DailyView from "./DailyView";

export default function CalendarPage() {
  const [filterMode, setFilterMode] = useState<"all" | "watchlist" | "library">("all");
  const [layoutMode, setLayoutMode] = useState<"board" | "grid" | "list">("board");
  const [posterWidth, setPosterWidth] = useState(180);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("ALL");
  const [activeTab, setActiveTab] = useState(0);

  const {
    schedule,
    isLoading,
    error,
    inLibraryIds,
    days,
    allGenres,
    filterEpisodes,
    activeDayEpisodes,
    stats,
  } = useAiringSchedule({ filterMode, searchQuery, selectedGenre, activeTab });

  return (
    <div className="flex h-full flex-col pt-5">
      {/* Top Banner Header */}
      <div className="flex flex-col gap-1 px-6">
        <div className="flex flex-wrap items-center gap-3">
          <motion.h1
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="font-display text-4xl font-bold flex flex-wrap items-center gap-3.5"
          >
            Airing <span className="text-gradient">Calendar</span>

            {/* Inline Mini Stats Badges */}
            <div className="flex items-center gap-1.5 select-none font-sans text-xs font-semibold mt-1">
              <span className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.05] rounded-full px-2.5 py-0.5 text-yuui-muted">
                airing <strong className="text-white font-bold font-mono">{stats.total}</strong>
              </span>
              <span className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.05] rounded-full px-2.5 py-0.5 text-yuui-muted">
                library <strong className="text-accent font-bold font-mono">{stats.library}</strong>
              </span>
              <span className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.05] rounded-full px-2.5 py-0.5 text-yuui-muted">
                watchlist <strong className="text-accent2 font-bold font-mono">{stats.watchlist}</strong>
              </span>
            </div>
          </motion.h1>
        </div>
        <p className="text-xs text-yuui-muted">
          Track weekly airing episodes and sync them directly with your library.
        </p>
      </div>

      {/* Controls Toolbar (Filters, Search, Views) */}
      <CalendarToolbar
        filterMode={filterMode}
        setFilterMode={setFilterMode}
        selectedGenre={selectedGenre}
        setSelectedGenre={setSelectedGenre}
        allGenres={allGenres}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        posterWidth={posterWidth}
        setPosterWidth={setPosterWidth}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-4 py-24 absolute inset-0">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-yuui-accent" />
            <p className="text-sm text-yuui-muted">Loading weekly airing schedule...</p>
          </div>
        )}

        {error && (
          <div className="px-6 py-6 absolute inset-0">
            <div className="glass rounded-2xl border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              Failed to load airing schedule: {String(error)}
            </div>
          </div>
        )}        {!isLoading && !error && (
          <div className="h-full w-full overflow-hidden">
            {layoutMode === "board" ? (
              /* ================== WEEKLY BOARD VIEW ================== */
              <WeeklyBoard
                days={days}
                schedule={schedule}
                filterEpisodes={filterEpisodes}
                inLibraryIds={inLibraryIds}
                posterWidth={posterWidth}
              />
            ) : (
              /* ================== DAILY FOCUS GRID & LIST VIEW ================== */
              <DailyView
                days={days}
                schedule={schedule}
                filterEpisodes={filterEpisodes}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                activeDayEpisodes={activeDayEpisodes}
                inLibraryIds={inLibraryIds}
                posterWidth={posterWidth}
                layoutMode={layoutMode}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
