import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLibrary } from "../../store/library";
import { cleanDescription, humanizeEnum, countdown } from "../../lib/format";
import {
  Search, X, Save, Heart, Calendar, CheckCircle2, AlertTriangle, FileVideo, Star,
} from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; hex: string }> = {
  Watching:  { label: "Watching",  hex: "#3db4f2" },
  Completed: { label: "Completed", hex: "#4ade80" },
  Planning:  { label: "Planning",  hex: "#a78bfa" },
  Paused:    { label: "Paused",    hex: "#fbbf24" },
  Dropped:   { label: "Dropped",   hex: "#f87171" },
  Untracked: { label: "Untracked", hex: "#6b7280" },
};
const TRACK_STATUSES = ["Watching", "Completed", "Planning", "Paused", "Dropped"] as const;
const ACCENT = "#ff5fa2";
const ACCENT2 = "#7c5cff";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtSize(b: number) {
  if (!b) return "0 B";
  if (b >= 1024 ** 4) return `${(b / 1024 ** 4).toFixed(2)} TB`;
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(0)} MB`;
  return `${Math.round(b / 1024)} KB`;
}
function fmtDate(d?: { year: number | null; month: number | null; day: number | null } | null) {
  if (!d || !d.year) return "—";
  const m = d.month ? MONTHS[d.month - 1] : "";
  return `${m ? m + " " : ""}${d.day ? d.day + ", " : ""}${d.year}`;
}
function fmtNum(n?: number | null) {
  if (n == null) return "—";
  return n.toLocaleString();
}

// ─── Small building blocks (detail modal) ──────────────────────────────────────
function Fact({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-white/30 shrink-0">{label}</span>
      <span className={`text-xs text-white/80 text-right ${mono ? "font-mono" : "font-medium"}`}>{value}</span>
    </div>
  );
}

function Chip({ children, tint }: { children: React.ReactNode; tint?: string }) {
  return (
    <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[11px] text-white/75 font-medium whitespace-nowrap"
      style={tint ? { borderColor: tint + "40", color: tint } : undefined}>
      {children}
    </span>
  );
}

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

// ─── Poster Card ───────────────────────────────────────────────────────────────
function PosterCard({ entry, index, onOpen }: { entry: any; index: number; onOpen: () => void }) {
  const m = entry.media || {};
  const cover = m?.coverImage?.extraLarge || m?.coverImage?.large || m?.coverImage?.medium || "";
  const color = m?.coverImage?.color || ACCENT2;
  const prog = entry.user?.progress ?? 0;
  const maxEps = entry.episodeCount || 0;
  const pct = maxEps ? Math.min(100, (prog / maxEps) * 100) : 0;
  const status = entry.user?.status || "Untracked";
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.Untracked;
  const score = entry.user?.score ?? 0;
  const fav = (entry.user as any)?.favorite;
  const missing = entry.analysis?.missing_episodes?.length ?? 0;
  const tracked = status !== "Untracked";

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.5), duration: 0.35 }}
      whileHover={{ y: -6 }}
      onClick={onOpen}
      className="group relative cursor-pointer"
    >
      {/* colored glow on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-45"
        style={{ background: color }} />

      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-yuui-panel shadow-card">
        <div className="relative aspect-[2/3] w-full overflow-hidden">
          {cover ? (
            <img src={cover} alt={entry.title} loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
          ) : (
            <div className="grid h-full w-full place-items-center text-4xl"
              style={{ background: `linear-gradient(160deg, ${color}55, #141420)` }}>🌸</div>
          )}

          {/* readability gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-3/5 bg-gradient-to-t from-black/95 via-black/35 to-transparent" />

          {/* top badges */}
          <div className="absolute left-2 top-2 flex flex-col gap-1 items-start">
            {score > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-bold backdrop-blur"
                style={{ color: ACCENT }}>
                <Star className="h-2.5 w-2.5 fill-current" /> {score}
              </span>
            )}
            {missing > 0 && (
              <span className="rounded-md bg-amber-500/85 px-1.5 py-0.5 text-[9px] font-bold text-black backdrop-blur">
                {missing} missing
              </span>
            )}
          </div>
          {fav && <Heart className="absolute right-2 top-2 h-4 w-4 fill-yuui-accent text-yuui-accent drop-shadow" />}

          {/* status corner ribbon */}
          {tracked && (
            <span className="absolute right-2 bottom-[64px] flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide backdrop-blur"
              style={{ color: cfg.hex }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.hex }} /> {cfg.label}
            </span>
          )}

          {/* bottom info */}
          <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col gap-1.5">
            <h3 className="line-clamp-2 text-[13px] font-semibold leading-tight text-white drop-shadow group-hover:text-yuui-accent transition-colors">
              {entry.title}
            </h3>
            <div className="flex items-center justify-between text-[10px] text-white/60 font-mono">
              <span>{humanizeEnum(m?.format) || "—"}{m?.seasonYear ? ` · ${m.seasonYear}` : ""}</span>
              <span>{prog}/{maxEps || "?"}</span>
            </div>
            {/* progress bar colored by status */}
            <div className="h-[3px] w-full rounded-full overflow-hidden bg-white/[0.12]">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.max(tracked ? 3 : 0, pct)}%`, backgroundColor: cfg.hex, boxShadow: `0 0 8px ${cfg.hex}90` }} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Rich Detail Modal ─────────────────────────────────────────────────────────
function DetailModal({
  entry, onClose,
  editStatus, setEditStatus, editProgress, setEditProgress, editScore, setEditScore,
  editNotes, setEditNotes, editFav, setEditFav, isSaving, justSaved, onSave,
}: {
  entry: any; onClose: () => void;
  editStatus: string; setEditStatus: (v: string) => void;
  editProgress: number; setEditProgress: (v: number) => void;
  editScore: number; setEditScore: (v: number) => void;
  editNotes: string; setEditNotes: (v: string) => void;
  editFav: boolean; setEditFav: (v: boolean) => void;
  isSaving: boolean; justSaved: boolean; onSave: () => void;
}) {
  const m = entry.media || {};
  const a = entry.analysis || {};
  const color = m?.coverImage?.color || ACCENT;
  const poster = m?.coverImage?.extraLarge || m?.coverImage?.large || m?.coverImage?.medium || "";
  const desc = cleanDescription(m?.description);
  const files: any[] = [...(entry.files || [])].sort((x, y) => (x.episode || 0) - (y.episode || 0));
  const airing = m?.nextAiringEpisode;

  const [descOpen, setDescOpen] = useState(false);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-40" onClick={onClose} />

      <div className="fixed inset-0 z-50 grid place-items-center p-6 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="pointer-events-auto relative w-full max-w-[940px] max-h-[88vh] flex flex-col overflow-hidden rounded-[28px] border border-white/[0.08] shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
          style={{ background: "linear-gradient(180deg, rgba(18,20,28,0.96), rgba(10,11,16,0.97))" }}>

          {/* Banner header */}
          <div className="relative shrink-0 h-28 overflow-hidden">
            {m?.bannerImage
              ? <img src={m.bannerImage} alt="" className="w-full h-full object-cover opacity-50" />
              : <div className="w-full h-full" style={{ background: `linear-gradient(120deg, ${color}55, ${ACCENT2}33)` }} />}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d12] via-[#0c0d12]/40 to-transparent" />
            <button onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur text-white/70 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body: poster column + details */}
          <div className="flex-1 min-h-0 flex gap-6 px-7 pb-7 -mt-14">

            {/* LEFT — poster + facts */}
            <div className="w-[236px] shrink-0 overflow-y-auto scrollbar-thin pr-1">
              <div className="relative">
                <img src={poster} alt=""
                  className="w-full rounded-2xl object-cover border border-white/10"
                  style={{ boxShadow: `0 16px 50px ${color}40, 0 8px 24px rgba(0,0,0,0.6)` }}
                  onError={(ev) => { (ev.target as HTMLImageElement).style.opacity = "0"; }} />
                <button onClick={() => setEditFav(!editFav)}
                  className="absolute top-2.5 right-2.5 p-2 rounded-full bg-black/50 backdrop-blur hover:bg-black/70 transition-colors">
                  <Heart className={`h-4 w-4 transition-colors ${editFav ? "fill-yuui-accent text-yuui-accent" : "text-white/70"}`} />
                </button>
              </div>

              {/* AniList score chips */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-2.5 text-center">
                  <div className="text-[8px] font-bold uppercase tracking-wider text-white/30">Avg Score</div>
                  <div className="text-base font-display font-medium" style={{ color: "#4ade80" }}>{m?.averageScore ? `${m.averageScore}%` : "—"}</div>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-2.5 text-center">
                  <div className="text-[8px] font-bold uppercase tracking-wider text-white/30">Mean</div>
                  <div className="text-base font-display font-medium text-white/90">{m?.meanScore ? `${m.meanScore}%` : "—"}</div>
                </div>
              </div>

              {/* Meta facts */}
              <div className="mt-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] px-3.5 py-2">
                <Fact label="Format" value={humanizeEnum(m?.format) || "—"} />
                <Fact label="Episodes" value={m?.episodes ?? entry.episodeCount ?? "—"} mono />
                <Fact label="Duration" value={m?.duration ? `${m.duration} min` : "—"} mono />
                <Fact label="Status" value={humanizeEnum(m?.status) || "—"} />
                <Fact label="Source" value={humanizeEnum(m?.source) || "—"} />
                <Fact label="Season" value={m?.season ? `${humanizeEnum(m.season)} ${m.seasonYear || ""}` : (m?.seasonYear || "—")} />
                <Fact label="Aired" value={m?.startDate?.year ? `${fmtDate(m.startDate)}${m?.endDate?.year ? ` – ${fmtDate(m.endDate)}` : ""}` : "—"} mono />
                <Fact label="Popularity" value={fmtNum(m?.popularity)} mono />
                <Fact label="Favourites" value={fmtNum(m?.favourites)} mono />
                <Fact label="MAL ID" value={m?.idMal || "—"} mono />
              </div>

              {/* Studios */}
              {m?.studios?.nodes?.length > 0 && (
                <div className="mt-3">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-2">Studios</div>
                  <div className="flex flex-wrap gap-1.5">
                    {m.studios.nodes.map((s: any) => <Chip key={s.id || s.name}>{s.name}</Chip>)}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT — details (scroll) */}
            <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin pt-14 space-y-6">

              {/* Titles */}
              <div>
                <h2 className="text-2xl font-display font-medium text-white leading-tight">
                  {m?.title?.english || m?.title?.romaji || entry.title}
                </h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-white/45">
                  {m?.title?.romaji && m?.title?.romaji !== m?.title?.english && <span>{m.title.romaji}</span>}
                  {m?.title?.native && <span className="text-white/35">{m.title.native}</span>}
                </div>
                {m?.synonyms?.length > 0 && (
                  <p className="text-[11px] text-white/30 mt-1.5 line-clamp-1">Also: {m.synonyms.slice(0, 4).join(" · ")}</p>
                )}
              </div>

              {/* Next airing */}
              {airing && (
                <div className="flex items-center gap-2 text-xs text-yuui-accent bg-yuui-accent/[0.08] border border-yuui-accent/20 rounded-xl px-3 py-2 w-fit">
                  <Calendar className="h-3.5 w-3.5" />
                  Ep {airing.episode} airing in {countdown(airing.timeUntilAiring)}
                </div>
              )}

              {/* Your tracking — editor */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-yuui-accent">Your Tracking</span>
                  <AnimatePresence>
                    {justSaved && (
                      <motion.span initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Saved
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                  {/* Status */}
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Status</label>
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-xs text-white font-medium outline-none cursor-pointer">
                      {TRACK_STATUSES.map((s) => <option key={s} value={s} className="bg-[#12141c]">{s}</option>)}
                    </select>
                  </div>
                  {/* Progress */}
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1.5 text-right">
                      Progress <span className="text-white/20">/ {entry.episodeCount || "?"}</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setEditProgress(Math.max(0, editProgress - 1))}
                        className="h-10 w-10 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] flex items-center justify-center text-white/70 text-lg font-light transition-colors">–</button>
                      <input type="number" value={editProgress}
                        onChange={(e) => setEditProgress(Math.max(0, Math.min(entry.episodeCount || 9999, +e.target.value || 0)))}
                        className="w-16 h-10 bg-white/[0.02] border border-white/[0.05] rounded-xl text-center text-base font-mono text-white outline-none focus:border-yuui-accent/50" />
                      <button onClick={() => setEditProgress(Math.min(entry.episodeCount || 9999, editProgress + 1))}
                        className="h-10 w-10 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] flex items-center justify-center text-white/70 text-lg font-light transition-colors">+</button>
                    </div>
                  </div>
                </div>

                {/* Score */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Score</label>
                    <span className="text-base font-black font-display" style={{ color: editScore ? ACCENT : "#444" }}>
                      {editScore ? `★ ${editScore}` : "Unrated"}
                    </span>
                  </div>
                  <input type="range" min="0" max="10" step="0.5" value={editScore}
                    onChange={(e) => setEditScore(+e.target.value)}
                    className="w-full accent-yuui-accent cursor-pointer h-1.5 bg-white/10 rounded-full appearance-none" />
                </div>

                {/* Notes */}
                <div className="mt-4">
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Notes</label>
                  <textarea rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Personal notes…"
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-2 text-xs text-white/90 outline-none focus:border-yuui-accent/50 resize-none scrollbar-thin" />
                </div>

                <button onClick={onSave} disabled={isSaving}
                  className="mt-4 w-full h-11 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` }}>
                  <Save className="h-4 w-4" /> {isSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>

              {/* Description */}
              {desc && (
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30 mb-2">Synopsis</h3>
                  <p className={`text-xs text-white/60 leading-relaxed whitespace-pre-line ${descOpen ? "" : "line-clamp-4"}`}>{desc}</p>
                  {desc.length > 260 && (
                    <button onClick={() => setDescOpen(!descOpen)} className="text-[11px] font-semibold text-yuui-accent mt-1.5 hover:underline">
                      {descOpen ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
              )}

              {/* Genres */}
              {m?.genres?.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30 mb-2">Genres</h3>
                  <div className="flex flex-wrap gap-1.5">{m.genres.map((g: string) => <Chip key={g} tint={color}>{g}</Chip>)}</div>
                </div>
              )}

              {/* Tags */}
              {m?.tags?.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30 mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {m.tags.filter((t: any) => !t.isMediaSpoiler).slice(0, 18).map((t: any) => (
                      <span key={t.name} className="px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.05] text-[11px] text-white/65 flex items-center gap-1.5">
                        {t.name}{t.rank != null && <span className="text-[9px] font-mono text-white/30">{t.rank}%</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Local files */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30 flex items-center gap-1.5">
                    <FileVideo className="h-3 w-3" /> Local Files
                  </h3>
                  <span className="text-[10px] font-mono text-white/35">
                    {files.length} files · {fmtSize(entry.size)}
                  </span>
                </div>

                {/* Coverage summary */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {a?.best_resolution && <Chip tint="#22d3ee">Best: {a.best_resolution}</Chip>}
                  <Chip>{a?.owned_episodes?.length ?? files.length} owned</Chip>
                  {a?.missing_episodes?.length > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/25 text-[11px] text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3" /> {a.missing_episodes.length} missing
                      {a.missing_episodes.length <= 12 && <span className="font-mono text-[10px] opacity-70">({a.missing_episodes.join(", ")})</span>}
                    </span>
                  )}
                </div>

                {files.length > 0 && (
                  <div className="rounded-2xl border border-white/[0.05] overflow-hidden">
                    <div className="grid grid-cols-[44px_1fr_72px_64px_72px] px-3 py-2 bg-white/[0.02] border-b border-white/[0.04]">
                      {["Ep", "Group", "Res", "Codec", "Size"].map((h, i) => (
                        <span key={h} className={`text-[8px] font-bold uppercase tracking-wider text-white/30 ${i >= 2 ? "text-right" : ""}`}>{h}</span>
                      ))}
                    </div>
                    <div className="max-h-52 overflow-y-auto scrollbar-thin">
                      {files.map((f, i) => (
                        <div key={f.path || i} className="grid grid-cols-[44px_1fr_72px_64px_72px] px-3 py-1.5 border-b border-white/[0.02] last:border-0 items-center hover:bg-white/[0.02]">
                          <span className="text-[11px] font-mono text-white/70">{f.episode ?? "–"}</span>
                          <span className="text-[11px] text-white/60 truncate pr-2" title={f.file_name}>{f.release_group || f.file_name || "—"}</span>
                          <span className="text-[10px] font-mono text-white/50 text-right">{f.resolution || "—"}</span>
                          <span className="text-[10px] font-mono text-white/40 text-right">{f.codec || "—"}</span>
                          <span className="text-[10px] font-mono text-white/50 text-right">{fmtSize(f.size_bytes || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
