import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { humanizeEnum } from "../../lib/format";
import { useDebounce } from "../../lib/hooks/useDebounce";
import { useLibrary } from "../../store/library";
import { fetchDiscoverData } from "./api";
import DiscoverToolbar from "./DiscoverToolbar";
import DiscoverGrid from "./DiscoverGrid";

export default function DiscoverPage() {
  const { cardSize, setCardSize, entries } = useLibrary();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(0);

  // Default to the actual current anime season instead of a hardcoded one.
  const [selectedSeason, setSelectedSeason] = useState(() => {
    const m = new Date().getMonth(); // 0-11
    return m < 3 ? "WINTER" : m < 6 ? "SPRING" : m < 9 ? "SUMMER" : "FALL";
  });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const searchParam = searchParams.get("search") || "";
  const genreParam = searchParams.get("genre") || "";
  const tagParam = searchParams.get("tag") || "";
  const activeSearch = searchParam || genreParam || tagParam;

  const [searchQuery, setSearchQuery] = useState(activeSearch);
  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    const s = searchParams.get("search") || "";
    const g = searchParams.get("genre") || "";
    const t = searchParams.get("tag") || "";
    const val = s || g || t;
    setSearchQuery(val);
  }, [searchParams]);

  useEffect(() => {
    if (debouncedSearch === activeSearch) {
      return;
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedSearch) {
        next.set("search", debouncedSearch);
      } else {
        next.delete("search");
      }
      return next;
    });
  }, [debouncedSearch]);

  const TABS = useMemo(() => {
    return [
      { label: "Trending", sort: "TRENDING_DESC", seasonal: false },
      {
        label: `${humanizeEnum(selectedSeason)} ${selectedYear}`,
        sort: "POPULARITY_DESC",
        seasonal: true,
      },
      { label: "Popular", sort: "POPULARITY_DESC", seasonal: false },
      { label: "Top Rated", sort: "SCORE_DESC", seasonal: false },
    ];
  }, [selectedSeason, selectedYear]);

  const currentTab = TABS[activeTab] || TABS[0];

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: [
      "discover",
      currentTab.sort,
      currentTab.seasonal,
      selectedSeason,
      selectedYear,
      debouncedSearch,
      searchParams.get("genre"),
      searchParams.get("tag"),
    ],
    queryFn: ({ pageParam = 1 }) =>
      fetchDiscoverData(
        currentTab.sort,
        currentTab.seasonal,
        pageParam as number,
        selectedSeason,
        selectedYear,
        debouncedSearch || undefined,
        searchParams.get("genre") || undefined,
        searchParams.get("tag") || undefined,
      ),
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 24 ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const list = useMemo(() => {
    return data ? data.pages.flat() : [];
  }, [data]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (node && hasNextPage && !isFetchingNextPage) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            fetchNextPage();
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(node);
      observerRef.current = observer;
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="h-full overflow-y-auto px-6 pt-5 pb-10">
      <DiscoverToolbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tabs={TABS}
        currentTab={currentTab}
        selectedSeason={selectedSeason}
        setSelectedSeason={setSelectedSeason}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        cardSize={cardSize}
        setCardSize={setCardSize}
      />

      <DiscoverGrid
        list={list}
        isLoading={isLoading}
        error={error}
        cardSize={cardSize}
        entries={entries}
        navigate={navigate}
        sentinelRef={sentinelRef}
        isFetchingNextPage={isFetchingNextPage}
      />
    </div>
  );
}
