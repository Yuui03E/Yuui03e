import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  cleanDescription,
  humanizeEnum,
  countdown,
  fmtDate,
  fmtNum,
  formatBytes,
} from "../lib/format";
import { TRACK_STATUSES } from "../lib/anilistStatus";
import {
  X,
  Save,
  Heart,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  FileVideo,
  ExternalLink,
} from "lucide-react";
import { Fact, Chip } from "../features/library/stats/atoms";

interface EntryDetailModalProps {
  entry: any;
  onClose: () => void;
  /** 'quick' = right-click quick view (LibraryPage), 'detail' = stats detail modal */
  variant?: "quick" | "detail";
  // Controlled edit state (caller owns useQuickEdit)
  editStatus: string;
  setEditStatus: (v: string) => void;
  editProgress: number;
  setEditProgress: (v: number) => void;
  editScore: number;
  setEditScore: (v: number) => void;
  editNotes: string;
  setEditNotes: (v: string) => void;
  editFav: boolean;
  setEditFav: (v: boolean) => void;
  isSaving: boolean;
  justSaved: boolean;
  onSave: () => void;
}

/**
 * Merged entry detail modal — used by LibraryPage (right-click quick view)
 * and the DetailPage (poster click detail view). Fully controlled; edit state
 * comes from the caller's useQuickEdit hook.
 *
 * Variant differences:
 *  - quick:    z-[60] overlay, solid black bg, "Quick Edit" heading, full-page
 *              button, from-black banner gradient
 *  - detail:   z-40/50 overlay, dark gradient bg, "Your Tracking" heading,
 *              no full-page button, from-[#0c0d12] banner gradient
 */
