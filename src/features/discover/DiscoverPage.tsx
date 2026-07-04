import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { cleanDescription, humanizeEnum } from "../../lib/format";
import { invoke } from "@tauri-apps/api/core";
import DiscoverCard from "../../components/DiscoverCard";
import { useLibrary } from "../../store/library";

interface DiscoverAnime {
  id: number;
  title: { romaji: string | null; english: string | null };
  coverImage: { large: string | null; extraLarge: string | null; color: string | null };
  averageScore: number | null;
  seasonYear: number | null;
  format: string | null;
  description: string | null;
  bannerImage: string | null;
  genres: string[];
  status: string | null;
  episodes: number | null;
  trailer: { id: string | null; site: string | null } | null;
}

async function fetchDiscoverData(
  sortType: string,
  isSeasonal: boolean,
  pageParam: number,
  season: string,
  year: number,
  search?: string,
  genre?: string,
  tag?: string
): Promise<DiscoverAnime[]> {
  const query = genre
    ? `query ($page: Int, $genre: String) {
        Page(page: $page, perPage: 24) {
          media(type: ANIME, genre: $genre, sort: POPULARITY_DESC) {
            id
            title { romaji english }
            coverImage { large extraLarge color }
            averageScore
            seasonYear
            format
            description(asHtml: false)
            bannerImage
            genres
            status
            episodes
            trailer { id site }
          }
        }
      }`
    : tag
    ? `query ($page: Int, $tag: String) {
        Page(page: $page, perPage: 24) {
          media(type: ANIME, tag: $tag, sort: POPULARITY_DESC) {
            id
            title { romaji english }
            coverImage { large extraLarge color }
            averageScore
            seasonYear
            format
            description(asHtml: false)
            bannerImage
            genres
            status
            episodes
            trailer { id site }
          }
        }
      }`
    : search
    ? `query ($page: Int, $search: String) {
        Page(page: $page, perPage: 24) {
          media(type: ANIME, search: $search) {
            id
            title { romaji english }
            coverImage { large extraLarge color }
            averageScore
            seasonYear
            format
            description(asHtml: false)
            bannerImage
            genres
            status
            episodes
            trailer { id site }
          }
        }
      }`
    : isSeasonal
    ? `query ($page: Int, $season: MediaSeason, $seasonYear: Int) {
        Page(page: $page, perPage: 24) {
          media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC) {
            id
            title { romaji english }
            coverImage { large extraLarge color }
            averageScore
            seasonYear
            format
            description(asHtml: false)
            bannerImage
            genres
            status
            episodes
            trailer { id site }
          }
        }
      }`
    : `query ($page: Int) {
        Page(page: $page, perPage: 24) {
          media(type: ANIME, sort: ${sortType}) {
            id
            title { romaji english }
            coverImage { large extraLarge color }
            averageScore
            seasonYear
            format
            description(asHtml: false)
            bannerImage
            genres
            status
            episodes
            trailer { id site }
          }
        }
      }`;

  const variables: Record<string, unknown> = { page: pageParam };
  if (search) {
    variables.search = search;
  } else if (isSeasonal) {
    variables.season = season;
    variables.seasonYear = year;
  }

  const data = await invoke<any>("graphql_anilist", { query, variables });
  return data?.data?.Page?.media ?? [];
}



