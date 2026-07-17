import { useState } from "react";
import { motion } from "framer-motion";
import { List, LayoutGrid } from "lucide-react";

interface OverviewTabProps {
  listFilter: string;
  filteredMiddleList: any[];
  selectedRowKey: string | null;
  setSelectedRowKey: (key: string | null) => void;
  coverSize: number;
}

export default function OverviewTab({ listFilter, filteredMiddleList, selectedRowKey, setSelectedRowKey, coverSize }: OverviewTabProps) {
  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    return (localStorage.getItem("overview_view_mode") as "list" | "grid") || "list";
  });

  const handleSetViewMode = (mode: "list" | "grid") => {
    setViewMode(mode);
    localStorage.setItem("overview_view_mode", mode);
  };

  return (
    <motion.div
      key="overview-tab"
      initial={{ opacity: 0, x: 5 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -5 }}
      className="flex flex-col gap-4 h-full min-h-0 overflow-hidden"
    >
      {/* List Grid modern flex container */}
      <div className="glass rounded-3xl border border-white/[0.05] bg-yuui-surface/40 flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="p-3.5 border-b border-white/[0.04] flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">{listFilter} Database</span>
          
          <div className="flex items-center gap-3 select-none">
            {/* View Mode Toggle Segment */}
            <div className="flex items-center bg-black/35 border border-white/[0.06] rounded-xl p-0.5">
              <button
                onClick={() => handleSetViewMode("list")}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === "list"
                    ? "bg-white/[0.06] text-white shadow-sm"
                    : "text-white/40 hover:text-white"
                }`}
                title="List View"
              >
                <List size={11} />
              </button>
              <button
                onClick={() => handleSetViewMode("grid")}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-white/[0.06] text-white shadow-sm"
                    : "text-white/40 hover:text-white"
                }`}
                title="Grid/Poster View"
              >
                <LayoutGrid size={11} />
              </button>
            </div>
            <span className="text-[9.5px] text-yuui-accent font-semibold">{filteredMiddleList.length} titles listed</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {viewMode === "list" ? (
            <div className="space-y-2.5">
              {filteredMiddleList.map((e) => {
                const currentProgress = e.user?.progress ?? 0;
                const max = e.media?.episodes ?? e.episode_count;
                const progressPercent = max > 0 ? (currentProgress / max) * 100 : 0;
                const isSelected = selectedRowKey === e.key;
                return (
                  <div
                    key={e.key}
                    onClick={() => setSelectedRowKey(isSelected ? null : e.key)}
                    className={`flex items-center gap-4 p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-yuui-accent/15 border-yuui-accent/60 shadow-glow font-bold"
                        : "bg-[#161821]/40 border-white/[0.03] hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="shrink-0 flex items-center justify-center">
                      <img
                        src={(e.media?.coverImage as any)?.large || (e.media?.coverImage as any)?.medium || "https://s4.anilist.co/file/anilist/user/avatar/large/default.png"}
                        alt="cover"
                        className="rounded-xl object-cover border border-white/10 shadow-md shrink-0"
                        style={{ height: `${coverSize}px`, width: `${coverSize * 0.7}px` }}
                      />
                    </div>

                    <div className="min-w-0 flex-1 flex flex-col justify-center gap-1.5">
                      <span className="block truncate text-xs font-semibold text-white max-w-[450px]" title={e.title}>
                        {e.title}
                      </span>
                      <div className="h-1.5 w-32 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-yuui-accent to-pink-500 rounded-full" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>

                    <div className="shrink-0 text-center w-14">
                      <span className="text-[9px] text-yuui-muted font-bold uppercase tracking-wider block mb-0.5">Score</span>
                      <span className="text-xs text-pink-400 font-bold font-mono">{e.user?.score ? `★ ${e.user.score}` : "—"}</span>
                    </div>

                    <div className="shrink-0 text-center w-18">
                      <span className="text-[9px] text-yuui-muted font-bold uppercase tracking-wider block mb-0.5">Progress</span>
                      <span className="text-xs text-white font-mono">{currentProgress} / {max}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5 justify-start">
              {filteredMiddleList.map((e) => {
                const currentProgress = e.user?.progress ?? 0;
                const max = e.media?.episodes ?? e.episode_count;
                const progressPercent = max > 0 ? (currentProgress / max) * 100 : 0;
                const isSelected = selectedRowKey === e.key;
                const cardWidth = coverSize * 1.8;
                return (
                  <div
                    key={e.key}
                    onClick={() => setSelectedRowKey(isSelected ? null : e.key)}
                    style={{ width: `${cardWidth}px` }}
                    className={`relative aspect-[2/3] rounded-2xl overflow-hidden border transition-all cursor-pointer group select-none shrink-0 ${
                      isSelected
                        ? "border-yuui-accent shadow-[0_0_15px_rgba(255,95,162,0.35)] scale-[1.02]"
                        : "border-white/[0.05] hover:border-white/15 bg-black/20"
                    }`}
                  >
                    <img
                      src={(e.media?.coverImage as any)?.large || (e.media?.coverImage as any)?.medium || "https://s4.anilist.co/file/anilist/user/avatar/large/default.png"}
                      alt={e.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 bg-white/5"
                    />
                    
                    {/* Compact Glass Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent flex flex-col justify-end p-2.5 opacity-90 group-hover:opacity-100 transition-opacity">
                      <p className="text-[10.5px] font-bold text-white leading-tight line-clamp-2 mb-1" title={e.title}>
                        {e.title}
                      </p>
                      <div className="flex items-center justify-between text-[9px] text-white/50 font-semibold font-mono">
                        <span>{currentProgress}/{max} eps</span>
                        {e.user?.score ? <span className="text-pink-400 font-bold">★ {e.user.score}</span> : null}
                      </div>
                      
                      {/* Mini Progress Bar */}
                      <div className="h-1 w-full bg-white/10 rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-yuui-accent to-pink-500 rounded-full" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredMiddleList.length === 0 && (
            <div className="text-center py-16 text-xs text-yuui-muted select-none">No library entries found.</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
