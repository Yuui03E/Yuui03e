import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import { fetchUserActivities } from "./api";
import { timeAgo } from "../../../lib/format";

interface ActivityFeedProps {
  userId: number;
}

export default function ActivityFeed({ userId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  const loadActivities = async (pageNum: number, isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const resp = await fetchUserActivities(userId, pageNum);
      const newActivities = resp?.data?.Page?.activities || [];
      const hasNext = resp?.data?.Page?.pageInfo?.hasNextPage || false;

      if (isLoadMore) {
        setActivities((prev) => [...prev, ...newActivities]);
      } else {
        setActivities(newActivities);
      }
      setHasNextPage(hasNext);
      setPage(pageNum);
    } catch (e) {
      console.error("Failed to load AniList activities:", e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadActivities(1, false);
  }, [userId]);

  const getStatusText = (status: string, progress: string | null) => {
    const s = status?.toLowerCase();
    if (
      s === "watched" ||
      s === "completed" ||
      s === "planning" ||
      s === "dropped" ||
      s === "paused"
    ) {
      const formattedStatus = s.charAt(0).toUpperCase() + s.slice(1);
      if (s === "watched" && progress) {
        return `Watched episode ${progress} of`;
      }
      if (s === "planning") {
        return "Plans to watch";
      }
      return formattedStatus;
    }
    return status + (progress ? ` episode ${progress} of` : "");
  };

  return (
    <div className="glass rounded-[24px] p-4 bg-white/[0.01] border border-white/[0.05] h-full flex flex-col min-h-0 select-none overflow-hidden relative">
      <header className="flex items-center justify-between border-b border-white/[0.06] pb-2.5 mb-3 shrink-0">
        <span className="text-xs font-bold text-white/90 uppercase tracking-widest font-sans">
          Activity Feed
        </span>
        <button
          onClick={() => loadActivities(1, false)}
          className="text-white/40 hover:text-white transition-colors cursor-pointer"
          disabled={loading || loadingMore}
        >
          <RotateCw size={11} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {loading && page === 1 ? (
        <div className="flex-grow flex items-center justify-center">
          <RotateCw size={18} className="animate-spin text-white/20" />
        </div>
      ) : activities.length === 0 ? (
        <div className="flex-grow flex items-center justify-center text-center p-4">
          <span className="text-[11px] text-yuui-muted font-sans">
            No recent activities found.
          </span>
        </div>
      ) : (
        <div className="flex-grow overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {activities.map((activity: any) => {
            const isList = activity.__typename === "ListActivity";
            const ago = timeAgo(activity.createdAt);

            if (isList) {
              const mediaTitle =
                activity.media?.title?.english ||
                activity.media?.title?.romaji ||
                activity.media?.title?.userPreferred;
              return (
                <div
                  key={activity.id}
                  className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 flex gap-3 text-[11px] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-200"
                >
                  <img
                    src={
                      activity.media?.coverImage?.large ||
                      activity.media?.coverImage?.medium
                    }
                    alt={mediaTitle}
                    className="h-12 w-9 rounded-md object-cover bg-white/5 shrink-0"
                  />
                  <div className="flex-grow flex flex-col justify-between min-w-0">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-white/50 leading-tight">
                          {getStatusText(activity.status, activity.progress)}
                        </span>
                        <span className="text-[9px] text-white/30 shrink-0 font-sans">
                          {ago}
                        </span>
                      </div>
                      <p className="text-white font-bold leading-snug break-words font-display truncate hover:text-clip hover:whitespace-normal transition-all">
                        {mediaTitle}
                      </p>
                    </div>
                  </div>
                </div>
              );
            } else {
              // TextActivity
              const userName = activity.user?.name || "User";
              return (
                <div
                  key={activity.id}
                  className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 flex gap-3 text-[11px] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-200"
                >
                  <img
                    src={activity.user?.avatar?.medium}
                    alt={userName}
                    className="h-7 w-7 rounded-full border border-white/10 object-cover shrink-0 bg-white/5"
                  />
                  <div className="flex-grow flex flex-col min-w-0">
                    <div className="flex justify-between items-start gap-2 min-w-0">
                      <span className="font-bold text-white truncate">
                        {userName}
                      </span>
                      <span className="text-[9px] text-white/30 shrink-0 font-sans">
                        {ago}
                      </span>
                    </div>
                    <p className="text-white/60 whitespace-pre-wrap break-words leading-relaxed mt-1 text-[10.5px] font-sans">
                      {activity.text?.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")}
                    </p>
                  </div>
                </div>
              );
            }
          })}

          {hasNextPage && (
            <button
              onClick={() => loadActivities(page + 1, true)}
              disabled={loadingMore}
              className="w-full py-2.5 text-[9.5px] font-bold text-white/60 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/12 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-center mt-1 select-none"
            >
              {loadingMore ? "Loading..." : "Load More"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
