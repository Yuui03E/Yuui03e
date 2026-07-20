import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  getTrendingManga,
  getTags,
  listHistory,
  clearHistory,
  getSeasonalKey,
} from "./api";
import type { MangaInfo, TagInfo, HistoryRow } from "./api";
import { useLibrary } from "../../store/library";
import { loadMangadexSettings } from "../../store/slices/mangadexSlice";
import { useDebounce } from "../../lib/hooks/useDebounce";
import type { Tab } from "./components/types";

import FeaturedCarousel from "./components/FeaturedCarousel";
import MangaGrid from "./components/MangaGrid";
import TagFilterPanel from "./components/TagFilterPanel";
import MangadexToolbar from "./components/MangadexToolbar";
import HistoryTab from "./components/HistoryTab";
import { useMangadexFeed } from "./components/useMangadexFeed";

export default function MangadexPage() {
  const {
    mangadexContentRating,
    mangadexTranslatedLanguage,
    mangadexOriginalLanguageFilter,
    cardSize,
    setCardSize,
  } = useLibrary();

  const [tab, setTab] = useState<Tab>("latest");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);

  // Featured carousel (loaded once)
  const [featured, setFeatured] = useState<MangaInfo[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  // Tags list
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [tagPanelOpen, setTagPanelOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  // Sync selectedTags from URL query parameter
  useEffect(() => {
    const tagParam = searchParams.get("tag");
    if (tagParam) {
      const tagsList = tagParam.split(",").filter(Boolean);
      setSelectedTags((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(tagsList)) {
          return tagsList;
        }
        return prev;
      });
      // Automatically switch to latest/browse if results are shown
      setTab("latest");
    } else {
      setSelectedTags((prev) => (prev.length > 0 ? [] : prev));
    }
  }, [searchParams]);

  // History
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const isResultsView = !!debouncedSearch.trim() || selectedTags.length > 0;

  // Current season state, initialized from today's date.
  const [seasonalSeason, setSeasonalSeason] = useState<string>(() => 
    getSeasonalKey(new Date()).season
  );
  const [seasonalYear, setSeasonalYear] = useState<number>(() => 
    getSeasonalKey(new Date()).year
  );

  const seasonalLabel = useMemo(() => {
    return `${seasonalSeason.charAt(0).toUpperCase() + seasonalSeason.slice(1)} ${seasonalYear}`;
  }, [seasonalSeason, seasonalYear]);

  // Load persisted settings once.
  useEffect(() => {
    loadMangadexSettings().catch(() => {
      // Settings load is best-effort; defaults are already in place.
    });
  }, []);

  // Fetch featured trending manga and tags (on load and filters change)
  useEffect(() => {
    let alive = true;
    setLoadingFeatured(true);
    getTrendingManga(12)
      .then((f) => {
        if (alive) setFeatured(f);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoadingFeatured(false);
      });

    getTags()
      .then((t) => {
        if (alive) setTags(t);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [
    mangadexContentRating,
    mangadexTranslatedLanguage,
    mangadexOriginalLanguageFilter,
  ]);

  const refreshHistory = () => {
    listHistory(50)
      .then(setHistory)
      .catch(() => {});
  };

  // Load history when history tab is opened.
  useEffect(() => {
    if (tab === "history") {
      refreshHistory();
    }
  }, [tab]);

  const feed = useMangadexFeed({
    tab,
    debouncedSearch,
    selectedTags,
    contentRating: mangadexContentRating,
    translatedLanguage: mangadexTranslatedLanguage,
    originalLanguageFilter: mangadexOriginalLanguageFilter,
    browseMode: isResultsView,
    seasonalSeason,
    seasonalYear,
  });

  const toggleTag = (id: string) => {
    const next = selectedTags.includes(id)
      ? selectedTags.filter((x) => x !== id)
      : [...selectedTags, id];
    
    if (next.length > 0) {
      setSearchParams({ tag: next.join(",") });
    } else {
      const copy = new URLSearchParams(searchParams);
      copy.delete("tag");
      setSearchParams(copy);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 pt-5 pb-8 relative">
      {/* Header and Search Input */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h1 className="font-display text-4xl font-bold">
            Manga<span className="text-gradient">Dex</span>
          </h1>
          <p className="mt-1 text-sm text-yuui-muted">
            Browse, read and favorite manga from MangaDex's open catalog.
          </p>
        </motion.div>

        {/* Search bar input field */}
        <div className="relative w-full max-w-xs no-drag">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search MangaDex..."
            className="w-full glass rounded-xl bg-transparent pl-10 pr-4 py-2.5 text-sm outline-none placeholder:text-yuui-muted/50 border border-white/[0.05] focus:border-yuui-accent/40 text-white"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-yuui-muted/60" />
        </div>
      </div>

      {/* Tabs and Toolbar */}
      <MangadexToolbar
        tab={tab}
        setTab={setTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        cardSize={cardSize}
        setCardSize={setCardSize}
        selectedTags={selectedTags}
        tags={tags}
        onToggleTag={toggleTag}
        onOpenFilters={() => setTagPanelOpen(!tagPanelOpen)}
        moreMenuOpen={moreMenuOpen}
        setMoreMenuOpen={setMoreMenuOpen}
        seasonalLabel={seasonalLabel}
        seasonalSeason={seasonalSeason}
        seasonalYear={seasonalYear}
        onSeasonChange={setSeasonalSeason}
        onYearChange={setSeasonalYear}
        filtersOpen={tagPanelOpen}
      />

      <div className="flex gap-6 items-start mt-4">
        <div className="flex-1 min-w-0">
          {isResultsView ? (
            <div>
              <p className="mb-3 text-sm text-yuui-muted">
                {feed.loadingInitial
                  ? "Searching..."
                  : `${feed.items.length} result${feed.items.length !== 1 ? "s" : ""}${selectedTags.length ? ` · ${selectedTags.length} tag filter${selectedTags.length > 1 ? "s" : ""}` : ""}`}
              </p>
              <MangaGrid
                items={feed.items}
                cardSize={cardSize}
                loading={feed.loadingInitial}
                hasMore={feed.hasMore}
                fetching={feed.fetching}
                onLoadMore={feed.loadMore}
                emptyText="No results found. Try a different search or fewer filters."
                error={feed.error}
                onRetry={feed.reload}
              />
            </div>
          ) : (
            <>
              {/* Featured carousel (only on the default landing tab) */}
              {tab === "latest" && (
                <FeaturedCarousel
                  items={featured}
                  loading={loadingFeatured}
                  selectedTags={selectedTags}
                  onToggleTag={toggleTag}
                />
              )}

              {/* ===================== LATEST UPDATES ===================== */}
              {tab === "latest" && (
                <div className="mt-0 flex-1">
                  <MangaGrid
                    items={feed.items}
                    cardSize={cardSize}
                    loading={feed.loadingInitial}
                    hasMore={feed.hasMore}
                    fetching={feed.fetching}
                    onLoadMore={feed.loadMore}
                    emptyText="No recent updates found."
                    error={feed.error}
                    onRetry={feed.reload}
                    showChapterSubtitle
                  />
                </div>
              )}

              {/* ===================== POPULAR NEW ===================== */}
              {tab === "popular" && (
                <div className="mt-0 flex-1">
                  <MangaGrid
                    items={feed.items}
                    cardSize={cardSize}
                    loading={feed.loadingInitial}
                    hasMore={feed.hasMore}
                    fetching={feed.fetching}
                    onLoadMore={feed.loadMore}
                    emptyText="No popular titles found."
                    error={feed.error}
                    onRetry={feed.reload}
                  />
                </div>
              )}

              {/* ===================== TOP RATED ===================== */}
              {tab === "top" && (
                <div className="mt-0 flex-1">
                  <MangaGrid
                    items={feed.items}
                    cardSize={cardSize}
                    loading={feed.loadingInitial}
                    hasMore={feed.hasMore}
                    fetching={feed.fetching}
                    onLoadMore={feed.loadMore}
                    emptyText="No top rated titles found."
                    error={feed.error}
                    onRetry={feed.reload}
                  />
                </div>
              )}

              {/* ===================== RECENTLY ADDED ===================== */}
              {tab === "recent" && (
                <div className="mt-0 flex-1">
                  <MangaGrid
                    items={feed.items}
                    cardSize={cardSize}
                    loading={feed.loadingInitial}
                    hasMore={feed.hasMore}
                    fetching={feed.fetching}
                    onLoadMore={feed.loadMore}
                    emptyText="No recently added titles found."
                    error={feed.error}
                    onRetry={feed.reload}
                  />
                </div>
              )}

              {/* ===================== SEASONAL ===================== */}
              {tab === "seasonal" && (
                <div className="mt-0 flex-1">
                  <MangaGrid
                    items={feed.items}
                    cardSize={cardSize}
                    loading={feed.loadingInitial}
                    hasMore={feed.hasMore}
                    fetching={feed.fetching}
                    onLoadMore={feed.loadMore}
                    emptyText="No seasonal titles found."
                    error={feed.error}
                    onRetry={feed.reload}
                  />
                </div>
              )}

              {/* ===================== RECOMMENDED ===================== */}
              {tab === "recommended" && (
                <div className="mt-0 flex-1">
                  <MangaGrid
                    items={feed.items}
                    cardSize={cardSize}
                    loading={feed.loadingInitial}
                    hasMore={feed.hasMore}
                    fetching={feed.fetching}
                    onLoadMore={feed.loadMore}
                    emptyText="No recommended titles found."
                    error={feed.error}
                    onRetry={feed.reload}
                  />
                </div>
              )}


              {/* ===================== HISTORY ===================== */}
              {tab === "history" && (
                <HistoryTab
                  history={history}
                  cardSize={cardSize}
                  onBrowse={() => setTab("latest")}
                  onClear={async () => {
                    await clearHistory();
                    setHistory([]);
                  }}
                  onRefresh={refreshHistory}
                />
              )}
            </>
          )}
        </div>

        <AnimatePresence>
          {tagPanelOpen && (
            <TagFilterPanel
              tags={tags}
              selected={selectedTags}
              onToggle={toggleTag}
              onClear={() => {
                const copy = new URLSearchParams(searchParams);
                copy.delete("tag");
                setSearchParams(copy);
              }}
              onClose={() => setTagPanelOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
