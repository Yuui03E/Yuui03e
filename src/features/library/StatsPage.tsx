import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLibrary } from "../../store/library";
import { Search, X } from "lucide-react";
import { STATUS_CFG, TRACK_STATUSES } from "./stats/constants";
import { PosterCard } from "./stats/PosterCard";
import { DetailModal } from "./stats/DetailModal";

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const { entries: localEntries, status: localStatus, saveUserData, init } = useLibrary();
  useEffect(() => { init(); }, [init]);

  const [searchQuery, setSearchQuery] = useState("");
  const [listFilter, setListFilter]   = useState("All");
  const [sortBy, setSortBy]           = useState<"title" | "score" | "progress" | "year">("title");
  const [coverSize, setCoverSize]     = useState(172);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Quick Edit State
  const [editStatus, setEditStatus]     = useState("Watching");
  const [editProgress, setEditProgress] = useState(0);
  const [editScore, setEditScore]       = useState(0);
  const [editNotes, setEditNotes]       = useState("");
  const [editFav, setEditFav]           = useState(false);
  const [isSaving, setIsSaving]         = useState(false);
  const [justSaved, setJustSaved]       = useState(false);

  const entries = useMemo(() =>
    localEntries.map((e) => ({
      key:          e.key,
      title:        e.media?.title?.english || e.media?.title?.romaji || e.title || "Unknown",
      episodeCount: e.media?.episodes ?? e.episode_count ?? 0,
      media:        e.media as any,
      files:        (e.files as any[]) || [],
      analysis:     (e as any).analysis || {},
      user:         e.user || { progress: 0, status: "Untracked", score: 0 },
      size:         ((e.files as any[]) || []).reduce((s, f) => s + (f.size_bytes || 0), 0),
    }))
  , [localEntries]);

  const selectedEntry = useMemo(() => entries.find((e) => e.key === selectedKey) ?? null, [entries, selectedKey]);

  useEffect(() => {
    if (!selectedEntry) return;
    const st = selectedEntry.user?.status;
    setEditStatus(!st || st === "Untracked" ? "Watching" : st);
    setEditProgress(selectedEntry.user?.progress || 0);
    setEditScore(selectedEntry.user?.score || 0);
    setEditNotes((selectedEntry.user as any)?.notes || "");
    setEditFav((selectedEntry.user as any)?.favorite || false);
    setJustSaved(false);
  }, [selectedKey]);

  const handleSave = async () => {
    if (!selectedEntry) return;
    setIsSaving(true);
    try {
      await saveUserData(selectedEntry.key, {
        progress: editProgress, status: editStatus, score: editScore,
        notes: editNotes, favorite: editFav,
      });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const countOf = (k: string) =>
    k === "All" ? entries.length : entries.filter((e) => (e.user?.status || "Untracked") === k).length;

  const filtered = useMemo(() => {
    const list = entries.filter((e) => {
      if (listFilter !== "All" && (e.user?.status || "Untracked") !== listFilter) return false;
      if (searchQuery.trim()) return e.title.toLowerCase().includes(searchQuery.toLowerCase());
      return true;
    });
    const s = [...list];
    s.sort((a, b) => {
      switch (sortBy) {
        case "score":    return (b.user?.score || 0) - (a.user?.score || 0);
        case "progress": return (b.user?.progress || 0) - (a.user?.progress || 0);
        case "year":     return (b.media?.seasonYear || 0) - (a.media?.seasonYear || 0);
        default:         return a.title.localeCompare(b.title);
      }
    });
    return s;
  }, [entries, listFilter, searchQuery, sortBy]);

  if (localStatus === "loading") {
    return (
      <div className="p-8 h-full">
        <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(172px, 1fr))" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl glass bg-yuui-surface/20 border border-white/[0.05] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full text-white select-none overflow-hidden relative selection:bg-yuui-accent/30 selection:text-white">
      {/* Ambient glows (shader shows through — matches app theme) */}
      <div className="absolute top-[-20%] left-[-10%] w-[55%] h-[55%] bg-yuui-accent/[0.06] blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-25%] right-[-10%] w-[50%] h-[50%] bg-yuui-accent2/[0.06] blur-[130px] rounded-full pointer-events-none" />

      {/* ── HEADER ─────────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-8 pt-6 pb-4 z-10">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h1 className="text-3xl font-light font-display text-white tracking-tight flex items-center gap-2.5">
              <span className="text-yuui-accent">🌸</span> Local Library
            </h1>
            <p className="text-xs text-white/40 font-medium mt-1.5 tracking-wide">
              {countOf(listFilter)} {listFilter === "All" ? "titles" : listFilter.toLowerCase()} · click a poster for full details
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-full px-4 py-2 hover:bg-white/[0.05] transition-colors">
            <Search className="h-3.5 w-3.5 text-white/40" />
            <input type="text" placeholder="Search library..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-white placeholder-white/30 outline-none w-36 focus:w-52 transition-all duration-300" />
            {searchQuery && <button onClick={() => setSearchQuery("")} className="text-white/40 hover:text-white"><X className="h-3.5 w-3.5" /></button>}
          </div>
        </div>

        {/* Controls: filter tabs + sort + cover size */}
        <div className="flex items-center justify-between gap-4 glass rounded-2xl border border-white/[0.05] bg-yuui-surface/40 px-3 py-2">
          <div className="flex items-center gap-1">
            {(["All", ...TRACK_STATUSES] as const).map((tab) => {
              const active = listFilter === tab;
              const colorHex = STATUS_CFG[tab]?.hex || "#ffffff";
              return (
                <button key={tab} onClick={() => setListFilter(tab)}
                  className="relative px-3 py-1.5 text-[11px] font-semibold transition-colors font-sans"
                  style={{ color: active ? "white" : "rgba(255,255,255,0.42)" }}>
                  {active && <motion.div layoutId="statPill" className="absolute inset-0 bg-white/[0.07] rounded-full border border-white/[0.08]" style={{ borderBottomColor: colorHex }} />}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {tab} <span className="font-mono text-[9px] opacity-50">{countOf(tab)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-white/30 font-bold">Sort</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1 text-[10px] text-white/80 outline-none cursor-pointer">
                <option value="title" className="bg-[#12141c]">Title</option>
                <option value="score" className="bg-[#12141c]">My Score</option>
                <option value="progress" className="bg-[#12141c]">Progress</option>
                <option value="year" className="bg-[#12141c]">Year</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-white/30 font-bold">Size</span>
              <input type="range" min="130" max="260" value={coverSize} onChange={(e) => setCoverSize(+e.target.value)}
                className="w-20 accent-yuui-accent cursor-pointer h-1 rounded-full bg-white/10" />
            </div>
          </div>
        </div>
      </div>

      {/* ── POSTER WALL ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-8 pb-8 z-10">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/20">
            <Search className="h-9 w-9 mb-3 opacity-50" />
            <span className="text-sm font-medium">No titles found</span>
          </div>
        ) : (
          <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${coverSize}px, 1fr))` }}>
            {filtered.map((e, idx) => (
              <PosterCard key={e.key} entry={e} index={idx} onOpen={() => setSelectedKey(e.key)} />
            ))}
          </div>
        )}
      </div>

      {/* ── RICH DETAIL MODAL ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedEntry && (
          <DetailModal
            entry={selectedEntry}
            onClose={() => setSelectedKey(null)}
            editStatus={editStatus} setEditStatus={setEditStatus}
            editProgress={editProgress} setEditProgress={setEditProgress}
            editScore={editScore} setEditScore={setEditScore}
            editNotes={editNotes} setEditNotes={setEditNotes}
            editFav={editFav} setEditFav={setEditFav}
            isSaving={isSaving} justSaved={justSaved} onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
