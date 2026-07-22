import {
  useMemo,
  useCallback,
  useEffect,
  useState,
} from "react";
import { ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getTopRatedManga,
  getPopularNewTitles,
  getRecentlyAddedManga,
  getTrendingManga,
  getRecommendedManga,
  getLatestChapterUpdates,
} from "../api";
import type { MangaInfo, ChapterUpdateInfo } from "../api";
import { useLibrary } from "../../../store/library";
/** Default filters: safe/suggestive only, English only, English original. */
const DEFAULT_FILTERS = {
  contentRating: ["safe", "suggestive"],
  translatedLanguage: "en",
  originalLanguage: "en",
};

type TabType =
  | "latest-chapter"
  | "trending"
  | "recommended"
  | "top-rated"
  | "popular-new"
  | "recently-added";

export function LibraryTab() {
  const {
    mangadexContentRating,
    setMangadexContentRating,
    mangadexTranslatedLanguage,
    setMangadexTranslatedLanguage,
  } = useLibrary();

  // Local state for MangaDex browsing — the MangadexSlice store never received
  // these properties, so they're kept as component-level state.
  const [mangadexPage, setMangadexPage] = useState(0);
  const [mangadexSearch, setMangadexSearch] = useState("");
  const [mangadexSortBy] = useState<"rating" | "followed" | "latest">("rating");
  const [mangadexShowOnlyCompleted] = useState(false);
  const [mangadexOriginalLanguage] = useState("en");
  const [mangadexCustomTabs] = useState<
    { id: string; tagId?: string; label: string }[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<(MangaInfo | ChapterUpdateInfo)[]>([]);
  const [selectedTab, setSelectedTab] = useState<TabType>("latest-chapter");

  const _handleLoadTab = useCallback(
    (tab: TabType) => {
      setSelectedTab(tab);
      setMangadexPage(0);
      setResults([]);
    },
    [setMangadexPage],
  );
  // Suppress unused variable errors for dead-code components
  void _handleLoadTab;

  // Build the browse filters from persisted prefs.
  const params = useMemo(() => {
    const filters: Record<string, unknown> = { ...DEFAULT_FILTERS };
    if (mangadexContentRating.length) (filters as any).contentRating = mangadexContentRating;
    if (mangadexTranslatedLanguage) (filters as any).translatedLanguage = mangadexTranslatedLanguage;
    if (mangadexOriginalLanguage) (filters as any).originalLanguage = mangadexOriginalLanguage;
    (filters as any).offset = mangadexPage * 30;

    switch (mangadexSortBy) {
      case "rating":
        (filters as any).order = { rating: "desc" };
        break;
      case "followed":
        (filters as any).order = { followedCount: "desc" };
        break;
      case "latest":
        (filters as any).order = { createdAt: "desc" };
        break;
      default:
        break;
    }

    if (mangadexShowOnlyCompleted) (filters as any).status = ["completed"];

    if (mangadexSearch) {
      (filters as any).title = mangadexSearch;
      (filters as any).order = { relevance: "desc" };
    }

    // Custom tag tabs (genre filters).
    for (const tab of mangadexCustomTabs ?? []) {
      if (tab.tagId) {
        (filters as any).includedTags = [tab.tagId];
      }
    }

    return filters;
  }, [
    mangadexSortBy,
    mangadexShowOnlyCompleted,
    mangadexSearch,
    mangadexContentRating,
    mangadexTranslatedLanguage,
    mangadexOriginalLanguage,
    mangadexPage,
    mangadexCustomTabs,
  ]);

  // Fetch data when tab changes.
  useEffect(() => {
    if (loading) return;

    let cancelled = false;
    setLoading(true);

    const fetcher = async () => {
      try {
        let data: (MangaInfo | ChapterUpdateInfo)[] = [];

        switch (selectedTab) {
          case "latest-chapter":
            data = await getLatestChapterUpdates(30, {
              ...DEFAULT_FILTERS,
              translatedLanguage: mangadexTranslatedLanguage,
              contentRating: mangadexContentRating,
            });
            break;

          case "recommended":
            data = await getRecommendedManga(30, params);
            break;

          case "top-rated":
            data = await getTopRatedManga(30, params);
            break;

          case "popular-new":
            data = await getPopularNewTitles(30, params);
            break;

          case "recently-added":
            data = await getRecentlyAddedManga(30, params);
            break;

          case "trending":
          default:
            data = await getTrendingManga(30, params);
            break;
        }

        if (!cancelled) {
          setResults(data);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch feed:", err);
        if (!cancelled) {
          setResults([]);
          setLoading(false);
        }
      }
    };

    fetcher();
    return () => {
      cancelled = true;
    };
  }, [
    selectedTab,
    loading,
    params,
    mangadexTranslatedLanguage,
    mangadexContentRating,
  ]);

  // Search handler.
  const _handleSearch = (term: string) => {
    setMangadexSearch(term);
    setMangadexPage(0);
  };
  void _handleSearch;

  // Infinite scroll support.
  const handleLoadMore = () => {
    setMangadexPage((p) => p + 1);
  };

  // Tag filter bar state.
  const [showTagBar, setShowTagBar] = useState(false);

  // Note: MangadexToolbar is designed for MangadexPage/useMangadexFeed, not LibraryTab.
  // LibraryTab is currently unused (dead code) — keeping a placeholder that compiles.
  const _toolbarPlaceholder = null;

  return (
    <div className="h-full bg-yuui-bg text-yuui-text">
      {/* Toolbar placeholder — LibraryTab is not wired into any parent */}
      {_toolbarPlaceholder}

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Tags Sidebar */}
          <AnimatePresence>
            {showTagBar && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="fixed inset-0 z-40 bg-black/30"
                  onClick={() => setShowTagBar(false)}
                />

                {/* Slide-over panel */}
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "tween", duration: 0.3 }}
                  className="fixed right-0 top-0 z-50 h-full w-80 bg-yuui-panel border-l border-yuui-border/50 shadow-2xl"
                >
                  <div className="flex h-full flex-col">
                    {/* Header */}
                    <div className="flex shrink-0 items-center justify-between border-b border-yuui-border/50 px-4 py-3">
                      <h2 className="text-lg font-semibold text-yuui-text">
                        Tags & Filters
                      </h2>
                      <button
                        onClick={() => setShowTagBar(false)}
                        className="rounded-lg p-2 text-yuui-muted hover:bg-yuui-hover"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Filter options */}
                    <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">
                      {/* Content Rating */}
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-yuui-text">
                          Content Rating
                        </label>
                        <div className="flex flex-col gap-1.5">
                          {[
                            { label: "Safe", value: "safe" },
                            { label: "Suggestive", value: "suggestive" },
                            { label: "Erotica", value: "erotica" },
                          ].map(({ label, value }) => (
                            <label
                              key={value}
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={mangadexContentRating.includes(value)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setMangadexContentRating([
                                      ...mangadexContentRating,
                                      value,
                                    ]);
                                  } else {
                                    setMangadexContentRating(
                                      mangadexContentRating.filter(
                                        (v: string) => v !== value,
                                      ),
                                    );
                                  }
                                }}
                                className="accent-yuui-accent h-4 w-4"
                              />
                              <span className="text-sm text-yuui-text">
                                {label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Translated Language */}
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-yuui-text">
                          Translated Language
                        </label>
                        <select
                          value={mangadexTranslatedLanguage}
                          onChange={(e) =>
                            setMangadexTranslatedLanguage(e.target.value)
                          }
                          className="w-full rounded-lg border border-yuui-border/50 bg-yuui-bg px-3 py-2 text-sm text-yuui-text"
                        >
                          <option value="en">English</option>
                          <option value="ja">Japanese</option>
                          <option value="fr">French</option>
                          <option value="pt">Portuguese</option>
                          <option value="es">Spanish</option>
                          <option value="de">German</option>
                          <option value="it">Italian</option>
                          <option value="ko">Korean</option>
                          <option value="zh">Chinese</option>
                        </select>
                      </div>

                      {/* Original Language */}
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-yuui-text">
                          Original Language
                        </label>
                        <select
                          value={mangadexOriginalLanguage}
                          onChange={() => {}}
                          className="w-full rounded-lg border border-yuui-border/50 bg-yuui-bg px-3 py-2 text-sm text-yuui-text"
                        >
                          <option value="">Any</option>
                          <option value="en">English</option>
                          <option value="ja">Japanese</option>
                          <option value="fr">French</option>
                          <option value="es">Spanish</option>
                          <option value="de">German</option>
                          <option value="it">Italian</option>
                          <option value="ko">Korean</option>
                          <option value="zh">Chinese</option>
                        </select>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-auto shrink-0 border-t border-yuui-border/50 p-4">
                      <button
                        onClick={() => setShowTagBar(false)}
                        className="w-full rounded-lg bg-yuui-accent py-2.5 text-sm font-semibold text-white"
                      >
                        Apply Filters
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Content */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {/* Manga Grid */}
            <div className="grid gap-3 p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {results.map((manga) => (
                <a
                  key={manga.id}
                  href={`/mangadex/manga/${manga.id}`}
                  className="group rounded-xl bg-yuui-card/70 shadow-lg hover:shadow-xl"
                >
                  <div className="relative overflow-hidden rounded-t-xl">
                    <img
                      src={(manga as MangaInfo).coverUrl || (manga as ChapterUpdateInfo).manga?.coverUrl || "/placeholder-manga.jpg"}
                      alt={(manga as MangaInfo).title || (manga as ChapterUpdateInfo).title || ""}
                      loading="lazy"
                      className="h-56 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold text-yuui-text group-hover:text-yuui-accent">
                      {(manga as MangaInfo).title || (manga as ChapterUpdateInfo).title}
                    </h3>
                    {(manga as MangaInfo).description && (
                      <p className="mt-1 line-clamp-2 text-xs text-yuui-muted">
                        {(manga as MangaInfo).description}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>

            {results.length === 0 && (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <p className="text-lg font-semibold text-yuui-text">
                    No results found
                  </p>
                  <p className="text-sm text-yuui-muted">
                    Try adjusting your filters
                  </p>
                </div>
              </div>
            )}

            {/* Load More */}
            {results.length > 0 && (
              <div className="flex justify-center py-6">
                <button
                  onClick={handleLoadMore}
                  className="inline-flex items-center gap-2 rounded-lg bg-yuui-accent/20 px-4 py-2 text-xs font-semibold text-white hover:bg-yuui-accent/30"
                >
                  Load More
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
