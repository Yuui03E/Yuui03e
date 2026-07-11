import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLibrary } from "../../store/library";
import { graphqlAnilist } from "../../lib/api";
import { 
  Grid, BarChart3, Heart, Search, Save, X 
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

export default function ProfilePage({ defaultTab = "overview" }: { defaultTab?: string }) {
  const navigate = useNavigate();
  const { entries: localEntries, status: localStatus, saveUserData, anilistUser } = useLibrary();
  
  // React Router tabs sync with memory
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTabState] = useState(() => {
    const queryTab = searchParams.get("tab");
    if (queryTab) return queryTab;
    const savedTab = localStorage.getItem("profile_active_tab");
    return savedTab || defaultTab;
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
  const [dataSource, setDataSource] = useState<"online" | "local">("online");
  
  const [selectedOnlineMediaId, setSelectedOnlineMediaId] = useState<number | null>(null);
  const [selectedMediaDetail, setSelectedMediaDetail] = useState<any | null>(null);
  const [loadingMediaDetail, setLoadingMediaDetail] = useState(false);

  const fetchOnlineMediaDetail = async (mediaId: number) => {
    setLoadingMediaDetail(true);
    setSelectedMediaDetail(null);
    try {
      const query = `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            title { english romaji }
            coverImage { extraLarge large color }
            bannerImage
            episodes
            description(asHtml: false)
            streamingEpisodes {
              title
              thumbnail
              url
              site
            }
          }
        }
      `;
      const res = await graphqlAnilist(query, { id: mediaId });
      const media = res?.data?.Media;
      if (media) {
        setSelectedMediaDetail(media);
      }
    } catch (e) {
      console.error("Failed to fetch media detail", e);
    } finally {
      setLoadingMediaDetail(false);
    }
  };

  const [episodeChunkIndex, setEpisodeChunkIndex] = useState(0);

  useEffect(() => {
    setEpisodeChunkIndex(0);
  }, [selectedOnlineMediaId]);
  
  const [coverSize, setCoverSize] = useState(64); // slider for cover scale size

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
  const { loginAnilist } = useLibrary();
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
      setDataSource("online");
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

  // Unified entries array depending on selected dataSource
  const activeEntries = useMemo(() => {
    if (dataSource === "online") {
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
          status: e.status.charAt(0) + e.status.slice(1).toLowerCase(), // Normalize statuses
          score: e.score,
        },
      }));
    } else {
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
    }
  }, [dataSource, onlineEntries, localEntries]);

  // Find selected entry to populate Quick Edit details
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
      
      // Update locally
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

      // Reload online list entries to keep cloud and local synchronized
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

      // Save dummy matched key locally if we scanned a folder that contains it
      const matchingLocal = localEntries.find(e => e.media?.id === media.id);
      if (matchingLocal) {
        await saveUserData(matchingLocal.key, {
          progress: addProgress,
          status: addStatus.charAt(0) + addStatus.slice(1).toLowerCase(),
          score: addScore,
          notes: matchingLocal.user?.notes || "",
          favorite: matchingLocal.user?.favorite || false,
        });
      }

      // Reload
      await fetchProfileAndList();
      setAddingMediaId(null);
    } catch (e) {
      console.warn("Failed to add entry", e);
    }
  };

  // Compute calculated metrics based on active entries
  const stats = useMemo(() => {
    const totalAnime = activeEntries.length;
    const completedCount = activeEntries.filter((e) => e.user?.status === "Completed").length;
    const totalEpisodes = activeEntries.reduce((sum, e) => sum + (e.user?.progress || 0), 0);
    const totalMinutes = activeEntries.reduce((sum, e) => sum + (e.user?.progress || 0) * (e.media?.duration || 24), 0);
    const daysWatched = (totalMinutes / 1440).toFixed(1);
    const hoursWatched = (totalMinutes / 60).toFixed(0);

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

    let stdDeviation = "0.0";
    if (scores.length > 1) {
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
      stdDeviation = Math.sqrt(variance).toFixed(1);
    }

    return {
      totalAnime,
      completedCount,
      totalEpisodes,
      daysWatched,
      hoursWatched,
      meanScore,
      stdDeviation,
    };
  }, [activeEntries]);

  const watchingList = useMemo(() => {
    return activeEntries.filter(
      (e) => e.user && (e.user.status === "Watching" || (e.user.progress > 0 && e.user.status !== "Completed"))
    );
  }, [activeEntries]);

  const bottomList = useMemo(() => {
    return activeEntries.filter(
      (e) => e.user && (e.user.status === "Completed" || e.user.status === "Planning")
    );
  }, [activeEntries]);

  // Dynamic calculations for the Collection Stats tab (local file metrics)
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

  // Filter middle column database list reactively based on filter inputs
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

  const [playbackHistoryVersion, setPlaybackHistoryVersion] = useState(0);

  const removePlaybackLog = (filePath: string) => {
    try {
      const histJson = localStorage.getItem("playback_history") || "[]";
      const hist = JSON.parse(histJson);
      if (Array.isArray(hist)) {
        const updated = hist.filter((item: any) => item.path !== filePath && item.filePath !== filePath);
        localStorage.setItem("playback_history", JSON.stringify(updated));
        setPlaybackHistoryVersion(prev => prev + 1);
        window.dispatchEvent(new Event("storage"));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const recentPlaybackLogs = useMemo(() => {
    try {
      const hist = JSON.parse(localStorage.getItem("playback_history") || "[]");
      if (Array.isArray(hist)) {
        return hist
          .slice(0, 6)
          .map((log: any) => {
            const entry = localEntries.find((e) => e.files.some((f) => f.path === log.path));
            
            const rawTitle = entry?.media?.title.english || entry?.media?.title.romaji || entry?.title || log.title;
            const cleanTitle = cleanFilename(rawTitle);

            return {
              id: log.path,
              filePath: log.path,
              title: cleanTitle,
              coverUrl: (entry?.media?.coverImage as any)?.medium || (entry?.media?.coverImage as any)?.large || null,
              bannerUrl: entry?.media?.bannerImage || (entry?.media?.coverImage as any)?.large || (entry?.media?.coverImage as any)?.medium || null,
              episode: log.episode || log.episodeNumber || 1,
              time: formatPlaybackTime(log.timestamp || Date.now() - 1000 * 60 * 30),
              entryKey: entry?.key || null,
            };
          });
      }
    } catch (_) {}
    return [];
  }, [localEntries, playbackHistoryVersion]);

  function formatPlaybackTime(timestamp: number) {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  // Torrent filename cleaner
  function cleanFilename(filename: string) {
    let name = filename;
    // Remove release group [Group]
    name = name.replace(/^\[[^\]]+\]\s*/, "");
    // Remove episode suffix like " - 06" or " 06" or "- 03 (1080p)..."
    name = name.replace(/\s*-\s*\d+.*$/, "");
    name = name.replace(/\s*\d+\s*(?:\(1080p\)|\(720p\)).*$/, "");
    // Remove resolution or details
    name = name.replace(/\s*\([^)]+\)/g, "");
    // Remove CRC hashes [ABCDEF12]
    name = name.replace(/\s*\[[^\]]+\]/g, "");
    // Remove extension
    name = name.replace(/\.[a-zA-Z0-9]+$/, "");
    return name.trim();
  }

  // 1. Logged Out Welcome View
  if (!anilistUser) {
    return (
      <div className="flex h-full flex-col p-6 overflow-y-auto text-white select-none">
        <header className="flex items-center justify-between px-6 py-3.5 rounded-2xl glass border border-white/[0.06] bg-yuui-surface/40 backdrop-blur-md shrink-0 mb-6 font-display">
          <div className="flex items-center gap-6">
            <span className="text-xl font-bold flex items-center gap-2">
              <span className="text-yuui-accent">🌸</span> AURORA
            </span>
          </div>
        </header>

        <div className="w-full max-w-lg mx-auto mt-16 glass rounded-3xl p-6 border border-white/[0.05] bg-yuui-surface/40 space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] text-yuui-accent font-bold uppercase tracking-wider block">Connect Account</span>
            <p className="text-[11px] text-yuui-muted leading-relaxed">
              Enter your Developer Token to synchronize this dashboard preview with your cloud lists.
            </p>
          </div>

          <div className="space-y-2.5">
            <input
              type="password"
              placeholder="Paste AniList token..."
              value={tokenInput}
              onChange={(e) => {
                setTokenInput(e.target.value);
                setErrorMsg(null);
              }}
              className="w-full rounded-xl px-3 py-2 text-xs text-white outline-none border border-white/[0.05] bg-white/[0.01] focus:border-yuui-accent/60 transition-colors"
            />
            <button
              onClick={handleConnect}
              disabled={isConnecting || !tokenInput.trim()}
              className="w-full rounded-xl py-2 text-xs font-semibold text-white bg-gradient-to-r from-yuui-accent to-yuui-accent2 transition-all hover:scale-[1.02] cursor-pointer shadow-glow"
            >
              {isConnecting ? "Connecting..." : "Sync Profile Now"}
            </button>
            {errorMsg && (
              <span className="text-[10px] font-medium text-red-400 mt-1 block">
                ⚠ {errorMsg}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. Loading State
  if (localStatus === "loading" || loadingProfile) {
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
              
              <div className="flex rounded-md bg-black/40 p-0.5 border border-white/[0.05] text-[9px] font-bold">
                <button
                  onClick={() => setDataSource("online")}
                  className={`px-2.5 py-0.5 rounded transition-colors cursor-pointer ${
                    dataSource === "online" ? "bg-yuui-accent text-white" : "text-yuui-muted hover:text-white"
                  }`}
                >
                  Cloud
                </button>
                <button
                  onClick={() => setDataSource("local")}
                  className={`px-2.5 py-0.5 rounded transition-colors cursor-pointer ${
                    dataSource === "local" ? "bg-yuui-accent text-white" : "text-yuui-muted hover:text-white"
                  }`}
                >
                  Local
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats badges - placed directly next to username container and made compact */}
        <div className="flex flex-wrap items-center gap-3 relative z-10 max-w-2xl select-none md:ml-4">
          <div className="glass rounded-xl px-2.5 py-1 border border-white/[0.04] bg-[#1a1d27]/40 flex flex-col min-w-[70px] text-center shrink-0">
            <span className="text-sm font-black text-yuui-accent font-display">{stats.totalAnime}</span>
            <span className="text-[8px] text-yuui-muted font-bold uppercase tracking-wider">Total</span>
          </div>
          <div className="glass rounded-xl px-2.5 py-1 border border-white/[0.04] bg-[#1a1d27]/40 flex flex-col min-w-[70px] text-center shrink-0">
            <span className="text-sm font-black text-pink-400 font-display">{stats.completedCount}</span>
            <span className="text-[8px] text-yuui-muted font-bold uppercase tracking-wider">Done</span>
          </div>
          <div className="glass rounded-xl px-2.5 py-1 border border-white/[0.04] bg-[#1a1d27]/40 flex flex-col min-w-[70px] text-center shrink-0">
            <span className="text-sm font-black text-white font-display">{stats.daysWatched}</span>
            <span className="text-[8px] text-yuui-muted font-bold uppercase tracking-wider">Days</span>
          </div>
          <div className="glass rounded-xl px-2.5 py-1 border border-white/[0.04] bg-[#1a1d27]/40 flex flex-col min-w-[70px] text-center shrink-0">
            <span className="text-sm font-black text-pink-400 font-display">{stats.meanScore}</span>
            <span className="text-[8px] text-yuui-muted font-bold uppercase tracking-wider">Mean</span>
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
          
          {/* Main Dashboard Navigation Menu */}
          <div className="glass rounded-3xl p-3.5 border border-white/[0.05] bg-yuui-surface/40 space-y-1">
            <span className="text-[9px] font-bold text-yuui-muted uppercase tracking-wider block px-2.5 mb-1.5">Navigation</span>
            
            <button
              onClick={() => setActiveTab("overview")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "overview" 
                  ? "text-white bg-yuui-accent/15 border-l-2 border-yuui-accent" 
                  : "text-yuui-muted hover:text-white hover:bg-white/[0.02]"
              }`}
            >
              <Grid className="h-4 w-4" />
              <span>Overview</span>
            </button>
            
            <button
              onClick={() => setActiveTab("stats")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "stats" 
                  ? "text-white bg-yuui-accent/15 border-l-2 border-yuui-accent" 
                  : "text-yuui-muted hover:text-white hover:bg-white/[0.02]"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Collection Stats</span>
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

          {/* Context Options Divider */}
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
                        {isSavingEdit ? "Saving..." : "Save & Sync"}
                      </button>
                    </div>
                  ) : (
                    /* DATABASE FILTERS */
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block px-1">Filter</label>
                        <input
                          type="text"
                          placeholder={dataSource === "online" ? "Search cloud lists..." : "Search local library..."}
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
                                          tabName === "Watching" ? watchingList.length :
                                          tabName === "Completed" ? stats.completedCount :
                                          bottomList.filter((e: any) => e.user?.status === "Planning").length;
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
                className="grid grid-cols-12 gap-5 h-full min-h-0 items-start"
              >
                {/* Middle database (col-span-8) */}
                <div className="col-span-8 flex flex-col gap-4 min-h-0 h-full overflow-hidden">
                  
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
                            {/* Cover Container */}
                            <div className="shrink-0 flex items-center justify-center">
                              <img 
                                src={(e.media?.coverImage as any)?.large || (e.media?.coverImage as any)?.medium || "https://s4.anilist.co/file/anilist/user/avatar/large/default.png"} 
                                alt="cover" 
                                className="rounded-xl object-cover border border-white/10 shadow-md shrink-0" 
                                style={{ height: `${coverSize}px`, width: `${coverSize * 0.7}px` }}
                              />
                            </div>
                            
                            {/* Title & Progress Bar Info */}
                            <div className="min-w-0 flex-1 flex flex-col justify-center gap-1.5">
                              <span className="block truncate text-xs font-semibold text-white max-w-[450px]" title={e.title}>
                                {e.title}
                              </span>
                              <div className="h-1.5 w-32 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-yuui-accent to-pink-500 rounded-full" style={{ width: `${(currentProgress / max) * 100}%` }} />
                              </div>
                            </div>
                            
                            {/* Score info badge */}
                            <div className="shrink-0 text-center w-14">
                              <span className="text-[9px] text-yuui-muted font-bold uppercase tracking-wider block mb-0.5">Score</span>
                              <span className="text-xs text-pink-400 font-bold font-mono">{e.user?.score ? `★ ${e.user.score}` : "—"}</span>
                            </div>

                            {/* Progress info badge */}
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
                </div>

                {/* Right side widgets (col-span-4) - Playback Activity feed (indicator line removed) */}
                <div className="col-span-4 flex flex-col gap-4 min-h-0 h-full overflow-hidden">
                  <div className="glass rounded-3xl border border-white/[0.05] bg-yuui-surface/40 flex flex-col flex-1 min-h-0 overflow-hidden relative">
                    <div className="p-3.5 border-b border-white/[0.04]"><span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">Playback Activity</span></div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 pr-3.5 scrollbar-thin">
                      {recentPlaybackLogs.map((log) => (
                        <div 
                          key={log.id} 
                          className="flex gap-3 items-start relative group/playlog cursor-pointer select-none p-2 rounded-2xl hover:bg-white/[0.04] transition-all border border-transparent hover:border-white/[0.03]"
                          title="Double-click to view series details"
                          onDoubleClick={() => {
                            if (log.entryKey) {
                              navigate(`/anime/${encodeURIComponent(log.entryKey)}`);
                            }
                          }}
                        >
                          {/* Wide Banner Image as the Episode picture */}
                          {log.bannerUrl ? (
                            <img 
                              src={log.bannerUrl} 
                              alt="episode picture" 
                              className="h-14 w-24 rounded-lg object-cover border border-white/10 shrink-0 shadow-md"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="h-14 w-24 rounded-lg bg-white/5 border border-white/[0.05] flex items-center justify-center shrink-0 text-lg">🎬</div>
                          )}

                          <div className="min-w-0 flex-1 leading-snug">
                            <h4 className="text-xs font-bold text-white truncate" title={log.title}>{log.title}</h4>
                            <p className="text-[10px] text-white/80 mt-1">Episode {log.episode}</p>
                            <span className="text-[9px] text-yuui-muted mt-1 block font-medium">{log.time}</span>
                          </div>

                          {/* Manual Delete Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removePlaybackLog(log.filePath);
                            }}
                            className="absolute top-1.5 right-1.5 p-1 rounded-md text-neutral-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all opacity-0 group-hover/playlog:opacity-100 select-none z-10"
                            title="Remove from history"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {recentPlaybackLogs.length === 0 && (
                        <div className="text-center text-[10px] text-yuui-muted py-12">No recent playback history.</div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: COLLECTION STATS (Format Breakdown donut removed) */}
            {activeTab === "stats" && (
              <motion.div
                key="stats-tab"
                initial={{ opacity: 0, x: 5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                className="space-y-6 h-full overflow-y-auto pr-1 pb-8"
              >
                {dataSource === "online" && selectedOnlineMediaId ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <button 
                        onClick={() => {
                          setSelectedOnlineMediaId(null);
                          setSelectedMediaDetail(null);
                        }}
                        className="glass px-3 py-1.5 rounded-xl text-xs font-semibold text-white/90 hover:text-white hover:bg-white/[0.08] flex items-center gap-1.5 transition-all select-none cursor-pointer"
                      >
                        ← Back to Series List
                      </button>
                      <span className="text-[10px] text-yuui-muted font-bold uppercase tracking-wider font-mono">Cloud Mode</span>
                    </div>

                    {loadingMediaDetail && (
                      <div className="flex flex-col items-center justify-center gap-4 py-24">
                        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-yuui-accent" />
                        <p className="text-xs text-yuui-muted">Fetching episode metadata...</p>
                      </div>
                    )}

                    {selectedMediaDetail && (
                      <div className="space-y-5 animate-fade-in">
                        <div className="flex items-center gap-4 p-4 rounded-3xl bg-white/[0.02] border border-white/[0.04]">
                          <img 
                            src={selectedMediaDetail.coverImage?.large} 
                            alt="" 
                            className="h-16 w-11 rounded-lg object-cover border border-white/10 shrink-0 shadow-lg" 
                          />
                          <div>
                            <h3 className="text-sm font-bold text-white leading-tight font-display">
                              {selectedMediaDetail.title?.english || selectedMediaDetail.title?.romaji}
                            </h3>
                            <p className="text-[10px] text-yuui-muted mt-1 leading-relaxed line-clamp-2">
                              {selectedMediaDetail.description ? selectedMediaDetail.description.replace(/<[^>]*>/g, "") : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <h3 className="text-xs font-bold text-yuui-muted uppercase tracking-wider block font-display">Episodes Breakdown</h3>
                          {(() => {
                            const total = selectedMediaDetail.episodes || selectedMediaDetail.streamingEpisodes?.length || 12;
                            const chunkSize = 50;
                            const numChunks = Math.ceil(total / chunkSize);
                            if (numChunks <= 1) return null;
                            return (
                              <div className="flex items-center gap-2 select-none">
                                <span className="text-[10px] text-yuui-muted font-bold uppercase tracking-wider">Range:</span>
                                <select
                                  value={episodeChunkIndex}
                                  onChange={(e) => setEpisodeChunkIndex(parseInt(e.target.value))}
                                  className="bg-[#11131a]/60 border border-white/[0.05] rounded-xl px-2.5 py-1 text-xs text-white outline-none cursor-pointer"
                                >
                                  {Array.from({ length: numChunks }).map((_, idx) => {
                                    const start = idx * chunkSize + 1;
                                    const end = Math.min((idx + 1) * chunkSize, total);
                                    return (
                                      <option key={idx} value={idx}>
                                        Episodes {start} - {end}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            );
                          })()}
                        </div>
                        
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                          {(() => {
                            const list = [];
                            const total = selectedMediaDetail.episodes || selectedMediaDetail.streamingEpisodes?.length || 12;
                            const streams = selectedMediaDetail.streamingEpisodes || [];
                            const chunkSize = 50;
                            const startEp = episodeChunkIndex * chunkSize + 1;
                            const endEp = Math.min((episodeChunkIndex + 1) * chunkSize, total);
                            
                            for (let i = startEp; i <= endEp; i++) {
                              const stream = streams[i - 1];
                              const epTitle = stream ? stream.title.replace(/Episode \d+ - /, "") : `Episode ${i}`;
                              const epThumbnail = stream?.thumbnail || selectedMediaDetail.bannerImage || selectedMediaDetail.coverImage?.large || "";
                              const epDesc = stream?.site 
                                ? `Available to stream on ${stream.site}` 
                                : `Episode ${i} of ${selectedMediaDetail.title?.english || selectedMediaDetail.title?.romaji}.`;
                              
                              list.push(
                                <div 
                                  key={i}
                                  onClick={() => stream?.url && window.open(stream.url, "_blank")}
                                  className="glass rounded-2xl p-3 border border-white/[0.04] bg-yuui-surface/15 hover:bg-yuui-surface/25 hover:scale-[1.02] transition-all duration-300 cursor-pointer flex flex-col justify-between"
                                >
                                  <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-white/10 group">
                                    <img 
                                      src={epThumbnail} 
                                      alt="" 
                                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                      loading="lazy" 
                                    />
                                    {stream?.url && (
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                        <span className="rounded-full bg-yuui-accent px-2.5 py-1.5 text-[10px] font-bold text-white shadow-lg">↗ Stream Online</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-3 flex-grow flex flex-col justify-between leading-snug">
                                    <h4 className="text-xs font-bold text-white line-clamp-1 font-sans">Ep {i} - {epTitle}</h4>
                                    <p className="text-[10px] text-yuui-muted mt-1 line-clamp-2 font-sans">{epDesc}</p>
                                  </div>
                                </div>
                              );
                            }
                            return list;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="glass rounded-3xl p-5 border border-white/[0.05] bg-yuui-surface/20">
                        <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">Watch Hours</span>
                        <div className="mt-2 text-2xl font-bold font-display text-white">
                          {dataSource === "online" ? stats.hoursWatched : collectionStats.totalHours}{" "}
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
                        <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">Local Library Size</span>
                        <div className="mt-2 text-2xl font-bold font-display text-white">{(collectionStats.totalSize / (1024 * 1024 * 1024)).toFixed(1)} <span className="text-xs font-semibold text-yuui-muted">GB</span></div>
                      </div>
                    </div>

                    {dataSource === "online" ? (
                      <div className="space-y-4 mt-6">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display select-none">Your Cloud Series</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 select-none">
                          {activeEntries.map((entry) => {
                            const cover = (entry.media?.coverImage as any)?.large || (entry.media?.coverImage as any)?.medium || (entry.media?.coverImage as any)?.extraLarge || "";
                            return (
                              <div 
                                key={entry.key}
                                onClick={() => {
                                  if (entry.media?.id) {
                                    setSelectedOnlineMediaId(entry.media.id);
                                    fetchOnlineMediaDetail(entry.media.id);
                                  }
                                }}
                                className="glass rounded-2xl p-3 border border-white/[0.04] bg-yuui-surface/15 hover:bg-yuui-surface/25 hover:scale-[1.03] transition-all duration-300 cursor-pointer flex flex-col justify-between group"
                              >
                                <img src={cover} alt="" className="aspect-[2/3] w-full object-cover rounded-xl border border-white/10 shadow" />
                                <span className="text-[11px] font-bold text-white/90 line-clamp-2 mt-2 leading-tight group-hover:text-yuui-accent transition-colors text-center">{entry.media?.title?.english || entry.media?.title?.romaji || entry.title}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="glass rounded-3xl p-6 border border-white/[0.05] bg-yuui-surface/25">
                        <h2 className="text-sm font-bold text-white/90 uppercase tracking-wider font-display mb-4">Collection Genres</h2>
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
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* TAB 3: FAVORITES */}
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

            {/* TAB 4: GLOBAL SEARCH */}
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
