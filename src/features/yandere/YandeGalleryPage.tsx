import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Sparkles,
  Flame,
  Shuffle,
  Heart,
  Monitor,
  Smartphone,
  Layers,
  Wallpaper,
  ChevronDown,
  X,
  Loader2,
} from "lucide-react";

import type { YandePost, YandeTag } from "../../lib/yandereApi";
import { fetchYandePosts, searchYandeTags } from "../../lib/yandereApi";
import { useLibrary } from "../../store/library";
import YandeCard from "./components/YandeCard";
import ArtViewerModal from "./components/ArtViewerModal";

export default function YandeGalleryPage() {
  const {
    yandereRatings,
    setYandereRatings,
    yandereAspectFilter,
    setYandereAspectFilter,
    yandereSort,
    setYandereSort,
    yandereBlurNSFW,
    setYandereBlurNSFW,
    yandereCardSize,
    setYandereCardSize,
    yandereFavorites,
  } = useLibrary();

  const [posts, setPosts] = useState<YandePost[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null);

  const selectedPost = selectedPostIndex !== null ? posts[selectedPostIndex] ?? null : null;


  // Measure container width for stable column bucket distribution
  const [containerWidth, setContainerWidth] = useState(1200);

  // Dropdown & Search Completion States
  const [ratingDropdownOpen, setRatingDropdownOpen] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<YandeTag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isFavTab = yandereSort === ("favorites" as unknown);

  // ResizeObserver to track gallery width accurately
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const updateWidth = () => {
      setContainerWidth(Math.max(320, el.clientWidth - 48));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Compute fixed column count based on container width and card size
  const columnCount = useMemo(() => {
    return Math.max(1, Math.floor(containerWidth / Math.max(140, yandereCardSize)));
  }, [containerWidth, yandereCardSize]);

  // Distribute posts into stable column buckets by aspect ratio height to prevent layout re-sorting
  const columns = useMemo(() => {
    const cols: YandePost[][] = Array.from({ length: columnCount }, () => []);
    const colHeights = new Array(columnCount).fill(0);

    posts.forEach((post) => {
      let minIndex = 0;
      let minHeight = colHeights[0];
      for (let i = 1; i < columnCount; i++) {
        if (colHeights[i] < minHeight) {
          minHeight = colHeights[i];
          minIndex = i;
        }
      }
      cols[minIndex].push(post);
      const aspect = post.height && post.width ? post.height / post.width : 1.4;
      colHeights[minIndex] += aspect;
    });

    return cols;
  }, [posts, columnCount]);

  // Sync posts when on Favorites tab
  useEffect(() => {
    if (isFavTab) {
      setPosts(yandereFavorites);
    }
  }, [isFavTab, yandereFavorites]);

  // Load artworks feed with infinite pagination
  const loadArtworks = useCallback(async (targetPage: number) => {
    if (isFavTab) return;

    try {
      if (targetPage === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const res = await fetchYandePosts({
        page: targetPage,
        limit: 40,
        tags: activeTags,
        ratings: yandereRatings,
        aspectFilter: yandereAspectFilter,
        sort: yandereSort,
      });

      if (res.length === 0) {
        setHasMore(false);
      } else {
        setPosts((prev) => (targetPage === 1 ? res : [...prev, ...res]));
        if (res.length < 40) {
          setHasMore(false);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load artworks");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [
    activeTags,
    yandereRatings,
    yandereAspectFilter,
    yandereSort,
    isFavTab,
  ]);

  // Reset feed when filters/tags change
  const resetAndLoadFirstPage = useCallback(() => {
    setPage(1);
    setHasMore(true);
    setPosts([]);
  }, []);

  useEffect(() => {
    if (!isFavTab) {
      loadArtworks(page);
    }
  }, [loadArtworks, page, isFavTab]);

  // Infinite Scroll Listener
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || loading || loadingMore || !hasMore || isFavTab) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight - scrollTop - clientHeight < 600) {
      setPage((prev) => prev + 1);
    }
  }, [loading, loadingMore, hasMore, isFavTab]);

  // Handle tag search completion with wildcard support for character names like hinata_hyuuga
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!searchQuery.trim()) {
        setTagSuggestions([]);
        return;
      }
      const words = searchQuery.trim().split(/\s+/);
      const lastWord = words[words.length - 1];
      if (lastWord.length >= 2) {
        const suggestions = await searchYandeTags(lastWord);
        setTagSuggestions(suggestions);
      }
    };

    const timer = setTimeout(fetchSuggestions, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    const newTags = searchQuery
      .trim()
      .split(/\s+/)
      .filter((t) => !activeTags.includes(t));

    if (newTags.length > 0) {
      setActiveTags([...activeTags, ...newTags]);
      resetAndLoadFirstPage();
    }
    setSearchQuery("");
    setShowSuggestions(false);
  };

  const handleSelectSuggestion = (tagName: string) => {
    const words = searchQuery.trim().split(/\s+/);
    words.pop();
    words.push(tagName);
    const combinedTags = Array.from(new Set([...activeTags, ...words.filter(Boolean)]));
    setActiveTags(combinedTags);
    setSearchQuery("");
    setShowSuggestions(false);
    resetAndLoadFirstPage();
  };

  const handleRemoveTag = (tagName: string) => {
    setActiveTags(activeTags.filter((t) => t !== tagName));
    resetAndLoadFirstPage();
  };

  const handleToggleRating = (rating: "s" | "q" | "e") => {
    if (yandereRatings.includes(rating)) {
      if (yandereRatings.length > 1) {
        setYandereRatings(yandereRatings.filter((r) => r !== rating));
      }
    } else {
      setYandereRatings([...yandereRatings, rating]);
    }
    resetAndLoadFirstPage();
  };

  const tabsList = [
    { id: "recent", label: "Recent", icon: Sparkles, note: "View latest artwork uploads" },
    { id: "popular", label: "Top Voted", icon: Flame, note: "View highest community rated artworks" },
    { id: "random", label: "Random", icon: Shuffle, note: "Discover random anime artworks" },
    { id: "favorites", label: `Favorites (${yandereFavorites.length})`, icon: Heart, note: "View your saved offline favorite artworks" },
  ];

  return (
    <div className="flex h-full flex-col pt-5 font-sans">
      {/* Header and Search Input matching Yuui DiscoverToolbar theme */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6">
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="font-display text-4xl font-bold"
          >
            Anime <span className="text-gradient">Wallpapers</span>
          </motion.h1>
          <p className="mt-1 text-sm text-yuui-muted">
            Browse high-resolution anime artwork from Yande.re, set custom software backgrounds, or save HD wallpapers.
          </p>
        </div>

        {/* Search bar input field matching Yuui theme */}
        <div ref={searchContainerRef} className="relative w-full max-w-xs no-drag">
          <form onSubmit={handleSearchSubmit}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search Yande.re tags e.g. hinata..."
              title="Type Booru tags (e.g. hatsune_miku scenery) and press Enter to search"
              className="w-full glass rounded-xl bg-transparent pl-10 pr-8 py-2.5 text-sm outline-none placeholder:text-yuui-muted/50 border border-white/[0.05] focus:border-yuui-accent/40 text-white"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-yuui-muted/60" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                title="Clear search query"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-yuui-muted hover:text-white text-xs select-none cursor-pointer"
              >
                ✕
              </button>
            )}
          </form>

          {/* Tag Auto-completion Dropdown */}
          {showSuggestions && tagSuggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full mt-1.5 left-0 right-0 max-h-64 overflow-y-auto bg-black/95 rounded-2xl p-1.5 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.95)] border border-white/15 flex flex-col gap-0.5 scrollbar-none backdrop-blur-2xl"
            >
              {tagSuggestions.map((tag) => (
                <div
                  key={tag.id}
                  onClick={() => handleSelectSuggestion(tag.name)}
                  title={`Add tag #${tag.name} (${tag.count.toLocaleString()} posts)`}
                  className="px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-between text-neutral-200 hover:text-white hover:bg-white/10"
                >
                  <span className="font-mono">#{tag.name}</span>
                  <span className="text-[10px] text-yuui-muted font-mono bg-white/5 px-2 py-0.5 rounded-md">
                    {tag.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Tabs and Optional Selectors Toolbar matching Yuui DiscoverToolbar style */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.04] pb-3 px-6 select-none">
        {/* Navigation Tabs */}
        <div className="flex gap-1.5 overflow-x-auto">
          {tabsList.map((tab) => {
            const Icon = tab.icon;
            const isActive = yandereSort === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setYandereSort(tab.id as "recent" | "popular" | "random");
                  resetAndLoadFirstPage();
                }}
                title={tab.note}
                className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                  isActive ? "text-white" : "text-yuui-muted hover:text-white"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="yandere-tab-active"
                    className="absolute inset-0 bg-white/[0.06] rounded-xl border border-white/5"
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 25,
                    }}
                  />
                )}
                <Icon className="h-4 w-4 relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Rating Dropdown, Aspect Filter, & Card Size Slider */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Rating Filter Dropdown */}
          <div className="relative">
            <div
              onClick={() => setRatingDropdownOpen(!ratingDropdownOpen)}
              title="Filter artworks by content rating (Safe, Questionable, Explicit)"
              className="glass rounded-xl px-3.5 py-1.5 flex items-center justify-between border border-white/[0.05] gap-2 text-xs font-semibold hover:bg-white/[0.08] transition-colors cursor-pointer select-none"
            >
              <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">Rating:</span>
              <span className="flex items-center gap-1 text-white uppercase">
                {yandereRatings.length === 3
                  ? "All"
                  : yandereRatings.map((r) => (r === "s" ? "Safe" : r === "q" ? "Quest" : "NSFW")).join(" + ")}
                <ChevronDown className="h-3.5 w-3.5 text-yuui-muted" />
              </span>
            </div>

            {ratingDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setRatingDropdownOpen(false)} />
                <div className="absolute top-full mt-1.5 right-0 min-w-[180px] bg-black/95 rounded-2xl p-1.5 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.95)] border border-white/15 flex flex-col gap-0.5 scrollbar-none backdrop-blur-2xl">
                  {[
                    { id: "s", label: "Safe", note: "All-ages suitable artworks" },
                    { id: "q", label: "Questionable", note: "Swimsuits & ecchi content" },
                    { id: "e", label: "Explicit (NSFW)", note: "Unedited 18+ artworks" },
                  ].map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleRating(item.id as "s" | "q" | "e")}
                      title={item.note}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-between hover:bg-white/10 ${
                        yandereRatings.includes(item.id as "s" | "q" | "e")
                          ? "text-accent bg-accent/15 font-bold"
                          : "text-neutral-300 hover:text-white"
                      }`}
                    >
                      <span>{item.label}</span>
                      {yandereRatings.includes(item.id as "s" | "q" | "e") && (
                        <span className="text-accent font-bold">✓</span>
                      )}
                    </div>
                  ))}
                  <div
                    onClick={() => setYandereBlurNSFW(!yandereBlurNSFW)}
                    title="Toggle thumbnail blur effect for NSFW artworks"
                    className="mt-1 pt-1 border-t border-white/10 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-between text-amber-400 hover:bg-white/10"
                  >
                    <span>Blur NSFW Previews</span>
                    <span>{yandereBlurNSFW ? "ON" : "OFF"}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Aspect Ratio Mode Toggles */}
          <div className="glass rounded-xl p-1 flex items-center gap-1 border border-white/[0.05] text-xs select-none">
            {[
              { id: "all", label: "All", icon: Layers, note: "Show all picture aspect ratios" },
              { id: "desktop", label: "16:9", icon: Monitor, note: "Filter for 16:9 widescreen desktop wallpapers" },
              { id: "mobile", label: "Mobile", icon: Smartphone, note: "Filter for portrait mobile wallpapers" },
            ].map((aspect) => {
              const Icon = aspect.icon;
              const isSelected = yandereAspectFilter === aspect.id;
              return (
                <button
                  key={aspect.id}
                  onClick={() => {
                    setYandereAspectFilter(aspect.id as any);
                    resetAndLoadFirstPage();
                  }}
                  title={aspect.note}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold ${
                    isSelected ? "bg-white/10 text-white shadow-sm" : "text-yuui-muted hover:text-white"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{aspect.label}</span>
                </button>
              );
            })}
          </div>

          {/* Card size slider */}
          <div
            title="Drag slider to adjust artwork thumbnail card size (140px - 420px)"
            className="glass rounded-xl px-3 py-1.5 flex items-center justify-between border border-white/[0.05] gap-2 cursor-pointer"
          >
            <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider shrink-0">
              Card Size
            </span>
            <input
              type="range"
              min="140"
              max="420"
              step="10"
              value={yandereCardSize}
              onChange={(e) => setYandereCardSize(Number(e.target.value))}
              title={`Card Size: ${yandereCardSize}px`}
              className="w-24 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent"
            />
            <span className="text-[10px] text-white font-semibold font-mono w-8 text-right shrink-0">
              {yandereCardSize}px
            </span>
          </div>
        </div>
      </div>

      {/* Active Filter Tags Pills */}
      {activeTags.length > 0 && (
        <div className="flex items-center gap-2 px-6 flex-wrap text-xs pt-2">
          <span className="text-yuui-muted font-semibold text-[10px] uppercase tracking-wider">Active Tags:</span>
          {activeTags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/20 border border-accent/40 text-accent font-mono text-xs font-medium"
            >
              #{tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                title={`Remove tag #${tag}`}
                className="hover:text-white transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            onClick={() => {
              setActiveTags([]);
              resetAndLoadFirstPage();
            }}
            title="Clear all active search filter tags"
            className="text-xs text-yuui-muted hover:text-white underline ml-2 font-medium"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Main Stable Multi-Column Bucket Masonry Grid Content */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-3 no-scrollbar"
      >
        {loading ? (
          <div className="flex gap-[2px] items-start w-full">
            {Array.from({ length: columnCount }).map((_, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-[2px] flex-1 min-w-0">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-72 w-full rounded-lg bg-surface-elevated/20 animate-pulse mb-1"
                  />
                ))}
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-rose-400 font-semibold text-sm mb-2">{error}</p>
            <button
              onClick={() => loadArtworks(1)}
              className="px-4 py-2 rounded-xl bg-accent text-white font-semibold text-xs shadow-lg shadow-accent/20"
            >
              Try Again
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Wallpaper className="h-12 w-12 text-yuui-muted/40 mb-3" />
            <h3 className="text-base font-bold text-foreground">No artworks found</h3>
            <p className="text-xs text-yuui-muted mt-1 max-w-sm">
              Try adjusting your search tags, rating filters, or aspect ratio selection.
            </p>
          </div>
        ) : (
          <>
            {/* Stable Column Bucket Grid — Zero layout shifts when appending new posts */}
            <div className="flex gap-[2px] items-start w-full">
              {columns.map((colPosts, colIdx) => (
                <div key={colIdx} className="flex flex-col gap-[2px] flex-1 min-w-0">
                  {colPosts.map((post) => (
                    <YandeCard
                      key={post.id}
                      post={post}
                      onOpenLightbox={(p) => {
                        const idx = posts.findIndex((item) => item.id === p.id);
                        setSelectedPostIndex(idx >= 0 ? idx : null);
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Bottom Infinite Auto-Scroll Loading Spinner & Indicator */}
            {!isFavTab && (
              <div className="flex items-center justify-center py-8">
                {loadingMore ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-yuui-muted bg-white/[0.04] border border-white/[0.06] rounded-full px-4 py-2 shadow-lg backdrop-blur-xl">
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    <span>Loading more wallpapers...</span>
                  </div>
                ) : !hasMore ? (
                  <span className="text-xs font-mono text-yuui-muted/60 bg-white/[0.02] border border-white/[0.04] rounded-full px-4 py-1.5">
                    End of artworks gallery
                  </span>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>

      {/* In-App Lightbox Inspector Modal */}
      <ArtViewerModal
        post={selectedPost}
        onClose={() => setSelectedPostIndex(null)}
        onSelectTag={handleSelectSuggestion}
        onPrev={() => setSelectedPostIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
        onNext={() => setSelectedPostIndex((i) => (i !== null && i < posts.length - 1 ? i + 1 : i))}
        hasPrev={selectedPostIndex !== null && selectedPostIndex > 0}
        hasNext={selectedPostIndex !== null && selectedPostIndex < posts.length - 1}
      />
    </div>
  );
}

