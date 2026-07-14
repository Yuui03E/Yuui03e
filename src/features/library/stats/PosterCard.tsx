import { motion } from "framer-motion";
import { Heart, Star } from "lucide-react";
import { humanizeEnum } from "../../../lib/format";
import { STATUS_CFG, ACCENT, ACCENT2 } from "./constants";

// ─── Poster Card ───────────────────────────────────────────────────────────────
export function PosterCard({ entry, index, onOpen }: { entry: any; index: number; onOpen: () => void }) {
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
