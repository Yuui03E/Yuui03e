import { motion } from "framer-motion";
import type { AniListMedia } from "../../lib/types";

interface CandidateCardProps {
  media: AniListMedia;
  onPick: () => void;
  picking: boolean;
}

export default function CandidateCard({
  media,
  onPick,
  picking,
}: CandidateCardProps) {
  const cover = media.coverImage.extraLarge || media.coverImage.large || null;
  const color = media.coverImage.color || "#7c5cff";
  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      onClick={onPick}
      disabled={picking}
      className="group relative w-[180px] shrink-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-yuui-panel text-left disabled:opacity-50"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="grid h-full w-full place-items-center text-3xl"
            style={{
              background: `linear-gradient(160deg, ${color}55, #141420)`,
            }}
          >
            🌸
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="line-clamp-2 text-xs font-semibold leading-tight text-white">
            {media.title.english || media.title.romaji || "Unknown"}
          </div>
          {media.seasonYear && (
            <div className="mt-1 text-[10px] text-white/60">
              {media.seasonYear} · {media.format ?? ""}
            </div>
          )}
          {media.averageScore != null && (
            <div className="mt-0.5 text-[10px] text-yuui-accent3">
              ★ {media.averageScore}
            </div>
          )}
        </div>
      </div>
      <div className="grid h-8 place-items-center bg-yuui-accent2/15 text-xs font-semibold text-yuui-accent2 transition-colors group-hover:bg-yuui-accent2/30">
        {picking ? "Pinning…" : "Pin this match"}
      </div>
    </motion.button>
  );
}