export default function EntryDetailModal({
  entry,
  onClose,
  variant = "quick",
  editStatus,
  setEditStatus,
  editProgress,
  setEditProgress,
  editScore,
  setEditScore,
  editNotes,
  setEditNotes,
  editFav,
  setEditFav,
  isSaving,
  justSaved,
  onSave,
}: EntryDetailModalProps) {
  const navigate = useNavigate();
  const isQuick = variant === "quick";

  const m = entry.media || {};
  const a = entry.analysis || {};
  const color = m?.coverImage?.color || "var(--accent)";
  const poster =
    m?.coverImage?.extraLarge ||
    m?.coverImage?.large ||
    m?.coverImage?.medium ||
    "";
  const desc = cleanDescription(m?.description);
  const files: any[] = [...(entry.files || [])].sort(
    (x: any, y: any) => (x.episode || 0) - (y.episode || 0),
  );
  const airing = m?.nextAiringEpisode;
  const episodeCount = m?.episodes ?? entry.episodeCount ?? entry.episode_count ?? 0;
  const totalSize = ((entry.files || []) as any[]).reduce(
    (s: number, f: any) => s + (f.size_bytes || 0),
    0,
  );

  const [descOpen, setDescOpen] = useState(false);

  /** Map the isSaved state into the color used for the gradient line. */
  const overlayZ = isQuick ? "z-[60]" : "z-40";
  const panelZ = isQuick ? "z-[61]" : "z-50";
  const bgStyle = isQuick
    ? { background: "#000000" }
    : {
        background:
          "linear-gradient(180deg, rgba(18,20,28,0.96), rgba(10,11,16,0.97))",
      };
  const bannerFrom = isQuick ? "from-black" : "from-[#0c0d12]";
  const sectionLabel = isQuick ? "Quick Edit" : "Your Tracking";

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="entry-detail-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 bg-black/70 backdrop-blur-md ${overlayZ}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed inset-0 ${panelZ} grid place-items-center p-6 pointer-events-none`}
      >
        <motion.div
          key="entry-detail-panel"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="pointer-events-auto relative w-full max-w-[940px] max-h-[88vh] flex flex-col overflow-hidden rounded-[28px] border border-white/[0.08] shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
          style={bgStyle}
        >
          {/* Banner header */}
          <div className="relative shrink-0 h-28 overflow-hidden">
            {m?.bannerImage ? (
              <img
                src={m.bannerImage}
                alt=""
                className="w-full h-full object-cover opacity-50"
              />
            ) : (
              <div
                className="w-full h-full"
                style={{
                  background: `linear-gradient(120deg, ${color}55, var(--accent2)33)`,
                }}
              />
            )}
            <div
              className={`absolute inset-0 bg-gradient-to-t ${bannerFrom} via-black/40 to-transparent`}
            />
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur text-white/70 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body: poster column + details */}
          <div className="flex-1 min-h-0 flex gap-6 px-7 pb-7 -mt-14">
            {/* LEFT — poster + facts */}
            <div className="w-[236px] shrink-0 overflow-y-auto scrollbar-thin pr-1">
              <div className="relative">
                <img
                  src={poster}
                  alt=""
                  className="w-full rounded-2xl object-cover border border-white/10"
                  style={{
                    boxShadow: `0 16px 50px ${color}40, 0 8px 24px rgba(0,0,0,0.6)`,
                  }}
                  onError={(ev) => {
                    (ev.target as HTMLImageElement).style.opacity = "0";
                  }}
                />
                <button
                  onClick={() => setEditFav(!editFav)}
                  className="absolute top-2.5 right-2.5 p-2 rounded-full bg-black/50 backdrop-blur hover:bg-black/70 transition-colors"
                >
                  <Heart
                    className={`h-4 w-4 transition-colors ${editFav ? "fill-yuui-accent text-yuui-accent" : "text-white/70"}`}
                  />
                </button>
              </div>

              {/* AniList score chips */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-2.5 text-center">
                  <div className="text-[8px] font-bold uppercase tracking-wider text-white/30">
                    Avg Score
                  </div>
                  <div
                    className="text-base font-display font-medium"
                    style={{ color: "#4ade80" }}
                  >
                    {m?.averageScore ? `${m.averageScore}%` : "—"}
                  </div>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-2.5 text-center">
                  <div className="text-[8px] font-bold uppercase tracking-wider text-white/30">
                    Mean
                  </div>
                  <div className="text-base font-display font-medium text-white/90">
                    {m?.meanScore ? `${m.meanScore}%` : "—"}
                  </div>
                </div>
              </div>

              {/* Meta facts */}
              <div className="mt-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] px-3.5 py-2">
                <Fact label="Format" value={humanizeEnum(m?.format) || "—"} />
                <Fact
                  label="Episodes"
                  value={m?.episodes ?? entry.episodeCount ?? entry.episode_count ?? "—"}
                  mono
                />
                <Fact
                  label="Duration"
                  value={m?.duration ? `${m.duration} min` : "—"}
                  mono
                />
                <Fact label="Status" value={humanizeEnum(m?.status) || "—"} />
                <Fact label="Source" value={humanizeEnum(m?.source) || "—"} />
                <Fact
                  label="Season"
                  value={
                    m?.season
                      ? `${humanizeEnum(m.season)} ${m.seasonYear || ""}`
                      : m?.seasonYear || "—"
                  }
                />
                <Fact
                  label="Aired"
                  value={
                    m?.startDate?.year
                      ? `${fmtDate(m.startDate)}${m?.endDate?.year ? ` – ${fmtDate(m.endDate)}` : ""}`
                      : "—"
                  }
                  mono
                />
                <Fact label="Popularity" value={fmtNum(m?.popularity)} mono />
                <Fact label="Favourites" value={fmtNum(m?.favourites)} mono />
                <Fact label="MAL ID" value={m?.idMal || "—"} mono />
              </div>

              {/* Studios */}
              {m?.studios?.nodes?.length > 0 && (
                <div className="mt-3">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-2">
                    Studios
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {m.studios.nodes.map((s: any) => (
                      <Chip key={s.id || s.name}>{s.name}</Chip>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT — details (scroll) */}
            <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin pt-14 space-y-6">
              {/* Titles + optional open full page */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-2xl font-display font-medium text-white leading-tight">
                    {m?.title?.english || m?.title?.romaji || entry.title}
                  </h2>
                  {isQuick && (
                    <button
                      onClick={() => {
                        onClose();
                        navigate(`/anime/${encodeURIComponent(entry.key)}`);
                      }}
                      className="shrink-0 mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-white/60 hover:text-yuui-accent bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-full px-3 py-1.5 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" /> Full page
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-white/45">
                  {m?.title?.romaji &&
                    m?.title?.romaji !== m?.title?.english && (
                      <span>{m.title.romaji}</span>
                    )}
                  {m?.title?.native && (
                    <span className="text-white/35">{m.title.native}</span>
                  )}
                </div>
                {m?.synonyms?.length > 0 && (
                  <p className="text-[11px] text-white/30 mt-1.5 line-clamp-1">
                    Also: {m.synonyms.slice(0, 4).join(" · ")}
                  </p>
                )}
              </div>

              {/* Next airing */}
              {airing && (
                <div className="flex items-center gap-2 text-xs text-yuui-accent bg-yuui-accent/[0.08] border border-yuui-accent/20 rounded-xl px-3 py-2 w-fit">
                  <Calendar className="h-3.5 w-3.5" />
                  Ep {airing.episode} airing in{" "}
                  {countdown(airing.timeUntilAiring)}
                </div>
              )}

              {/* Your tracking — editor */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-yuui-accent">
                    {sectionLabel}
                  </span>
                  <AnimatePresence>
                    {justSaved && (
                      <motion.span
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Saved
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
                      Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-xs text-white font-medium outline-none cursor-pointer"
                    >
                      {TRACK_STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-black">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1.5 text-right">
                      Progress{" "}
                      <span className="text-white/20">
                        / {episodeCount || "?"}
                      </span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() =>
                          setEditProgress(Math.max(0, editProgress - 1))
                        }
                        className="h-10 w-10 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] flex items-center justify-center text-white/70 text-lg font-light transition-colors"
                      >
                        –
                      </button>
                      <input
                        type="number"
                        value={editProgress}
                        onChange={(e) =>
                          setEditProgress(
                            Math.max(
                              0,
                              Math.min(
                                episodeCount || 9999,
                                +e.target.value || 0,
                              ),
                            ),
                          )
                        }
                        className="w-16 h-10 bg-white/[0.02] border border-white/[0.05] rounded-xl text-center text-base font-mono text-white outline-none focus:border-yuui-accent/50"
                      />
                      <button
                        onClick={() =>
                          setEditProgress(
                            Math.min(episodeCount || 9999, editProgress + 1),
                          )
                        }
                        className="h-10 w-10 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] flex items-center justify-center text-white/70 text-lg font-light transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">
                      Score
                    </label>
                    <span
                      className="text-base font-black font-display"
                      style={{
                        color: editScore ? "var(--accent)" : "#444",
                      }}
                    >
                      {editScore ? `★ ${editScore}` : "Unrated"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={editScore}
                    onChange={(e) => setEditScore(+e.target.value)}
                    className="w-full accent-yuui-accent cursor-pointer h-1.5 bg-white/10 rounded-full appearance-none"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Personal notes…"
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-2 text-xs text-white/90 outline-none focus:border-yuui-accent/50 resize-none scrollbar-thin"
                  />
                </div>

                <button
                  onClick={onSave}
                  disabled={isSaving}
                  className="mt-4 w-full h-11 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--accent), var(--accent2))",
                  }}
                >
                  <Save className="h-4 w-4" />{" "}
                  {isSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>

              {/* Description */}
              {desc && (
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30 mb-2">
                    Synopsis
                  </h3>
                  <p
                    className={`text-xs text-white/60 leading-relaxed whitespace-pre-line ${descOpen ? "" : "line-clamp-4"}`}
                  >
                    {desc}
                  </p>
                  {desc.length > 260 && (
                    <button
                      onClick={() => setDescOpen(!descOpen)}
                      className="text-[11px] font-semibold text-yuui-accent mt-1.5 hover:underline"
                    >
                      {descOpen ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
              )}

              {/* Genres */}
              {m?.genres?.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30 mb-2">
                    Genres
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {m.genres.map((g: string) => (
                      <Chip key={g} tint={color}>
                        {g}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {m?.tags?.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30 mb-2">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {m.tags
                      .filter((t: any) => !t.isMediaSpoiler)
                      .slice(0, 18)
                      .map((t: any) => (
                        <span
                          key={t.name}
                          className="px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.05] text-[11px] text-white/65 flex items-center gap-1.5"
                        >
                          {t.name}
                          {t.rank != null && (
                            <span className="text-[9px] font-mono text-white/30">
                              {t.rank}%
                            </span>
                          )}
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
                    {files.length} files · {formatBytes(totalSize)}
                  </span>
                </div>

                {/* Coverage summary */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {a?.best_resolution && (
                    <Chip tint="#22d3ee">Best: {a.best_resolution}</Chip>
                  )}
                  <Chip>
                    {a?.owned_episodes?.length ?? files.length} owned
                  </Chip>
                  {a?.missing_episodes?.length > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/25 text-[11px] text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3" />{" "}
                      {a.missing_episodes.length} missing
                      {a.missing_episodes.length <= 12 && (
                        <span className="font-mono text-[10px] opacity-70">
                          ({a.missing_episodes.join(", ")})
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {files.length > 0 && (
                  <div className="rounded-2xl border border-white/[0.05] overflow-hidden">
                    <div className="grid grid-cols-[44px_1fr_72px_64px_72px] px-3 py-2 bg-white/[0.02] border-b border-white/[0.04]">
                      {["Ep", "Group", "Res", "Codec", "Size"].map((h, i) => (
                        <span
                          key={h}
                          className={`text-[8px] font-bold uppercase tracking-wider text-white/30 ${i >= 2 ? "text-right" : ""}`}
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                    <div className="max-h-52 overflow-y-auto scrollbar-thin">
                      {files.map((f, i) => (
                        <div
                          key={f.path || i}
                          className="grid grid-cols-[44px_1fr_72px_64px_72px] px-3 py-1.5 border-b border-white/[0.02] last:border-0 items-center hover:bg-white/[0.02]"
                        >
                          <span className="text-[11px] font-mono text-white/70">
                            {f.episode ?? "–"}
                          </span>
                          <span
                            className="text-[11px] text-white/60 truncate pr-2"
                            title={f.file_name}
                          >
                            {f.release_group || f.file_name || "—"}
                          </span>
                          <span className="text-[10px] font-mono text-white/50 text-right">
                            {f.resolution || "—"}
                          </span>
                          <span className="text-[10px] font-mono text-white/40 text-right">
                            {f.codec || "—"}
                          </span>
                          <span className="text-[10px] font-mono text-white/50 text-right">
                            {formatBytes(f.size_bytes || 0)}
                          </span>
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
    </AnimatePresence>
  );
}
