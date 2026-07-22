import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getPopularNewTitles,
  getTopRatedManga,
  getRecentlyAddedManga,
  getLatestChapterUpdates,
  getRecommendedManga,
  browseManga,
  getCustomListMangaIds,
  getSeasonalKey,
  getSeasonalListId,
} from "../api";
import type { MangaInfo, ChapterUpdateInfo } from "../api";
import type { Tab } from "./types";

const LIMIT = 30;

export interface FeedState {
  items: (MangaInfo | ChapterUpdateInfo)[];
  loadingInitial: boolean;
  fetching: boolean;
  hasMore: boolean;
  offset: number;
  error: string | null;
  loadMore: () => void;
  reload: () => void;
}

interface UseMangadexFeedArgs {
  tab: Tab;
  debouncedSearch: string;
  selectedTags: string[];
  contentRating: string[];
  translatedLanguage: string;
  originalLanguageFilter: string | null;
  /** When true (search/tags active) the feed switches to browse/search mode. */
  browseMode: boolean;
  seasonalSeason?: string;
  seasonalYear?: number;
}

/**
 * Encapsulates the paginated MangaDex feed: featured-less loading of the
 * latest / recent / seasonal / popular / top tabs plus browse/search results,
 * with infinite-scroll "has more" tracking.
 *
 * Stability notes:
 *  - `fetchPage` and `loadMore` are stable for the component lifetime
 *    (they read live state from refs), so the IntersectionObserver in
 *    MangaGrid isn't torn down on every fetch.
 *  - A monotonically increasing `reqId` guards against race conditions
 *    when the user switches tabs mid-fetch: stale responses are discarded.
 *  - Array props (contentRating, selectedTags) are serialized via a stable
 *    key so referential changes don't retrigger the effect.
 */
