import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useLibrary } from "../../store/library";
import { 
  BarChart3, Save, X 
} from "lucide-react";

export default function StatsPage() {
  const { entries: localEntries, status: localStatus, saveUserData, init } = useLibrary();

  useEffect(() => {
    init();
  }, [init]);

  const [searchQuery, setSearchQuery] = useState("");
  const [listFilter, setListFilter] = useState("All");
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [coverSize, setCoverSize] = useState(64);

  // Quick edit state variables
  const [editStatus, setEditStatus] = useState("Watching");
  const [editProgress, setEditProgress] = useState(0);
  const [editScore, setEditScore] = useState(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Map local entries into uniform shape
  const activeEntries = useMemo(() => {
    return localEntries.map((e) => ({
      key: e.key,
      title: e.media?.title.english || e.media?.title.romaji || e.title,
      episode_count: e.media?.episodes || e.episode_count,
      media: e.media,
      user: e.user || {
        progress: 0,
        status: "Untracked",
        score: 0,
      },
    }));
  }, [localEntries]);

  // Selected entry for Quick Edit
  const selectedEntry = useMemo(() => {
    return activeEntries.find((e) => e.key === selectedRowKey) || null;
  }, [activeEntries, selectedRowKey]);

  // Sync quick edit state
  useEffect(() => {
    if (selectedEntry) {
      setEditStatus(!selectedEntry.user || selectedEntry.user.status === "Untracked" ? "Watching" : (selectedEntry.user.status || "Watching"));
      setEditProgress(selectedEntry.user?.progress || 0);
      setEditScore(selectedEntry.user?.score || 0);
    }
  }, [selectedRowKey]);

  const handleSaveEdit = async () => {
    if (!selectedEntry) return;
    setIsSavingEdit(true);
    try {
      await saveUserData(selectedEntry.key, {
        progress: editProgress,
        status: editStatus,
        score: editScore,
        notes: (selectedEntry as any).user?.notes || "",
        favorite: (selectedEntry as any).user?.favorite || false,
      });
      setSelectedRowKey(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Local metrics calculations
  const collectionStats = useMemo(() => {
    let totalWatchedEps = 0;
    let totalSize = 0;
    let scoredCount = 0;
    let totalScoreSum = 0;
    let completedCount = 0;

    const genresMap: Record<string, number> = {};
    const formatsMap: Record<string, number> = {};

    localEntries.forEach((e) => {
      const epProgress = e.user?.progress ?? 0;
      totalWatchedEps += epProgress;

      const entrySize = e.files.reduce((sum, f: any) => sum + f.size_bytes, 0);
      totalSize += entrySize;

      const maxEps = e.media?.episodes ?? e.episode_count ?? 1;
      if (e.user?.status === "Completed" || epProgress >= maxEps) {
        completedCount += 1;
      }

      if (e.user?.score) {
        scoredCount += 1;
        totalScoreSum += e.user.score;
      }

      if (e.media?.genres) {
        e.media.genres.forEach((g: string) => {
          genresMap[g] = (genresMap[g] || 0) + 1;
        });
      }

      if (e.media?.format) {
        formatsMap[e.media.format] = (formatsMap[e.media.format] || 0) + 1;
      }
    });

    const averageRating = scoredCount > 0 ? (totalScoreSum / scoredCount).toFixed(1) : "—";
    const completionRate = localEntries.length > 0 ? Math.round((completedCount / localEntries.length) * 100) : 0;
    
    const sortedGenres = Object.entries(genresMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const formatBreakdown = Object.entries(formatsMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalHours: Math.round((totalWatchedEps * 24) / 60),
      totalSize,
      averageRating,
      completionRate,
      topGenres: sortedGenres,
      formatBreakdown,
      completedCount,
    };
  }, [localEntries]);

  // Filter local database grid
  const filteredMiddleList = useMemo(() => {
    return activeEntries.filter((e) => {
      if (listFilter === "Watching" && e.user?.status !== "Watching") return false;
      if (listFilter === "Completed" && e.user?.status !== "Completed") return false;
      if (listFilter === "Planning" && e.user?.status !== "Planning") return false;
      
      if (searchQuery.trim()) {
        const titleText = (e.title || "").toLowerCase();
        return titleText.includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [activeEntries, listFilter, searchQuery]);

  const watchingCount = useMemo(() => activeEntries.filter((e) => e.user?.status === "Watching").length, [activeEntries]);
  const completedCount = useMemo(() => activeEntries.filter((e) => e.user?.status === "Completed").length, [activeEntries]);
  const planningCount = useMemo(() => activeEntries.filter((e) => e.user?.status === "Planning").length, [activeEntries]);

  if (localStatus === "loading") {
    return (
      <div className="p-8 space-y-6 h-full overflow-y-auto">
        <div className="h-16 glass bg-yuui-surface/20 border border-white/[0.05] rounded-3xl animate-pulse" />
        <div className="grid md:grid-cols-2 gap-6">
          <div className="h-96 glass bg-yuui-surface/20 border border-white/[0.05] rounded-3xl animate-pulse" />
          <div className="h-96 glass bg-yuui-surface/20 border border-white/[0.05] rounded-3xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6 overflow-y-auto text-white space-y-5 select-none scrollbar-thin">
      
      {/* Profile Header Banner */}
      <motion.header 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center gap-6 p-6 rounded-3xl glass border border-white/[0.05] bg-yuui-surface/40 relative overflow-hidden shrink-0"
      >
        <div className="absolute top-0 right-0 w-64 h-32 bg-yuui-accent/5 blur-3xl rounded-full" />
        
        <div className="flex items-center gap-5 relative z-10 shrink-0">
          <div className="h-16 w-16 rounded-2xl border-2 border-dashed border-white/20 bg-white/5 flex items-center justify-center text-2xl text-yuui-muted shrink-0 select-none">
            📊
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight leading-none font-display">
              Collection Statistics
            </h1>
            <div className="flex items-center gap-2.5 mt-1.5">
              <span className="text-[9.5px] font-bold text-yuui-muted bg-white/5 rounded-md px-2 py-0.5 border border-white/[0.03] select-none">
                Local Mode Only
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats badges */}
        <div className="flex flex-wrap items-center gap-3 relative z-10 max-w-2xl select-none md:ml-6">
          <div className="glass rounded-xl px-2.5 py-1 border border-white/[0.04] bg-[#1a1d27]/40 flex flex-col min-w-[70px] text-center shrink-0">
            <span className="text-sm font-black text-yuui-accent font-display">{activeEntries.length}</span>
            <span className="text-[8px] text-yuui-muted font-bold uppercase tracking-wider">Total</span>
          </div>
          <div className="glass rounded-xl px-2.5 py-1 border border-white/[0.04] bg-[#1a1d27]/40 flex flex-col min-w-[70px] text-center shrink-0">
            <span className="text-sm font-black text-pink-400 font-display">{completedCount}</span>
            <span className="text-[8px] text-yuui-muted font-bold uppercase tracking-wider">Done</span>
          </div>
          <div className="glass rounded-xl px-2.5 py-1 border border-white/[0.04] bg-[#1a1d27]/40 flex flex-col min-w-[70px] text-center shrink-0">
            <span className="text-sm font-black text-white font-display">{collectionStats.totalHours}</span>
            <span className="text-[8px] text-yuui-muted font-bold uppercase tracking-wider">Hours</span>
          </div>
          <div className="glass rounded-xl px-2.5 py-1 border border-white/[0.04] bg-[#1a1d27]/40 flex flex-col min-w-[70px] text-center shrink-0">
            <span className="text-sm font-black text-pink-400 font-display">{collectionStats.averageRating}</span>
            <span className="text-[8px] text-yuui-muted font-bold uppercase tracking-wider">Rating</span>
          </div>
          
          {/* Cover Scale Slider */}
          <div className="glass rounded-xl px-3 py-1 border border-white/[0.04] bg-[#1a1d27]/40 flex items-center gap-2 shrink-0 h-[38px]">
            <span className="text-[9.5px] text-yuui-muted font-bold uppercase tracking-wider select-none">Cover Size</span>
            <input 
              type="range" 
              min="40" 
              max="140" 
              value={coverSize} 
              onChange={(e) => setCoverSize(parseInt(e.target.value))} 
              className="w-20 accent-yuui-accent cursor-pointer h-1 rounded-lg bg-white/10"
            />
            <span className="text-[9.5px] font-mono font-bold text-white w-8 text-right select-none">{coverSize}px</span>
          </div>
        </div>
      </motion.header>

      {/* Grid Content Canvas */}
      <div className="grid grid-cols-12 gap-5 items-start flex-grow min-h-0 overflow-hidden" style={{ maxHeight: "80vh" }}>
        
        {/* LEFT COLUMN: Sidebar Navigation & Filters */}
        <div className="col-span-3 flex flex-col gap-4 overflow-y-auto pr-1 h-full select-none">
          
          <div className="glass rounded-3xl p-3.5 border border-white/[0.05] bg-yuui-surface/40 space-y-1">
            <span className="text-[9px] font-bold text-yuui-muted uppercase tracking-wider block px-2.5 mb-1.5 font-display">Collections</span>
            
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-yuui-accent/15 border-l-2 border-yuui-accent text-left"
            >
              <BarChart3 className="h-4 w-4 text-yuui-accent" />
              <span>Local Statistics</span>
            </button>
          </div>

          <div className="flex-grow flex flex-col gap-4 min-h-0">
            <div className="space-y-4">
              {selectedEntry ? (
                /* QUICK EDIT DRAWER */
                <div className="glass rounded-3xl p-5 border border-yuui-accent bg-yuui-surface/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-yuui-accent font-bold uppercase tracking-wider">Quick Editor</span>
                    <button onClick={() => setSelectedRowKey(null)} className="text-yuui-muted hover:text-white cursor-pointer"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white leading-tight line-clamp-2">{selectedEntry.title}</h4>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-yuui-muted uppercase font-bold tracking-wider">Status</label>
                    <select 
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full bg-[#11131a]/60 border border-white/[0.05] rounded-xl px-2.5 py-1.5 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="Watching">Watching</option>
                      <option value="Completed">Completed</option>
                      <option value="Planning">Planning</option>
                      <option value="Paused">Paused</option>
                      <option value="Dropped">Dropped</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-yuui-muted uppercase font-bold tracking-wider">Progress</label>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditProgress(Math.max(0, editProgress - 1))} className="h-8 w-8 rounded-lg bg-white/5 border border-white/[0.05] hover:bg-white/10 flex items-center justify-center text-white cursor-pointer">-</button>
                      <input type="number" value={editProgress} onChange={(e) => setEditProgress(Math.min(selectedEntry.episode_count, Math.max(0, parseInt(e.target.value) || 0)))} className="flex-1 bg-[#11131a]/60 border border-white/[0.05] rounded-lg px-2 py-1.5 text-center text-xs text-white outline-none font-mono" />
                      <button onClick={() => setEditProgress(Math.min(selectedEntry.episode_count, editProgress + 1))} className="h-8 w-8 rounded-lg bg-white/5 border border-white/[0.05] hover:bg-white/10 flex items-center justify-center text-white cursor-pointer">+</button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-yuui-muted uppercase font-bold tracking-wider">Score (0-10)</label>
                    <div className="flex items-center gap-2">
                      <input type="range" min="0" max="10" step="0.5" value={editScore} onChange={(e) => setEditScore(parseFloat(e.target.value))} className="flex-1 accent-yuui-accent cursor-pointer" />
                      <span className="text-xs font-bold text-pink-400 font-mono w-8 text-right">★{editScore || "—"}</span>
                    </div>
                  </div>
                  <button onClick={handleSaveEdit} disabled={isSavingEdit} className="w-full rounded-xl py-2 text-xs font-semibold text-white bg-gradient-to-r from-yuui-accent to-yuui-accent2 hover:scale-[1.02] shadow-glow transition-all cursor-pointer flex items-center justify-center gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    {isSavingEdit ? "Saving..." : "Save Local Details"}
                  </button>
                </div>
              ) : (
                /* DATABASE FILTERS */
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block px-1">Filter</label>
                    <input
                      type="text"
                      placeholder="Search local library..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl px-2.5 py-1.5 text-xs text-white outline-none border border-white/[0.05] bg-white/[0.01] focus:border-yuui-accent/60 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block px-1">Lists</label>
                    <div className="space-y-1">
                      {["All", "Watching", "Completed", "Planning"].map((tabName) => {
                        const count = tabName === "All" ? activeEntries.length :
                                      tabName === "Watching" ? watchingCount :
                                      tabName === "Completed" ? completedCount :
                                      planningCount;
                        return (
                          <div 
                            key={tabName}
                            onClick={() => setListFilter(tabName)}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 ${
                              listFilter === tabName ? "text-white bg-yuui-accent/10 border-l-2 border-yuui-accent" : "text-yuui-muted hover:text-white hover:bg-white/[0.02]"
                            }`}
                          >
                            <span>{tabName} Library</span>
                            <span className="text-[10px] font-mono">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT CANVAS: Local Stats and Series Grid (col-span-9) */}
        <div className="col-span-9 h-full min-h-0 overflow-hidden flex flex-col gap-5">
          {/* Top Row Stats Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
            <div className="glass rounded-3xl p-5 border border-white/[0.05] bg-yuui-surface/20">
              <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">Watch Hours</span>
              <div className="mt-2 text-2xl font-bold font-display text-white">
                {collectionStats.totalHours}{" "}
                <span className="text-xs font-semibold text-yuui-muted">Hours</span>
              </div>
            </div>
            <div className="glass rounded-3xl p-5 border border-white/[0.05] bg-yuui-surface/20">
              <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">Average Rating</span>
              <div className="mt-2 text-2xl font-bold font-display text-white">{collectionStats.averageRating} <span className="text-xs font-semibold text-yuui-muted">/ 10</span></div>
            </div>
            <div className="glass rounded-3xl p-5 border border-white/[0.05] bg-yuui-surface/20">
              <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">Completion Rate</span>
              <div className="mt-2 text-2xl font-bold font-display text-white">{collectionStats.completionRate}%</div>
            </div>
            <div className="glass rounded-3xl p-5 border border-white/[0.05] bg-yuui-surface/20">
              <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">Library Storage</span>
              <div className="mt-2 text-2xl font-bold font-display text-white">{(collectionStats.totalSize / (1024 * 1024 * 1024)).toFixed(1)} <span className="text-xs font-semibold text-yuui-muted">GB</span></div>
            </div>
          </div>

          {/* Bottom Columns: Grid List & Genre breakdown */}
          <div className="flex-1 grid grid-cols-12 gap-5 min-h-0 overflow-hidden">
            {/* Local Database Grid List (col-span-8) */}
            <div className="col-span-8 glass rounded-3xl border border-white/[0.05] bg-yuui-surface/40 flex flex-col min-h-0 overflow-hidden">
              <div className="p-3.5 border-b border-white/[0.04] flex items-center justify-between shrink-0">
                <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider font-display">{listFilter} Database Grid</span>
                <span className="text-[9px] text-yuui-accent font-semibold">{filteredMiddleList.length} titles listed</span>
              </div>
              
              <div className="flex-grow overflow-y-auto p-4 space-y-2.5 scrollbar-thin">
                {filteredMiddleList.map((e) => {
                  const currentProgress = e.user?.progress ?? 0;
                  const max = e.media?.episodes ?? e.episode_count;
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
                        <span className="block truncate text-xs font-semibold text-white max-w-[360px]" title={e.title}>
                          {e.title}
                        </span>
                        <div className="h-1.5 w-32 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-yuui-accent to-pink-500 rounded-full" style={{ width: `${(currentProgress / max) * 100}%` }} />
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
                {filteredMiddleList.length === 0 && (
                  <div className="text-center py-16 text-xs text-yuui-muted select-none">No library entries found.</div>
                )}
              </div>
            </div>

            {/* Genre breakdown card (col-span-4) */}
            <div className="col-span-4 glass rounded-3xl p-5 border border-white/[0.05] bg-yuui-surface/40 flex flex-col overflow-y-auto scrollbar-thin">
              <h3 className="text-xs font-bold text-white/90 uppercase tracking-wider font-display mb-4">Collection Genres</h3>
              <div className="space-y-4">
                {collectionStats.topGenres.map(([genre, count]) => {
                  const max = collectionStats.topGenres[0]?.[1] || 1;
                  return (
                    <div key={genre} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-white/80">{genre}</span>
                        <span className="text-yuui-muted">{count} titles</span>
                      </div>
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-yuui-accent to-yuui-accent2 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
                {collectionStats.topGenres.length === 0 && (
                  <div className="text-center py-16 text-xs text-yuui-muted">No genres detected in library.</div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
