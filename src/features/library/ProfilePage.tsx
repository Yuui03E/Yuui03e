import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLibrary } from "../../store/library";
import { graphqlAnilist } from "../../lib/api";
import { openUrl } from "@tauri-apps/plugin-opener";
import { 
  Grid, Heart, Search, Save, X 
} from "lucide-react";

interface ViewerProfile {
  id: number;
  name: string;
  avatar: { large: string };
  bannerImage: string | null;
  favourites?: {
    anime: {
      nodes: {
        id: number;
        title: { english: string | null; romaji: string };
        coverImage: { medium: string; large: string };
        format?: string;
        episodes?: number;
      }[];
    };
    characters: {
      nodes: {
        id: number;
        name: { full: string };
        image: { large: string; medium: string };
      }[];
    };
  };
}

interface OnlineEntry {
  id: number;
  status: string;
  score: number;
  progress: number;
  media: {
    id: number;
    title: { english: string | null; romaji: string };
    coverImage: { medium: string; large: string };
    format: string;
    episodes: number | null;
    duration: number | null;
    genres: string[];
    countryOfOrigin: string;
  };
}

export default function ProfilePage() {
  const { saveUserData, anilistUser, logoutAnilist, loginAnilist } = useLibrary();
  
  // React Router tabs sync with memory
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTabState] = useState(() => {
    const queryTab = searchParams.get("tab");
    if (queryTab) return queryTab;
    const savedTab = localStorage.getItem("profile_active_tab");
    return savedTab || "overview";
  });

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    setSearchParams({ tab });
    localStorage.setItem("profile_active_tab", tab);
  };

  useEffect(() => {
    const queryTab = searchParams.get("tab");
    if (queryTab && queryTab !== activeTab) {
      setActiveTabState(queryTab);
    }
  }, [searchParams]);

  const [profile, setProfile] = useState<ViewerProfile | null>(null);
  const [onlineEntries, setOnlineEntries] = useState<OnlineEntry[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  
  const [coverSize, setCoverSize] = useState(64);

  // Dynamic filter states with memory
  const [listFilter, setListFilterState] = useState(() => {
    return localStorage.getItem("profile_list_filter") || "All";
  });
  const setListFilter = (filter: string) => {
    setListFilterState(filter);
    localStorage.setItem("profile_list_filter", filter);
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);

  // Quick edit state variables
  const [editStatus, setEditStatus] = useState("Watching");
  const [editProgress, setEditProgress] = useState(0);
  const [editScore, setEditScore] = useState(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Global search & add state
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);
  const [addingMediaId, setAddingMediaId] = useState<number | null>(null);
  const [addStatus, setAddStatus] = useState("PLANNING");
  const [addProgress, setAddProgress] = useState(0);
  const [addScore, setAddScore] = useState(0);

  // Connection settings states
  const [tokenInput, setTokenInput] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!tokenInput.trim()) return;
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      await loginAnilist(tokenInput.trim());
      setTokenInput("");
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setIsConnecting(false);
    }
  };

  // GraphQL query helper to sync details to AniList list
  const syncAllToAnilist = async (mediaId: number, progress: number, status: string, score: number) => {
    try {
      let alStatus = "CURRENT";
      if (status === "Completed") alStatus = "COMPLETED";
      else if (status === "Planning") alStatus = "PLANNING";
      else if (status === "Paused") alStatus = "PAUSED";
      else if (status === "Dropped") alStatus = "DROPPED";

      await graphqlAnilist(
        `mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus, $score: Float) {
          SaveMediaListEntry (mediaId: $mediaId, progress: $progress, status: $status, score: $score) {
            id
            progress
            status
            score
          }
        }`,
        { mediaId, progress, status: alStatus, score }
      );
    } catch (e) {
      console.error("Failed to sync media list entry to AniList", e);
    }
  };

  const fetchProfileAndList = async () => {
    if (!anilistUser) return;
    setLoadingProfile(true);
    try {
      // Fetch viewer details + online favorites
      const profileResp = await graphqlAnilist(
        `query { 
          Viewer { 
            id 
            name 
            avatar { large } 
            bannerImage 
            favourites {
              anime {
                nodes {
                  id
                  title { english romaji }
                  coverImage { medium large }
                  format
                  episodes
                }
              }
              characters {
                nodes {
                  id
                  name { full }
                  image { large medium }
                }
              }
            }
          } 
        }`, 
        {}
      );
      const viewer = profileResp?.data?.Viewer;
      if (viewer) {
        setProfile(viewer);
        
        // Fetch entire media list collection (Anime)
        const listResp = await graphqlAnilist(
          `query ($userId: Int) {
            MediaListCollection (userId: $userId, type: ANIME) {
              lists {
                entries {
                  id
                  status
                  score (format: POINT_10)
                  progress
                  media {
                    id
                    title { english romaji }
                    coverImage { medium large }
                    format
                    episodes
                    duration
                    genres
                    countryOfOrigin
                  }
                }
              }
            }
          }`,
          { userId: viewer.id }
        );
        
        const lists = listResp?.data?.MediaListCollection?.lists || [];
        const allEntries: OnlineEntry[] = [];
        lists.forEach((list: any) => {
          if (list?.entries) {
            allEntries.push(...list.entries);
          }
        });
        setOnlineEntries(allEntries);
      }
    } catch (e) {
      console.warn("Failed to fetch online AniList profile statistics", e);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchProfileAndList();
  }, [anilistUser]);

  // Locked to Cloud Entries only
  const activeEntries = useMemo(() => {
    return onlineEntries.map((e) => ({
      key: String(e.id),
      title: e.media.title.english || e.media.title.romaji,
      episode_count: e.media.episodes || 12,
      media: {
        id: e.media.id,
        title: e.media.title,
        coverImage: e.media.coverImage,
        format: e.media.format,
        episodes: e.media.episodes,
        duration: e.media.duration,
        genres: e.media.genres,
        countryOfOrigin: e.media.countryOfOrigin,
      },
      user: {
        progress: e.progress,
        status: e.status.charAt(0) + e.status.slice(1).toLowerCase(),
        score: e.score,
      },
    }));
  }, [onlineEntries]);

  // Selected entry for Quick Edit
  const selectedEntry = useMemo(() => {
    return activeEntries.find((e) => e.key === selectedRowKey) || null;
  }, [activeEntries, selectedRowKey]);

  // Sync quick edit states when selection changes
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
      const mediaId = selectedEntry.media?.id;
      
      // Update locally if matched folder exists
      await saveUserData(selectedEntry.key, {
        progress: editProgress,
        status: editStatus,
        score: editScore,
        notes: (selectedEntry as any).user?.notes || "",
        favorite: (selectedEntry as any).user?.favorite || false,
      });

      // Update online
      if (mediaId) {
        await syncAllToAnilist(mediaId, editProgress, editStatus, editScore);
      }

      // Reload
      await fetchProfileAndList();
      setSelectedRowKey(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Global search triggers
  const handleGlobalSearch = async () => {
    if (!globalSearchQuery.trim()) return;
    setSearchingGlobal(true);
    try {
      const resp = await graphqlAnilist(
        `query ($search: String) {
          Page (perPage: 12) {
            media (search: $search, type: ANIME) {
              id
              title { english romaji }
              coverImage { large }
              format
              episodes
              averageScore
            }
          }
        }`,
        { search: globalSearchQuery }
      );
      setGlobalSearchResults(resp?.data?.Page?.media || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setSearchingGlobal(false);
    }
  };

  const handleAddMedia = async (media: any) => {
    try {
      let alStatus = "PLANNING";
      if (addStatus === "WATCHING") alStatus = "CURRENT";
      else if (addStatus === "COMPLETED") alStatus = "COMPLETED";

      await graphqlAnilist(
        `mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus, $score: Float) {
          SaveMediaListEntry (mediaId: $mediaId, progress: $progress, status: $status, score: $score) {
            id
          }
        }`,
        { mediaId: media.id, progress: addProgress, status: alStatus, score: addScore }
      );

      // Reload
      await fetchProfileAndList();
      setAddingMediaId(null);
    } catch (e) {
      console.warn("Failed to add entry", e);
    }
  };

  // Compute calculated metrics
  const stats = useMemo(() => {
    const totalAnime = activeEntries.length;
    const completedCount = activeEntries.filter((e) => e.user?.status === "Completed").length;
    const totalEpisodes = activeEntries.reduce((sum, e) => sum + (e.user?.progress || 0), 0);
    const totalMinutes = activeEntries.reduce((sum, e) => sum + (e.user?.progress || 0) * (e.media?.duration || 24), 0);
    const daysWatched = (totalMinutes / 1440).toFixed(1);

    const scores = activeEntries
      .map((e) => {
        let sc = e.user?.score || 0;
        if (sc > 10) sc = sc / 10;
        return sc;
      })
      .filter((s) => s > 0);

    const meanScore = scores.length
      ? (scores.reduce((sum, s) => sum + s, 0) / scores.length * 10).toFixed(0) + "%"
      : "0%";

    return {
      totalAnime,
      completedCount,
      totalEpisodes,
      daysWatched,
      meanScore,
    };
  }, [activeEntries]);

  const watchingCount = useMemo(() => activeEntries.filter((e) => e.user?.status === "Watching").length, [activeEntries]);
  const completedCount = useMemo(() => activeEntries.filter((e) => e.user?.status === "Completed").length, [activeEntries]);
  const planningCount = useMemo(() => activeEntries.filter((e) => e.user?.status === "Planning").length, [activeEntries]);

  // Filter middle list
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

  // 1. Logged Out View - Locked to Connect Account card
  if (!anilistUser) {
    return (
      <div className="flex h-full flex-col p-6 overflow-y-auto text-white select-none">
        <header className="flex items-center justify-between px-6 py-3.5 rounded-2xl glass border border-white/[0.06] bg-yuui-surface/40 backdrop-blur-md shrink-0 mb-6 font-display">
          <div className="flex items-center gap-6">
            <span className="text-xl font-bold flex items-center gap-2">
              <span className="text-yuui-accent">🌸</span> Cloud Profile
            </span>
          </div>
        </header>

        <div className="flex-grow flex items-center justify-center -mt-12">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-[#0a0c10]/85 backdrop-blur-xl border border-white/[0.05] rounded-3xl p-8 space-y-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative"
          >
            <div className="space-y-1.5 text-center">
              <h3 className="text-xl font-bold text-white font-display flex items-center justify-center gap-2.5">
                <span className="text-yuui-accent">🌸</span> Log in with AniList
              </h3>
              <p className="text-xs text-yuui-muted font-sans leading-relaxed px-4">
                Using an AniList account is recommended to sync progress and ratings.
              </p>
            </div>

            <div className="space-y-5">
              {/* Dark capsule Get Token button */}
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    openUrl("https://anilist.co/api/v2/oauth/authorize?client_id=45032&response_type=token").catch((e) =>
                      console.error("Failed to open login link:", e)
                    );
                  }}
                  className="flex items-center justify-center gap-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/20 text-white font-semibold font-display px-5 py-3 text-xs shadow-md transition-all duration-200 cursor-pointer active:scale-98"
                >
                  <span className="bg-[#3db4f2]/20 text-[#3db4f2] px-2 py-0.5 rounded text-[9px] font-black font-sans leading-none tracking-tighter">AL</span>
                  <span>Get AniList token</span>
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-yuui-muted uppercase tracking-widest block font-sans">
                  Enter the token
                </label>
                <textarea
                  rows={4}
                  placeholder="Paste your developer access token here..."
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="w-full rounded-2xl px-4 py-3 text-xs text-white outline-none border border-white/[0.05] bg-black/40 focus:border-yuui-accent/50 focus:bg-black/60 transition-all font-mono resize-none leading-relaxed shadow-inner"
                />
              </div>

              <button
                onClick={handleConnect}
                disabled={isConnecting || !tokenInput.trim()}
                className="w-full rounded-2xl py-3 text-xs font-bold font-display text-white bg-yuui-accent hover:bg-yuui-accent/90 shadow-[0_4px_20px_rgba(255,95,162,0.25)] hover:scale-[1.01] active:scale-98 transition-all cursor-pointer disabled:opacity-40 disabled:scale-100 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isConnecting ? "Connecting..." : "Continue"}
              </button>

              {errorMsg && (
                <span className="text-[10px] font-medium text-red-400 mt-2 block text-center bg-red-500/10 border border-red-500/20 rounded-xl py-2 px-3">
                  ⚠ {errorMsg}
                </span>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // 2. Loading State
  if (loadingProfile) {
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

  // 3. Authenticated Dashboard
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
          <img
            src={profile?.avatar.large || "https://s4.anilist.co/file/anilist/user/avatar/large/default.png"}
            alt="Avatar"
            className="h-16 w-16 rounded-2xl border-2 border-white/10 hover:border-yuui-accent transition-all shadow-glow hover:scale-[1.03] object-cover shrink-0"
          />
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight leading-none font-display">
              {profile?.name || anilistUser?.name}
            </h1>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs text-yuui-muted font-mono">
                @{profile?.name?.toLowerCase() || anilistUser?.name?.toLowerCase()}
              </span>
              <button
                onClick={logoutAnilist}
                className="text-[9px] font-bold text-red-400 hover:text-red-300 hover:underline cursor-pointer ml-1"
              >
                Log out
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats badges */}
        <div className="flex flex-wrap items-center gap-3 relative z-10 max-w-2xl select-none md:ml-6">
          <div className="glass rounded-xl px-2.5 py-1 border border-white/[0.04] bg-[#1a1d27]/40 flex flex-col min-w-[70px] text-center shrink-0">
            <span className="text-sm font-black text-yuui-accent font-display">{stats.totalAnime}</span>
            <span className="text-[8px] text-yuui-muted font-bold uppercase tracking-wider">Cloud Total</span>
          </div>
          <div className="glass rounded-xl px-2.5 py-1 border border-white/[0.04] bg-[#1a1d27]/40 flex flex-col min-w-[70px] text-center shrink-0">
            <span className="text-sm font-black text-pink-400 font-display">{stats.completedCount}</span>
            <span className="text-[8px] text-yuui-muted font-bold uppercase tracking-wider">Completed</span>
          </div>
          <div className="glass rounded-xl px-2.5 py-1 border border-white/[0.04] bg-[#1a1d27]/40 flex flex-col min-w-[70px] text-center shrink-0">
            <span className="text-sm font-black text-white font-display">{stats.daysWatched}</span>
            <span className="text-[8px] text-yuui-muted font-bold uppercase tracking-wider">Days</span>
          </div>
          <div className="glass rounded-xl px-2.5 py-1 border border-white/[0.04] bg-[#1a1d27]/40 flex flex-col min-w-[70px] text-center shrink-0">
            <span className="text-sm font-black text-pink-400 font-display">{stats.meanScore}</span>
            <span className="text-[8px] text-yuui-muted font-bold uppercase tracking-wider">Mean Score</span>
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

      {/* Grid: Left Navigation Sidebar & Main Content Canvas */}
      <div className="grid grid-cols-12 gap-5 items-start flex-grow min-h-0 overflow-hidden" style={{ maxHeight: "80vh" }}>
        
        {/* LEFT COLUMN: Combined Navigation Menu (col-span-3) */}
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
              {activeTab === "overview" && (
                <motion.div
                  key="overview-context"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="space-y-4"
                >
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
                        {isSavingEdit ? "Saving..." : "Save & Cloud Sync"}
                      </button>
                    </div>
                  ) : (
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
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT CANVAS: Content Area (col-span-9) */}
        <div className="col-span-9 h-full min-h-0 overflow-hidden">
          <AnimatePresence mode="wait">
            
            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
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
                    <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">{listFilter} Database Grid</span>
                    <span className="text-[9px] text-yuui-accent font-semibold">{filteredMiddleList.length} titles listed</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin">
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
                            <span className="block truncate text-xs font-semibold text-white max-w-[450px]" title={e.title}>
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
              </motion.div>
            )}

            {/* TAB 2: FAVORITES */}
            {activeTab === "favorites" && (
              <motion.div
                key="favorites-tab"
                initial={{ opacity: 0, x: 5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                className="space-y-6 h-full overflow-y-auto pr-1 pb-8"
              >
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">Favorite Anime</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                    {profile?.favourites?.anime.nodes.map((anime) => (
                      <div key={anime.id} className="glass rounded-3xl p-3 border border-white/[0.04] bg-yuui-surface/20 flex flex-col justify-between group hover:scale-[1.03] transition-all duration-300">
                        <img src={anime.coverImage.large} alt="cover" className="h-64 w-full object-cover rounded-2xl border border-white/10 shadow-lg" />
                        <span className="text-xs font-bold text-white/90 line-clamp-2 mt-3 leading-tight group-hover:text-yuui-accent transition-colors text-center">{anime.title.english || anime.title.romaji}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">Favorite Characters</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                    {profile?.favourites?.characters.nodes.map((char) => (
                      <div key={char.id} className="glass rounded-3xl p-3 border border-white/[0.04] bg-yuui-surface/20 flex flex-col justify-between group hover:scale-[1.03] transition-all duration-300">
                        <img src={char.image.large} alt="avatar" className="h-64 w-full object-cover rounded-2xl border border-white/10 shadow-lg" />
                        <span className="text-xs font-bold text-white/90 line-clamp-1 mt-3 leading-tight group-hover:text-yuui-accent transition-colors text-center">{char.name.full}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 3: GLOBAL SEARCH */}
            {activeTab === "search" && (
              <motion.div
                key="search-tab"
                initial={{ opacity: 0, x: 5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                className="space-y-4 h-full overflow-y-auto pr-1 pb-8"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search AniList globally..."
                    value={globalSearchQuery}
                    onChange={(e) => setGlobalSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleGlobalSearch()}
                    className="flex-1 rounded-xl px-3.5 py-2 text-xs text-white outline-none border border-white/[0.05] bg-white/[0.01] focus:border-yuui-accent/60 transition-colors"
                  />
                  <button onClick={handleGlobalSearch} disabled={searchingGlobal} className="rounded-xl px-5 bg-gradient-to-r from-yuui-accent to-yuui-accent2 hover:scale-[1.02] transition-all cursor-pointer font-bold text-xs flex items-center gap-1.5 text-white">
                    <Search className="h-4 w-4" />
                    {searchingGlobal ? "Searching..." : "Search"}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                  {globalSearchResults.map((media) => {
                    const isAdding = addingMediaId === media.id;
                    return (
                      <div key={media.id} className="glass rounded-3xl p-3 border border-white/[0.04] bg-yuui-surface/20 flex flex-col justify-between hover:scale-[1.02] transition-all relative">
                        <div>
                          <img src={media.coverImage.large} alt="cover" className="h-64 w-full object-cover rounded-2xl border border-white/5" />
                          <span className="text-xs font-bold text-white/90 line-clamp-2 mt-3 leading-tight text-center">{media.title.english || media.title.romaji}</span>
                          <div className="flex justify-between items-center text-[10px] text-yuui-muted mt-2 select-none font-mono px-1">
                            <span>{media.format}</span>
                            <span>{media.episodes ? `${media.episodes} eps` : "Airing"}</span>
                          </div>
                        </div>
                        {isAdding ? (
                          <div className="mt-3 bg-black/60 p-2.5 rounded-xl border border-white/[0.06] space-y-2 absolute inset-0 flex flex-col justify-center">
                            <select value={addStatus} onChange={(e) => setAddStatus(e.target.value)} className="w-full bg-[#11131a] border border-white/10 rounded px-1.5 py-0.5 text-[10px]">
                              <option value="PLANNING">Planning</option>
                              <option value="WATCHING">Watching</option>
                              <option value="COMPLETED">Completed</option>
                            </select>
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] text-yuui-muted">Eps</span>
                              <input type="number" value={addProgress} onChange={(e) => setAddProgress(parseInt(e.target.value) || 0)} className="w-full bg-[#11131a] border border-white/10 rounded px-1 text-center text-[10px]" />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] text-yuui-muted">Score</span>
                              <input type="number" value={addScore} onChange={(e) => setAddScore(parseFloat(e.target.value) || 0)} className="w-full bg-[#11131a] border border-white/10 rounded px-1 text-center text-[10px]" />
                            </div>
                            <div className="flex gap-1.5 pt-1">
                              <button onClick={() => handleAddMedia(media)} className="flex-1 bg-yuui-accent rounded py-0.5 text-[9px] font-bold text-white">Add</button>
                              <button onClick={() => setAddingMediaId(null)} className="flex-1 bg-white/5 rounded py-0.5 text-[9px] text-white">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setAddingMediaId(media.id); setAddStatus("PLANNING"); setAddProgress(0); setAddScore(0); }} className="mt-4 w-full py-1.5 bg-white/5 border border-white/[0.04] hover:bg-yuui-accent hover:text-white rounded-xl text-[10px] font-bold cursor-pointer transition-colors text-white">
                            + Add to List
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
