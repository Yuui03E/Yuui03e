import type { RefCallback } from "react";
import DiscoverCard from "../../components/DiscoverCard";
import { resolveEntryKey } from "../../lib/resolveEntryKey";
import type { DiscoverAnime } from "../../lib/types/discover";

interface DiscoverGridProps {
  list: DiscoverAnime[];
  isLoading: boolean;
  error: Error | null;
  cardSize: number;
  entries: any[];
  navigate: (path: string) => void;
  sentinelRef: RefCallback<HTMLDivElement>;
  isFetchingNextPage: boolean;
}

export default function DiscoverGrid({
  list,
  isLoading,
  error,
  cardSize,
  entries,
  navigate,
  sentinelRef,
  isFetchingNextPage,
}: DiscoverGridProps) {
  return (
    <div className="mt-6">
      <div>
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-yuui-accent" />
            <p className="text-sm text-yuui-muted">Loading anime...</p>
          </div>
        )}

        {error && (
          <div className="glass rounded-2xl border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Failed to fetch anime: {String(error)}
          </div>
        )}

        {!isLoading && !error && (
          <>
            <div
              className="grid gap-5"
              style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`,
              }}
            >
              {list.map((anime) => {
                const targetKey = resolveEntryKey(entries, anime.id);
                return (
                  <DiscoverCard
                    key={anime.id}
                    anime={anime}
                    onClick={() =>
                      navigate(`/anime/${encodeURIComponent(targetKey)}`)
                    }
                  />
                );
              })}
            </div>

            {/* Infinite Scroll sentinel element */}
            <div
              ref={sentinelRef}
              className="h-14 w-full flex items-center justify-center mt-6"
            >
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
    </div>
  );
}
