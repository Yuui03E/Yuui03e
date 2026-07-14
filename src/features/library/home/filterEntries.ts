import type { StoredEntry } from "../../../lib/types";

/**
 * Pure query-parse + filter + sort for the Library grid. Extracted verbatim
 * from the `filteredAndSorted` useMemo. `activePlaybackHistory` is passed in so
 * the Continue-Watching tab can be evaluated; the calling useMemo intentionally
 * omits it from its dependency array (stale-dep by design).
 */
export function filterEntries(
  entries: StoredEntry[],
  query: string,
  statusFilter: string,
  formatFilter: string,
  groupFilter: string,
  sortBy: string,
  currentTab: string,
  activePlaybackHistory: any[],
): StoredEntry[] {
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
}
