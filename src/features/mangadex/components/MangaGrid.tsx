import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MangaInfo, ChapterUpdateInfo } from "../api";
import { MangaCard } from "../MangaCard";

interface MangaGridProps {
  items: (MangaInfo | ChapterUpdateInfo)[];
  cardSize: number;
  loading: boolean;
  hasMore: boolean;
  fetching: boolean;
  onLoadMore: () => void;
  emptyText: string;
  /** When set, the grid shows an error state with a retry button instead of
   *  the plain empty message. */
  error?: string | null;
  onRetry?: () => void;
  /** When true, items are ChapterUpdateInfo and a chapter subtitle is shown. */
  showChapterSubtitle?: boolean;
}

/**
 * Responsive auto-fill grid of MangaCards with an infinite-scroll sentinel.
 * Handles the loading / empty / populated states so each tab view can stay
 * tiny.
 *
 * The IntersectionObserver is created once and reads live `hasMore` /
 * `fetching` / `loading` / `onLoadMore` values from refs, so it isn't torn
 * down and rebuilt on every state change (which caused the grid to jitter
 * and miss triggers).
 */
export default function MangaGrid({
  items,
  cardSize,
  loading,
  hasMore,
  fetching,
  onLoadMore,
  emptyText,
  error,
  onRetry,
  showChapterSubtitle = false,
}: MangaGridProps) {
  const navigate = useNavigate();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [sentinelNode, setSentinelNode] = useState<HTMLDivElement | null>(null);

  // Live refs so the observer callback can stay stable.
  const liveRef = useRef({ hasMore, fetching, loading, onLoadMore });
  liveRef.current = { hasMore, fetching, loading, onLoadMore };

  // Track the sentinel node via callback ref so we know when it mounts.
  const setSentinel = (node: HTMLDivElement | null) => {
    sentinelRef.current = node;
    setSentinelNode(node);
  };

  useEffect(() => {
    const node = sentinelNode;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const s = liveRef.current;
        if (
          entries[0].isIntersecting &&
          s.hasMore &&
          !s.fetching &&
          !s.loading
        ) {
          s.onLoadMore();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [sentinelNode]);

  if (loading) {
    return <SkeletonGrid />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <p className="text-sm text-rose-400/80">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-xl bg-yuui-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <p className="text-sm text-yuui-muted">{emptyText}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08]"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className="grid gap-5"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`,
        }}
      >
        {items.map((u) => {
          const chUpdate = u as ChapterUpdateInfo;
          const manga = (chUpdate.manga ?? (u as MangaInfo)) as MangaInfo;
          if (!manga?.id) return null;
          const subtitle =
            showChapterSubtitle && chUpdate.chapter
              ? `${chUpdate.volume ? `Vol. ${chUpdate.volume} ` : ""}Ch. ${chUpdate.chapter} · ${chUpdate.lang.toUpperCase()}`
              : undefined;
          return (
            <MangaCard
              key={manga.id + (chUpdate.id ?? "")}
              manga={manga}
              onClick={() => navigate(`/mangadex/manga/${manga.id}`)}
              subtitle={subtitle}
            />
          );
        })}
      </div>

      <div
        ref={setSentinel}
        className="h-14 w-full flex items-center justify-center mt-6"
      >
        {fetching && (
          <div className="flex items-center gap-2 text-xs text-yuui-muted">
            <div className="h-4 w-4 animate-spin rounded-full border border-white/10 border-t-yuui-accent" />
            <span>Loading more...</span>
          </div>
        )}
      </div>
    </>
  );
}

/** Skeleton placeholder grid used while feeds are loading. */
export function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="h-56 animate-pulse rounded-2xl bg-white/[0.04]"
        />
      ))}
    </div>
  );
}