function DetailModal({
  anime,
  onClose,
  onSelectSearch,
}: {
  anime: DiscoverAnime;
  onClose: () => void;
  onSelectSearch: (query: string) => void;
}) {
  const title = anime.title.english || anime.title.romaji || "Unknown";
  const banner = anime.bannerImage;
  const cover = anime.coverImage.extraLarge || anime.coverImage.large;
  const color = anime.coverImage.color || "#7c5cff";
  const desc = useMemo(() => cleanDescription(anime.description), [anime.description]);

  const trailerUrl =
    anime.trailer?.site === "youtube" && anime.trailer?.id
      ? `https://www.youtube.com/embed/${anime.trailer.id}`
      : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 15 }}
        className="glass-strong relative w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-3xl border border-white/10 bg-yuui-bg/95 text-left shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner */}
        <div className="relative h-[220px] w-full overflow-hidden">
          {banner ? (
            <img src={banner} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background: `radial-gradient(120% 120% at 50% 0%, ${color}66, #07070c 80%)`,
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-yuui-bg via-yuui-bg/30 to-transparent" />
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 -mt-20 relative z-10">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Cover image */}
            <div className="w-[140px] shrink-0 mx-auto md:mx-0 overflow-hidden rounded-2xl border border-white/10 shadow-card">
              {cover ? (
                <img src={cover} alt="" className="aspect-[2/3] w-full object-cover" />
              ) : (
                <div
                  className="grid aspect-[2/3] w-full place-items-center text-4xl"
                  style={{ background: `linear-gradient(160deg, ${color}55, #141420)` }}
                >
                  🌸
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold font-display text-white">{title}</h2>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-white/70">
                {anime.format && <span className="glass rounded-full px-2.5 py-0.5">{humanizeEnum(anime.format)}</span>}
                {anime.status && <span className="glass rounded-full px-2.5 py-0.5">{humanizeEnum(anime.status)}</span>}
                {anime.episodes && <span className="glass rounded-full px-2.5 py-0.5">{anime.episodes} eps</span>}
                {anime.averageScore && (
                  <span className="rounded-full bg-yuui-accent3/15 px-2.5 py-0.5 text-yuui-accent3">★ {anime.averageScore}</span>
                )}
              </div>

              {desc && (
                <p className="mt-4 text-sm text-white/75 leading-relaxed max-h-[140px] overflow-y-auto pr-1">
                  {desc}
                </p>
              )}

              {anime.genres.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {anime.genres.map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        onSelectSearch(g);
                        onClose();
                      }}
                      className="rounded-lg px-2 py-0.5 text-xs cursor-pointer hover:scale-105 active:scale-95 transition-all text-left"
                      style={{ background: `${color}18`, color }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Trailer section */}
          {trailerUrl && (
            <div className="mt-8">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-yuui-muted font-display">
                Promotional Video
              </h4>
              <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10">
                <iframe
                  src={trailerUrl}
                  title="Trailer"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function DiscoverPage() {
  const { cardSize, setCardSize, entries } = useLibrary();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(0);
  const [selectedAnime, setSelectedAnime] = useState<DiscoverAnime | null>(null);

  const [selectedSeason, setSelectedSeason] = useState("SUMMER");
  const [selectedYear, setSelectedYear] = useState(2026);

  const searchParam = searchParams.get("search") || "";
  const genreParam = searchParams.get("genre") || "";
  const tagParam = searchParams.get("tag") || "";
  const activeSearch = searchParam || genreParam || tagParam;

  const [searchQuery, setSearchQuery] = useState(activeSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(activeSearch);

  useEffect(() => {
    const s = searchParams.get("search") || "";
    const g = searchParams.get("genre") || "";
    const t = searchParams.get("tag") || "";
    const val = s || g || t;
    setSearchQuery(val);
    setDebouncedSearch(val);
  }, [searchParams]);

  useEffect(() => {
    if (searchQuery === activeSearch) {
      return;
    }
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      if (searchQuery) {
        setSearchParams({ search: searchQuery });
      } else {
        setSearchParams({});
      }
    }, 500);
    return () => clearTimeout(t);
  }, [searchQuery, activeSearch, setSearchParams]);

  const TABS = useMemo(() => [
    { label: "Trending", sort: "TRENDING_DESC", seasonal: false },
    { label: `${humanizeEnum(selectedSeason)} ${selectedYear}`, sort: "POPULARITY_DESC", seasonal: true },
    { label: "Popular", sort: "POPULARITY_DESC", seasonal: false },
    { label: "Top Rated", sort: "SCORE_DESC", seasonal: false },
  ], [selectedSeason, selectedYear]);

  const currentTab = TABS[activeTab];

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteQuery({
    queryKey: ["discover", currentTab.sort, currentTab.seasonal, selectedSeason, selectedYear, debouncedSearch, searchParams.get("genre"), searchParams.get("tag")],
    queryFn: ({ pageParam = 1 }) =>
      fetchDiscoverData(
        currentTab.sort,
        currentTab.seasonal,
        pageParam as number,
        selectedSeason,
        selectedYear,
        searchParams.get("search") || undefined,
        searchParams.get("genre") || undefined,
        searchParams.get("tag") || undefined
      ),
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 24 ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const list = useMemo(() => {
    return data ? data.pages.flat() : [];
  }, [data]);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [sentinelRef, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="flex-1 overflow-y-auto px-6 pt-5 pb-8 h-full">
      {/* Header and Search Input */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="font-display text-4xl font-bold"
          >
            Discover <span className="text-gradient">Anime</span>
          </motion.h1>
          <p className="mt-1 text-sm text-yuui-muted">
            Browse seasonal titles, popular shows, or search AniList.
          </p>
        </div>

        {/* Search bar input field */}
        <div className="relative w-full max-w-xs no-drag">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search AniList..."
            className="w-full glass rounded-xl bg-transparent pl-10 pr-4 py-2.5 text-sm outline-none placeholder:text-yuui-muted/50 border border-white/[0.05] focus:border-yuui-accent/40 text-white"
          />
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-yuui-muted/60">🔍</span>
        </div>
      </div>

      {/* Tabs and Optional Selectors */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.04] pb-3 select-none">
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map((tab, i) => {
            const isActive = activeTab === i && !searchQuery;
            return (
              <button
                key={tab.label}
                onClick={() => {
                  setSearchQuery(""); // Clear search to return to tabs
                  setActiveTab(i);
                }}
                className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  isActive ? "text-white" : "text-yuui-muted hover:text-white"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="discover-tab-active"
                    className="absolute inset-0 bg-white/[0.06] rounded-xl border border-white/5"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
          {searchQuery && (
            <span className="relative px-4 py-2 rounded-xl text-sm font-semibold text-yuui-accent bg-yuui-accent/15 border border-yuui-accent/20">
              Search: "{searchQuery}"
            </span>
          )}
        </div>

        {/* Card size slider and Season & Year selectors */}
        <div className="flex items-center gap-3">
          {/* Card size slider */}
          <div className="glass rounded-xl px-3 py-1.5 flex items-center justify-between border border-white/[0.05] gap-2">
            <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider shrink-0 mr-1">Card Size</span>
            <input
              type="range"
              min="140"
              max="260"
              value={cardSize}
              onChange={(e) => setCardSize(Number(e.target.value))}
              className="w-24 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent"
            />
            <span className="text-[10px] text-white font-semibold font-mono w-8 text-right shrink-0">{cardSize}px</span>
          </div>

          {/* Season & Year dropdowns for Seasonal tab */}
          {currentTab.seasonal && !searchQuery && (
            <div className="flex items-center gap-2">
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="glass rounded-xl bg-transparent px-3 py-1.5 text-xs font-semibold outline-none border border-white/[0.05]"
              >
                <option value="WINTER" className="bg-yuui-panel text-white">Winter</option>
                <option value="SPRING" className="bg-yuui-panel text-white">Spring</option>
                <option value="SUMMER" className="bg-yuui-panel text-white">Summer</option>
                <option value="FALL" className="bg-yuui-panel text-white">Fall</option>
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="glass rounded-xl bg-transparent px-3 py-1.5 text-xs font-semibold outline-none border border-white/[0.05]"
              >
                {[2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020].map((y) => (
                  <option key={y} value={y} className="bg-yuui-panel text-white">{y}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Grid List */}
      <div className="mt-6">
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-yuui-accent" />
            <p className="text-sm text-yuui-muted">Loading recommendations...</p>
          </div>
        )}

        {error && (
          <div className="glass rounded-2xl border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Failed to fetch recommendations: {String(error)}
          </div>
        )}

        {!isLoading && !error && (
          <>
            <div 
              className="grid gap-5"
              style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`
              }}
            >
              {list.map((anime) => {
                const localEntry = entries.find(
                  (e) =>
                    e.media?.id === anime.id ||
                    (e.media?.title.english && e.media.title.english === anime.title.english) ||
                    (e.media?.title.romaji && e.media.title.romaji === anime.title.romaji)
                );
                const targetKey = localEntry ? localEntry.key : `anilist:${anime.id}`;
                return (
                  <DiscoverCard
                    key={anime.id}
                    anime={anime}
                    onClick={() => navigate(`/anime/${encodeURIComponent(targetKey)}`)}
                  />
                );
              })}
            </div>

            {/* Infinite Scroll sentinel element */}
            <div ref={sentinelRef} className="h-14 w-full flex items-center justify-center mt-6">
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-xs text-yuui-muted">
                  <div className="h-4 w-4 animate-spin rounded-full border border-white/10 border-t-yuui-accent" />
                  <span>Loading more...</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal Popup Overlay */}
      <AnimatePresence>
        {selectedAnime && (
          <DetailModal
            anime={selectedAnime}
            onClose={() => setSelectedAnime(null)}
            onSelectSearch={(query) => {
              setSearchParams({ genre: query });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
