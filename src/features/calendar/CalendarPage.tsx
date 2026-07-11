import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useLibrary } from "../../store/library";
import { invoke } from "@tauri-apps/api/core";
import AiringCard from "../../components/AiringCard";

interface AiringEpisode {
  id: number;
  airingAt: number;
  episode: number;
  media: {
    id: number;
    title: { romaji: string | null; english: string | null };
    coverImage: { extraLarge: string | null; large: string | null; color: string | null };
    format: string | null;
    season: string | null;
    seasonYear: number | null;
    favourites: number | null;
  };
}

async function fetchAiringSchedule(start: number, end: number): Promise<AiringEpisode[]> {
  const query = `
    query ($start: Int, $end: Int) {
      Page(page: 1, perPage: 100) {
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
          id
          airingAt
          episode
          media {
            id
            title { romaji english }
            coverImage { extraLarge large color }
            format
            season
            seasonYear
            favourites
          }
        }
      }
    }
  `;

  const data = await invoke<any>("graphql_anilist", {
    query,
    variables: { start, end },
  });

  return data?.data?.Page?.airingSchedules ?? [];
}

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function CalendarPage() {
  const { entries, init } = useLibrary();
  const [filterMode, setFilterMode] = useState<"all" | "watchlist" | "library">("all");

  useEffect(() => {
    init();
  }, [init]);

  const start = useMemo(() => Math.floor(new Date().setHours(0, 0, 0, 0) / 1000), []);
  const end = useMemo(() => start + 7 * 24 * 60 * 60, [start]);

  const { data: schedule = [], isLoading, error } = useQuery({
    queryKey: ["airing_schedule", start, end],
    queryFn: () => fetchAiringSchedule(start, end),
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

  const [activeTab, setActiveTab] = useState(0);

  const activeDayEpisodes = useMemo(() => {
    if (schedule.length === 0) return [];
    const activeDay = days[activeTab];
    const dayStart = activeDay.timestamp;
    const dayEnd = dayStart + 24 * 60 * 60;
    let list = schedule.filter((ep) => ep.airingAt >= dayStart && ep.airingAt < dayEnd);

    if (filterMode === "library") {
      list = list.filter((ep) => inLibraryIds.has(ep.media.id));
    } else if (filterMode === "watchlist") {
      list = list.filter((ep) => watchlistIds.has(ep.media.id));
    }

    return list;
  }, [schedule, activeTab, days, filterMode, inLibraryIds, watchlistIds]);

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
            Airing <span className="text-gradient">Calendar</span>
          </motion.h1>
          <p className="mt-1 text-sm text-yuui-muted">
            Upcoming anime episodes airing over the next 7 days.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 rounded-2xl bg-white/[0.03] p-1 border border-white/[0.04] select-none">
          <button
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
              filterMode === "all"
                ? "bg-white/10 text-white"
                : "text-yuui-muted hover:text-white"
            }`}
          >
            All Airing
          </button>
          <button
            onClick={() => setFilterMode("watchlist")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
              filterMode === "watchlist"
                ? "bg-white/10 text-white"
                : "text-yuui-muted hover:text-white"
            }`}
          >
            My Watchlist
          </button>
          <button
            onClick={() => setFilterMode("library")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
              filterMode === "library"
                ? "bg-white/10 text-white"
                : "text-yuui-muted hover:text-white"
            }`}
          >
            In Library
          </button>
        </div>
      </div>

      {/* Weekday selector tabs */}
      <div className="mt-6 flex gap-2 border-b border-white/[0.04] px-6 pb-3 overflow-x-auto select-none">
        {days.map((day, i) => {
          const isActive = activeTab === i;
          return (
            <button
              key={day.timestamp}
              onClick={() => setActiveTab(i)}
              className={`relative flex flex-col items-center px-4 py-2 rounded-xl transition-colors ${
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
              <span className="text-sm font-semibold relative z-10">{day.name}</span>
              <span className="text-[10px] mt-0.5 relative z-10">{day.dateStr}</span>
            </button>
          );
        })}
      </div>

      {/* Grid of episodes */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-yuui-accent" />
            <p className="text-sm text-yuui-muted">Loading schedule...</p>
          </div>
        )}

        {error && (
          <div className="glass rounded-2xl border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Failed to load airing schedule: {String(error)}
          </div>
        )}

        {!isLoading && !error && activeDayEpisodes.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="text-5xl">💤</div>
            <p className="text-yuui-muted">No scheduled episodes airing on this day.</p>
          </div>
        )}

        {!isLoading && !error && activeDayEpisodes.length > 0 && (
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
            {activeDayEpisodes.map((ep) => {
              const inLibrary = inLibraryIds.has(ep.media.id);
              return <AiringCard key={ep.id} ep={ep} inLibrary={inLibrary} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