export function useMangadexFeed({
  tab,
  debouncedSearch,
  selectedTags,
  contentRating,
  translatedLanguage,
  originalLanguageFilter,
  browseMode,
  seasonalSeason,
  seasonalYear,
}: UseMangadexFeedArgs): FeedState {
  const [items, setItems] = useState<(MangaInfo | ChapterUpdateInfo)[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [fetching, setFetching] = useState(false);
  // Start in the loading state so the grid shows a skeleton immediately on
  // first mount instead of flashing the "no results" empty message before
  // the first fetch has a chance to run.
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const defaultSeason = useMemo(() => getSeasonalKey(new Date()), []);
  const seasonName = seasonalSeason ?? defaultSeason.season;
  const seasonYear = seasonalYear ?? defaultSeason.year;

  // Refs holding the latest values so the fetch callback can stay stable.
  const stateRef = useRef({
    tab,
    browseMode,
    debouncedSearch,
    selectedTags,
    contentRating,
    translatedLanguage,
    originalLanguageFilter,
    seasonName,
    seasonYear,
    fetching: false,
    hasMore: true,
    offset: 0,
  });

  // Keep the ref in sync on every render (cheap).
  stateRef.current = {
    tab,
    browseMode,
    debouncedSearch,
    selectedTags,
    contentRating,
    translatedLanguage,
    originalLanguageFilter,
    seasonName,
    seasonYear,
    // these two are updated below whenever the setters fire
    fetching: stateRef.current.fetching,
    hasMore: stateRef.current.hasMore,
    offset: stateRef.current.offset,
  };

  // Race-condition guard: each fetch gets an id; only the newest one
  // is allowed to commit state.
  const reqIdRef = useRef(0);

  const fetchPage = useCallback(
    async (offsetVal: number, isInitial: boolean) => {
      const s = stateRef.current;
      if (s.fetching) return;
      if (!s.hasMore && !isInitial) return;

      const myReqId = ++reqIdRef.current;

      if (isInitial) {
        setLoadingInitial(true);
        setItems([]);
        setHasMore(true);
        stateRef.current.hasMore = true;
        setError(null);
      }
      setFetching(true);
      stateRef.current.fetching = true;

      const filters = {
        contentRating: s.contentRating,
        translatedLanguage: s.translatedLanguage,
        originalLanguage: s.originalLanguageFilter ?? undefined,
        offset: offsetVal,
      };
      const origLangFilter = s.originalLanguageFilter ?? undefined;
      const curTab = s.tab;
      const curBrowse = s.browseMode;
      const curSearch = s.debouncedSearch;
      const curTags = s.selectedTags;

      let seasonalHasMore = false;
      try {
        let newItems: (MangaInfo | ChapterUpdateInfo)[] = [];
        if (curBrowse) {
          newItems = await browseManga({
            title: curSearch.trim() || undefined,
            includedTags: curTags,
            contentRating: s.contentRating,
            translatedLanguage: s.translatedLanguage,
            originalLanguage: origLangFilter,
            limit: LIMIT,
            offset: offsetVal,
          });
        } else if (curTab === "latest") {
          newItems = await getLatestChapterUpdates(LIMIT, filters);
        } else if (curTab === "recent") {
          newItems = await getRecentlyAddedManga(LIMIT, filters);
        } else if (curTab === "recommended") {
          newItems = await getRecommendedManga(LIMIT, filters);
        } else if (curTab === "seasonal") {
          const listId = getSeasonalListId(s.seasonName, s.seasonYear);
          const mangaIds = listId ? await getCustomListMangaIds(listId) : [];

          if (mangaIds.length > 0) {
            const pageIds = mangaIds.slice(offsetVal, offsetVal + LIMIT);
            if (pageIds.length > 0) {
              const resolved = await browseManga({
                contentRating: ["safe", "suggestive", "erotica"],
                limit: pageIds.length,
                ids: pageIds,
              });
              newItems = pageIds
                .map((id) => resolved.find((item) => item.id === id))
                .filter((item): item is MangaInfo => !!item)
                .filter(
                  (m) =>
                    !origLangFilter || m.originalLanguage === origLangFilter,
                );
            }

            if (newItems.length === 0 && offsetVal === 0) {
              let list = await browseManga({
                contentRating: s.contentRating,
                translatedLanguage: s.translatedLanguage,
                originalLanguage: origLangFilter,
                limit: LIMIT,
                offset: offsetVal,
                year: s.seasonYear,
                order: { followedCount: "desc" },
              });
              if (list.length === 0) {
                list = await browseManga({
                  contentRating: s.contentRating,
                  translatedLanguage: s.translatedLanguage,
                  originalLanguage: origLangFilter,
                  limit: LIMIT,
                  offset: offsetVal,
                  year: Math.min(s.seasonYear - 1, 2025),
                  order: { followedCount: "desc" },
                });
              }
              newItems = list;
            }

            seasonalHasMore =
              newItems.length === LIMIT &&
              offsetVal + newItems.length < mangaIds.length;
          } else {
            let list = await browseManga({
              contentRating: s.contentRating,
              translatedLanguage: s.translatedLanguage,
              originalLanguage: origLangFilter,
              limit: LIMIT,
              offset: offsetVal,
              year: s.seasonYear,
              order: { followedCount: "desc" },
            });

            if (list.length === 0 && offsetVal === 0) {
              list = await browseManga({
                contentRating: s.contentRating,
                translatedLanguage: s.translatedLanguage,
                originalLanguage: origLangFilter,
                limit: LIMIT,
                offset: offsetVal,
                year: Math.min(s.seasonYear - 1, 2025),
                order: { followedCount: "desc" },
              });
            }
            newItems = list;
            seasonalHasMore = newItems.length === LIMIT;
          }
        } else if (curTab === "popular") {
          newItems = await getPopularNewTitles(LIMIT, filters);
        } else if (curTab === "top") {
          newItems = await getTopRatedManga(LIMIT, filters);
        }

        // Discard stale responses (e.g. user switched tabs mid-fetch).
        if (myReqId !== reqIdRef.current) return;

        setItems((prev) => (isInitial ? newItems : [...prev, ...newItems]));
        const nextHasMore =
          curTab === "seasonal"
            ? seasonalHasMore
            : curTab === "latest" || curTab === "popular" || curTab === "recommended"
              ? newItems.length > 0
              : newItems.length === LIMIT;
        setHasMore(nextHasMore);
        stateRef.current.hasMore = nextHasMore;
        const nextOffset = offsetVal + LIMIT;
        setOffset(nextOffset);
        stateRef.current.offset = nextOffset;
      } catch (e) {
        console.error("Failed to fetch page", e);
        const msg =
          e instanceof Error ? e.message : "Failed to load manga from MangaDex.";
        if (myReqId === reqIdRef.current) {
          setHasMore(false);
          setError(msg);
        }
        stateRef.current.hasMore = false;
      } finally {
        if (myReqId === reqIdRef.current) {
          setFetching(false);
          setLoadingInitial(false);
        }
        stateRef.current.fetching = false;
      }
    },
    // fetchPage is intentionally stable — it reads live state from refs.
    // seasonName/seasonYear are derived from `new Date()` and never change
    // within a session, so they're safe to omit.
    [],
  );

  // Stable key for array props so referential churn doesn't retrigger.
  const tagsKey = selectedTags.join(",");
  const contentKey = contentRating.join(",");

  // Trigger an initial load whenever inputs change.
  useEffect(() => {
    const isFeedTab = [
      "latest",
      "popular",
      "top",
      "recent",
      "seasonal",
      "recommended",
    ].includes(tab);

    if (isFeedTab || browseMode) {
      fetchPage(0, true);
    } else {
      setItems([]);
      setOffset(0);
      setHasMore(false);
      stateRef.current.offset = 0;
      stateRef.current.hasMore = false;
    }
  }, [
    tab,
    browseMode,
    debouncedSearch,
    tagsKey,
    contentKey,
    translatedLanguage,
    originalLanguageFilter,
    seasonalSeason,
    seasonalYear,
    reloadToken,
    fetchPage,
  ]);

  // Stable loadMore — reads the latest offset from the ref.
  const loadMore = useCallback(() => {
    fetchPage(stateRef.current.offset, false);
  }, [fetchPage]);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  return {
    items,
    loadingInitial,
    fetching,
    hasMore,
    offset,
    error,
    loadMore,
    reload,
  };
}
