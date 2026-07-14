import type { StoredEntry } from "../../../lib/types";

/** Find episodes that have more than one video file (duplicate detection). */
export function computeDuplicates(entries: StoredEntry[]) {
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
}

/** Aggregate library-wide watch/storage/genre/health statistics. */
export function computeStats(entries: StoredEntry[]) {
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
}
