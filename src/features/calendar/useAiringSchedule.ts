import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLibrary } from "../../store/library";
import { AiringEpisode, fetchAiringSchedule } from "./api";
import { weekdays } from "./constants";

interface UseAiringScheduleArgs {
  filterMode: "all" | "watchlist" | "library";
  searchQuery: string;
  selectedGenre: string;
  activeTab: number;
}

export function useAiringSchedule({
  filterMode,
  searchQuery,
  selectedGenre,
  activeTab,
}: UseAiringScheduleArgs) {
  const { entries, init } = useLibrary();

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

  return {
    schedule,
    isLoading,
    error,
    inLibraryIds,
    watchlistIds,
    days,
    allGenres,
    filterEpisodes,
    activeDayEpisodes,
    stats,
  };
}
