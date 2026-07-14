import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Grid, Heart, Search, Save, X } from "lucide-react";
import { graphqlAnilist } from "../../../lib/api";
import { syncAllToAnilist, deleteMediaEntry } from "./api";

interface ProfileSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedEntry: any;
  selectedRowKey: string | null;
  setSelectedRowKey: (key: string | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  listFilter: string;
  setListFilter: (filter: string) => void;
  stats: any;
  watchingCount: number;
  completedCount: number;
  planningCount: number;
  saveUserData: any;
  refetch: (silent?: boolean) => Promise<void>;
  entries: any[];
}

export default function ProfileSidebar({
  activeTab,
  setActiveTab,
  selectedEntry,
  selectedRowKey,
  setSelectedRowKey,
  searchQuery,
  setSearchQuery,
  listFilter,
  setListFilter,
  stats,
  watchingCount,
  completedCount,
  planningCount,
  saveUserData,
  refetch,
  entries,
}: ProfileSidebarProps) {
  // Quick edit state variables
  const [editStatus, setEditStatus] = useState("Watching");
  const [editProgress, setEditProgress] = useState(0);
  const [editScore, setEditScore] = useState(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteEntry = async () => {
    if (!selectedEntry) return;
    if (!window.confirm(`Are you sure you want to remove ${selectedEntry.title} from your AniList library?`)) {
      return;
    }
    setIsDeleting(true);
    try {
      const listEntryId = parseInt(selectedEntry.key);
      if (!isNaN(listEntryId)) {
        await deleteMediaEntry(graphqlAnilist, listEntryId);
      }
      
      // Also update locally if matched folder exists: set to Untracked status, progress 0, score 0, favorite false
      const localEntry = entries.find((le: any) => le.media?.id === selectedEntry.media.id);
      if (localEntry) {
        await saveUserData(localEntry.key, {
          progress: 0,
          status: "Untracked",
          score: 0,
          notes: localEntry.user?.notes || "",
          favorite: false,
        });
      }

      await refetch(true);
      setSelectedRowKey(null);
    } catch (e) {
      console.error("Failed to delete entry:", e);
    } finally {
      setIsDeleting(false);
    }
  };

  // Sync quick edit states when selection changes
  useEffect(() => {
    if (selectedEntry) {
      setEditStatus(!selectedEntry.user || selectedEntry.user.status === "Untracked" ? "Watching" : (selectedEntry.user.status || "Watching"));
      setEditProgress(selectedEntry.user?.progress || 0);
      setEditScore(selectedEntry.user?.score || 0);
      setIsDropdownOpen(false);
    }
  }, [selectedRowKey]);

  const handleSaveEdit = async () => {
    if (!selectedEntry) return;
    setIsSavingEdit(true);
    try {
      const mediaId = selectedEntry.media?.id;

      // Update locally if matched folder exists
      const localEntry = entries.find((le: any) => le.media?.id === selectedEntry.media.id);
      if (localEntry) {
        await saveUserData(localEntry.key, {
          progress: editProgress,
          status: editStatus,
          score: editScore,
          notes: localEntry.user?.notes || "",
          favorite: localEntry.user?.favorite || false,
        });
      }

      // Update online
      if (mediaId) {
        await syncAllToAnilist(graphqlAnilist, mediaId, editProgress, editStatus, editScore);
      }

      // Reload
      await refetch(true);
      setSelectedRowKey(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="col-span-3 flex flex-col gap-4 overflow-y-auto pr-1 h-full select-none">

      <div className="glass rounded-3xl p-3.5 border border-white/[0.05] bg-yuui-surface/40 space-y-1">
        <span className="text-[9px] font-bold text-yuui-muted uppercase tracking-wider block px-2.5 mb-1.5 font-display">Navigation</span>

        <button
          onClick={() => setActiveTab("overview")}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "overview"
              ? "text-white bg-yuui-accent/15 border-l-2 border-yuui-accent"
              : "text-yuui-muted hover:text-white hover:bg-white/[0.02]"
          }`}
        >
          <Grid className="h-4 w-4" />
          <span>Cloud Library</span>
        </button>

        <button
          onClick={() => setActiveTab("favorites")}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "favorites"
              ? "text-white bg-yuui-accent/15 border-l-2 border-yuui-accent"
              : "text-yuui-muted hover:text-white hover:bg-white/[0.02]"
          }`}
        >
          <Heart className="h-4 w-4" />
          <span>Favorites</span>
        </button>

        <button
          onClick={() => setActiveTab("search")}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "search"
              ? "text-white bg-yuui-accent/15 border-l-2 border-yuui-accent"
              : "text-yuui-muted hover:text-white hover:bg-white/[0.02]"
          }`}
        >
          <Search className="h-4 w-4" />
          <span>Search & Add</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-4 min-h-0">
        <AnimatePresence mode="wait">
          {(activeTab === "overview" || activeTab === "search") && (
            <motion.div
              key="sidebar-context"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-4"
            >
              {selectedEntry ? (
                /* QUICK EDIT DRAWER */
                <div className="glass rounded-3xl p-5 border border-yuui-accent bg-yuui-surface/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-yuui-accent font-bold uppercase tracking-wider">
                      {selectedEntry.isNew ? "Add Title" : "Quick Editor"}
                    </span>
                    <button onClick={() => setSelectedRowKey(null)} className="text-yuui-muted hover:text-white cursor-pointer"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white leading-tight line-clamp-2">{selectedEntry.title}</h4>
                  </div>
                  <div className="space-y-1 relative z-30">
                    <label className="text-[9px] text-yuui-muted uppercase font-bold tracking-wider">Status</label>
                    <div className="relative">
                      <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full bg-[#11131a]/60 border border-white/[0.05] rounded-xl px-2.5 py-1.5 text-xs text-white flex items-center justify-between outline-none cursor-pointer hover:border-white/10 transition-colors"
                      >
                        <span>{editStatus}</span>
                        <span className="text-[9px] opacity-40">▼</span>
                      </button>
                      
                      {isDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                          <div className="absolute top-full left-0 right-0 mt-1 z-50 glass rounded-xl py-1 bg-[#10121a]/95 border border-white/[0.08] shadow-lg overflow-hidden">
                            {((selectedEntry?.media?.status ?? "FINISHED") === "FINISHED"
                              ? ["Watching", "Completed", "Planning", "Paused", "Dropped"]
                              : ["Watching", "Planning", "Paused", "Dropped"]
                            ).map((opt) => (
                              <div
                                key={opt}
                                onClick={() => {
                                  setEditStatus(opt);
                                  setIsDropdownOpen(false);
                                }}
                                className={`px-3 py-2 text-xs cursor-pointer transition-colors ${
                                  editStatus === opt
                                    ? "bg-yuui-accent/20 text-white font-bold"
                                    : "text-white/70 hover:bg-white/[0.04] hover:text-white"
                                }`}
                              >
                                {opt}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
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
                  
                  <div className="flex gap-2 pt-1.5">
                    <button 
                      onClick={handleSaveEdit} 
                      disabled={isSavingEdit || isDeleting} 
                      className="flex-1 rounded-xl py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-yuui-accent to-yuui-accent2 hover:scale-[1.01] shadow-glow transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSavingEdit ? "Saving..." : selectedEntry.isNew ? "Add & Sync" : "Save & Sync"}
                    </button>
                    
                    {!selectedEntry.isNew && (
                      <button
                        onClick={handleDeleteEntry}
                        disabled={isSavingEdit || isDeleting}
                        className="px-3 rounded-xl py-2.5 text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 hover:border-red-500/30 hover:scale-[1.01] transition-all cursor-pointer flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Remove from Library"
                      >
                        {isDeleting ? "..." : "Remove"}
                      </button>
                    )}
                  </div>
                </div>
                ) : (
                  activeTab === "overview" ? (
                    /* DATABASE FILTERS */
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block px-1">Filter</label>
                        <input
                          type="text"
                          placeholder="Search cloud lists..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full rounded-xl px-2.5 py-1.5 text-xs text-white outline-none border border-white/[0.05] bg-white/[0.01] focus:border-yuui-accent/60 transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block px-1">Lists</label>
                        <div className="space-y-1">
                          {["All", "Watching", "Completed", "Planning"].map((tabName) => {
                            const count = tabName === "All" ? stats.totalAnime :
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
                  ) : null
                )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
