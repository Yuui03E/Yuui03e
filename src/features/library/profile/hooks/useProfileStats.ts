import { useMemo } from "react";
import { fromAniListStatus } from "../../../../lib/anilistStatus";
import type { OnlineEntry } from "../types";

export function useProfileStats(
  onlineEntries: OnlineEntry[],
  listFilter: string,
  searchQuery: string,
) {
  // Locked to Cloud Entries only
  const activeEntries = useMemo(() => {
    return onlineEntries.map((e) => ({
      key: String(e.id),
      title: e.media.title.english || e.media.title.romaji,
      episode_count: e.media.episodes || 12,
      media: {
        id: e.media.id,
        title: e.media.title,
        coverImage: e.media.coverImage,
        format: e.media.format,
        episodes: e.media.episodes,
        duration: e.media.duration,
        genres: e.media.genres,
        countryOfOrigin: e.media.countryOfOrigin,
      },
      user: {
        progress: e.progress,
        status: fromAniListStatus(e.status),
        score: e.score,
      },
    }));
  }, [onlineEntries]);

  // Compute calculated metrics
  const stats = useMemo(() => {
    const totalAnime = activeEntries.length;
    const completedCount = activeEntries.filter((e) => e.user?.status === "Completed").length;
    const totalEpisodes = activeEntries.reduce((sum, e) => sum + (e.user?.progress || 0), 0);
    const totalMinutes = activeEntries.reduce((sum, e) => sum + (e.user?.progress || 0) * (e.media?.duration || 24), 0);
    const daysWatched = (totalMinutes / 1440).toFixed(1);

    const scores = activeEntries
      .map((e) => {
        let sc = e.user?.score || 0;
        if (sc > 10) sc = sc / 10;
        return sc;
      })
      .filter((s) => s > 0);

    const meanScore = scores.length
      ? (scores.reduce((sum, s) => sum + s, 0) / scores.length * 10).toFixed(0) + "%"
      : "0%";

    return {
      totalAnime,
      completedCount,
      totalEpisodes,
      daysWatched,
      meanScore,
    };
  }, [activeEntries]);

  const watchingCount = useMemo(() => activeEntries.filter((e) => e.user?.status === "Watching").length, [activeEntries]);
  const completedCount = useMemo(() => activeEntries.filter((e) => e.user?.status === "Completed").length, [activeEntries]);
  const planningCount = useMemo(() => activeEntries.filter((e) => e.user?.status === "Planning").length, [activeEntries]);

  // Filter middle list
  const filteredMiddleList = useMemo(() => {
    return activeEntries.filter((e) => {
      if (listFilter === "Watching" && e.user?.status !== "Watching") return false;
      if (listFilter === "Completed" && e.user?.status !== "Completed") return false;
      if (listFilter === "Planning" && e.user?.status !== "Planning") return false;

      if (searchQuery.trim()) {
        const titleText = (e.title || "").toLowerCase();
        return titleText.includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [activeEntries, listFilter, searchQuery]);

  return {
    activeEntries,
    stats,
    watchingCount,
    completedCount,
    planningCount,
    filteredMiddleList,
  };
}
