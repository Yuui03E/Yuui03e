import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useLibrary } from "../../store/library";
import { invoke } from "@tauri-apps/api/core";
import AiringCard from "../../components/AiringCard";
import {
  Search,
  Grid,
  Columns4,
  ChevronDown,
  List,
  Sliders,
} from "lucide-react";

interface AiringEpisode {
  id: number;
  airingAt: number;
  episode: number;
  media: {
    id: number;
    title: { romaji: string | null; english: string | null; native: string | null };
    coverImage: { extraLarge: string | null; large: string | null; color: string | null };
    bannerImage: string | null;
    format: string | null;
    season: string | null;
    seasonYear: number | null;
    favourites: number | null;
    genres: string[];
    averageScore: number | null;
    description: string | null;
    episodes: number | null;
    studios: {
      nodes: { id: number; name: string }[];
    } | null;
  };
}

const FIELDS_FRAGMENT = `
  fragment Fields on AiringSchedule {
    id
    airingAt
    episode
    media {
      id
      title { romaji english native }
      coverImage { extraLarge large color }
      bannerImage
      format
      season
      seasonYear
      favourites
      genres
      averageScore
      description
      episodes
      studios(isMain: true) {
        nodes {
          id
          name
        }
      }
    }
  }
`;

async function fetchAiringSchedule(start: number): Promise<AiringEpisode[]> {
  const query = `
    query (
      $start0: Int, $end0: Int,
      $start1: Int, $end1: Int,
      $start2: Int, $end2: Int,
      $start3: Int, $end3: Int,
      $start4: Int, $end4: Int,
      $start5: Int, $end5: Int,
      $start6: Int, $end6: Int
    ) {
      day0: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start0, airingAt_lesser: $end0, sort: TIME) {
          ...Fields
        }
      }
      day1: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start1, airingAt_lesser: $end1, sort: TIME) {
          ...Fields
        }
      }
      day2: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start2, airingAt_lesser: $end2, sort: TIME) {
          ...Fields
        }
      }
      day3: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start3, airingAt_lesser: $end3, sort: TIME) {
          ...Fields
        }
      }
      day4: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start4, airingAt_lesser: $end4, sort: TIME) {
          ...Fields
        }
      }
      day5: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start5, airingAt_lesser: $end5, sort: TIME) {
          ...Fields
        }
      }
      day6: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start6, airingAt_lesser: $end6, sort: TIME) {
          ...Fields
        }
      }
    }
    ${FIELDS_FRAGMENT}
  `;

  const variables: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    variables[`start${i}`] = start + i * 24 * 60 * 60;
    variables[`end${i}`] = start + (i + 1) * 24 * 60 * 60;
  }

  const data = await invoke<any>("graphql_anilist", {
    query,
    variables,
  });

  const list: AiringEpisode[] = [];
  if (data?.data) {
    for (let i = 0; i < 7; i++) {
      const dayEps = data.data[`day${i}`]?.airingSchedules ?? [];
      list.push(...dayEps);
    }
  }
  return list;
}

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function CalendarPage() {
  const { entries, init } = useLibrary();
  const [filterMode, setFilterMode] = useState<"all" | "watchlist" | "library">("all");
  const [layoutMode, setLayoutMode] = useState<"board" | "grid" | "list">("board");
  const [posterWidth, setPosterWidth] = useState(180);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("ALL");
  const [activeTab, setActiveTab] = useState(0);
  const [activeDropdown, setActiveDropdown] = useState<"genre" | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  const start = useMemo(() => Math.floor(new Date().setHours(0, 0, 0, 0) / 1000), []);

  const { data: schedule = [], isLoading, error } = useQuery({
    queryKey: ["airing_schedule", start],
    queryFn: () => fetchAiringSchedule(start),
  });

  const inLibraryIds = useMemo(() => {
    return new Set(entries.map((e) => e.media?.id).filter(Boolean));
  }, [entries]);

  const watchlistIds = useMemo(() => {
    return new Set(
      entries
        .filter((e) => e.user?.status === "Watching" || e.user?.status === "Planning")
        .map((e) => e.media?.id)
        .filter(Boolean)
    );
  }, [entries]);

  // Build the list of 7 days starting today
  const days = useMemo(() => {
    const list = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date((start + i * 24 * 60 * 60) * 1000);
      const isToday = i === 0;
      list.push({
        name: isToday ? "Today" : weekdays[date.getDay()],
        dateStr: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        dayIndex: date.getDay(),
        timestamp: start + i * 24 * 60 * 60,
      });
    }
    return list;
  }, [start]);

  // Dynamic Genres extracted from the airing schedule
  const allGenres = useMemo(() => {
    const genresSet = new Set<string>();
    schedule.forEach((ep) => {
      ep.media.genres?.forEach((g) => genresSet.add(g));
    });
    return ["ALL", ...Array.from(genresSet).sort()];
  }, [schedule]);

  // General filtering function applied to an episode list
  const filterEpisodes = (eps: AiringEpisode[]) => {
    let list = eps;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((ep) => {
        const title = ep.media.title.english || ep.media.title.romaji || "";
        return title.toLowerCase().includes(q);
      });
    }

    // Genre filter
    if (selectedGenre !== "ALL") {
      list = list.filter((ep) => ep.media.genres?.includes(selectedGenre));
    }

    // Library status filter
    if (filterMode === "library") {
      list = list.filter((ep) => inLibraryIds.has(ep.media.id));
    } else if (filterMode === "watchlist") {
      list = list.filter((ep) => watchlistIds.has(ep.media.id));
    }

    return list;
  };

  // Timeline (Single Day Focus) episodes
  const activeDayEpisodes = useMemo(() => {
    if (schedule.length === 0) return [];
    const activeDay = days[activeTab];
    const dayStart = activeDay.timestamp;
    const dayEnd = dayStart + 24 * 60 * 60;
    const rawEpisodes = schedule.filter((ep) => ep.airingAt >= dayStart && ep.airingAt < dayEnd);
    return filterEpisodes(rawEpisodes);
  }, [schedule, activeTab, days, searchQuery, selectedGenre, filterMode, inLibraryIds, watchlistIds]);

  // Weekly Stats
  const stats = useMemo(() => {
    const activeSchedule = filterEpisodes(schedule);
    const countInLibrary = activeSchedule.filter((ep) => inLibraryIds.has(ep.media.id)).length;
    const countInWatchlist = activeSchedule.filter((ep) => watchlistIds.has(ep.media.id)).length;
    return {
      total: activeSchedule.length,
      library: countInLibrary,
      watchlist: countInWatchlist,
    };
  }, [schedule, searchQuery, selectedGenre, filterMode, inLibraryIds, watchlistIds]);

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
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 mt-4 pb-2 border-b border-white/[0.04]">
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Library Filters */}
          <div className="flex items-center gap-1.5 rounded-2xl bg-white/[0.03] p-1 border border-white/[0.04] select-none">
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                filterMode === "all"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-yuui-muted hover:text-white"
              }`}
            >
              All Airing
            </button>
            <button
              onClick={() => setFilterMode("watchlist")}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                filterMode === "watchlist"
                  ? "bg-yuui-accent3/15 text-yuui-accent3 border border-yuui-accent3/20"
                  : "text-yuui-muted hover:text-white"
              }`}
            >
              My Watchlist
            </button>
            <button
              onClick={() => setFilterMode("library")}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                filterMode === "library"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "text-yuui-muted hover:text-white"
              }`}
            >
              In Library
            </button>
          </div>

          {/* Genre Dropdown */}
          <div className="relative">
            <div
              onClick={() => setActiveDropdown(activeDropdown === "genre" ? null : "genre")}
              className="glass rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 border border-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer text-xs select-none"
            >
              <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">Genre:</span>
              <span className="flex items-center gap-1 text-white font-semibold capitalize">
                {selectedGenre === "ALL" ? "All" : selectedGenre}
                <ChevronDown className="h-3 w-3 text-yuui-muted" />
              </span>
            </div>

            {activeDropdown === "genre" && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                <div className="absolute top-full mt-1.5 left-0 min-w-[150px] max-h-[300px] overflow-y-auto bg-black rounded-2xl p-1 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/15 flex flex-col gap-0.5 scrollbar-none">
                  {allGenres.map((genre) => (
                    <div
                      key={genre}
                      onClick={() => {
                        setSelectedGenre(genre);
                        setActiveDropdown(null);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:bg-white/[0.04] ${
                        selectedGenre === genre
                          ? "text-yuui-accent3 bg-yuui-accent3/15 font-bold"
                          : "text-neutral-300 hover:text-white"
                      }`}
                    >
                      {genre === "ALL" ? "All Genres" : genre}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right side: Search bar, Slider, & Layout Toggles */}
        <div className="flex flex-wrap items-center gap-3 flex-1 sm:flex-initial">
          {/* Title Search Input */}
          <div className="glass flex items-center gap-2 rounded-xl px-3 py-1.5 min-w-0 flex-1 sm:w-56">
            <Search className="h-3.5 w-3.5 text-yuui-muted shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search weekly schedule..."
              className="w-full bg-transparent text-xs outline-none placeholder:text-yuui-muted"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-yuui-muted hover:text-white text-xs px-1 select-none cursor-pointer shrink-0"
              >
                ✕
              </button>
            )}
          </div>

          {/* Poster Size Slider */}
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-1.5 text-xs text-yuui-muted select-none">
            <Sliders className="h-3.5 w-3.5 text-yuui-muted" />
            <span className="font-semibold text-[10px] uppercase tracking-wider hidden md:inline">Poster:</span>
            <input
              type="range"
              min="120"
              max="360"
              step="10"
              value={posterWidth}
              onChange={(e) => setPosterWidth(Number(e.target.value))}
              className="w-16 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent focus:outline-none"
            />
            <span className="font-mono text-[10px] text-white font-bold w-9 text-right shrink-0">{posterWidth}px</span>
          </div>

          {/* Labeled Layout Selector Toggles */}
          <div className="flex items-center gap-0.5 rounded-xl bg-white/[0.03] p-1 border border-white/[0.04] select-none text-[10px] font-bold text-yuui-muted">
            <button
              onClick={() => setLayoutMode("board")}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                layoutMode === "board" ? "bg-white/10 text-white shadow-sm" : "hover:text-white"
              }`}
              title="7 Days Kanban Grid Schedule"
            >
              <Columns4 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Weekly Board</span>
            </button>
            <button
              onClick={() => setLayoutMode("grid")}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                layoutMode === "grid" ? "bg-white/10 text-white shadow-sm" : "hover:text-white"
              }`}
              title="Daily Movie Poster Grid View"
            >
              <Grid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Daily Grid</span>
            </button>
            <button
              onClick={() => setLayoutMode("list")}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                layoutMode === "list" ? "bg-white/10 text-white shadow-sm" : "hover:text-white"
              }`}
              title="Daily Detailed List Cards View"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Daily List</span>
            </button>
          </div>
        </div>
      </div>

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
              <div className="h-full w-full overflow-x-auto px-6 py-4 flex gap-4 items-start scrollbar-none select-none">
                {days.map((day, i) => {
                  const dayStart = day.timestamp;
                  const dayEnd = dayStart + 24 * 60 * 60;
                  const dayEpisodes = schedule.filter((ep) => ep.airingAt >= dayStart && ep.airingAt < dayEnd);
                  const filteredDayEpisodes = filterEpisodes(dayEpisodes);
                  const isToday = i === 0;

                  return (
                    <div
                      key={day.timestamp}
                      className={`w-[290px] shrink-0 flex flex-col h-full rounded-2xl border p-3 ${
                        isToday
                          ? "bg-yuui-accent/5 border-yuui-accent/20"
                          : "bg-white/[0.01] border-white/[0.03]"
                      }`}
                    >
                      {/* Day Header */}
                      <div className="flex items-center justify-between mb-3 shrink-0">
                        <div>
                          <h3 className={`font-display text-sm font-bold ${isToday ? "text-yuui-accent" : "text-white"}`}>
                            {day.name}
                          </h3>
                          <span className="text-[10px] text-yuui-muted font-medium block mt-0.5">
                            {day.dateStr}
                          </span>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${
                          isToday ? "bg-yuui-accent/20 text-yuui-accent" : "bg-white/5 text-white/50"
                        }`}>
                          {filteredDayEpisodes.length}
                        </span>
                      </div>

                      {/* Day Episodes list */}
                      <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 scrollbar-none">
                        {filteredDayEpisodes.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-20 text-center">
                            <span className="text-xl opacity-30">💤</span>
                            <span className="text-[10px] text-yuui-muted mt-1.5">No airings</span>
                          </div>
                        ) : (
                          <motion.div layout className="space-y-2.5">
                            <AnimatePresence mode="popLayout">
                              {filteredDayEpisodes.map((ep) => (
                                <motion.div
                                  key={ep.id}
                                  layout
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <AiringCard
                                    ep={ep}
                                    inLibrary={inLibraryIds.has(ep.media.id)}
                                    cardStyle="board"
                                    posterWidth={posterWidth}
                                  />
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ================== DAILY FOCUS GRID & LIST VIEW ================== */
              <div className="h-full w-full flex flex-col overflow-hidden">
                {/* Weekday Selector Tabs */}
                <div className="flex gap-2 border-b border-white/[0.04] px-6 py-3 shrink-0 overflow-x-auto select-none scrollbar-none">
                  {days.map((day, i) => {
                    const isActive = activeTab === i;
                    const dayStart = day.timestamp;
                    const dayEnd = dayStart + 24 * 60 * 60;
                    const dayEpsCount = filterEpisodes(
                      schedule.filter((ep) => ep.airingAt >= dayStart && ep.airingAt < dayEnd)
                    ).length;

                    return (
                      <button
                        key={day.timestamp}
                        onClick={() => setActiveTab(i)}
                        className={`relative flex flex-col items-center px-5 py-2 rounded-xl transition-all cursor-pointer ${
                          isActive ? "text-white" : "text-yuui-muted hover:text-white"
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="calendar-tab-active"
                            className="absolute inset-0 bg-white/[0.06] rounded-xl border border-white/5"
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                          />
                        )}
                        <span className="text-xs font-semibold relative z-10">{day.name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5 relative z-10">
                          <span className="text-[9px]">{day.dateStr}</span>
                          {dayEpsCount > 0 && (
                            <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[8px] font-bold font-mono">
                              {dayEpsCount}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Day Episodes Grid/List */}
                <div className="flex-1 overflow-y-auto px-6 py-6">
                  {activeDayEpisodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                      <div className="text-5xl">💤</div>
                      <p className="text-yuui-muted font-medium text-sm">
                        No scheduled episodes airing on this day matching the filters.
                      </p>
                    </div>
                  ) : (
                    <motion.div 
                      layout
                      className="grid gap-6 pb-10"
                      style={{
                        gridTemplateColumns: `repeat(auto-fill, minmax(${
                          layoutMode === "grid" ? posterWidth + 40 : posterWidth + 240
                        }px, 1fr))`,
                      }}
                    >
                      <AnimatePresence mode="popLayout">
                        {activeDayEpisodes.map((ep) => (
                          <motion.div
                            key={ep.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -8 }}
                            transition={{ duration: 0.25 }}
                          >
                            <AiringCard
                              ep={ep}
                              inLibrary={inLibraryIds.has(ep.media.id)}
                              cardStyle={layoutMode}
                              posterWidth={posterWidth}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
