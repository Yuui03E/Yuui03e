import { useState } from "react";
import { motion } from "framer-motion";
import type { MangaInfo } from "../api";

interface MangaCardProps {
  manga: MangaInfo;
  onClick: () => void;
  variant?: "grid" | "rail";
  subtitle?: string;
}

export function MangaCard({
  manga,
  onClick,
  variant = "grid",
  subtitle,
}: MangaCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [coverError, setCoverError] = useState(false);

  if (variant === "rail") {
    return (
      <button
        onClick={onClick}
        className="group flex h-44 w-32 shrink-0 flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-yuui-surface/40 text-left transition-all hover:border-white/[0.15]"
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-white/5">
          {manga.coverUrl && !coverError ? (
            <img
              src={manga.coverUrl}
              alt={manga.title}
              loading="lazy"
              onError={() => setCoverError(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-2xl">📖</div>
          )}
          {subtitle && (
            <div className="absolute right-1.5 top-1.5 rounded-md bg-yuui-accent px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur z-10 uppercase tracking-wide">
              {subtitle}
            </div>
          )}
        </div>
        <span className="line-clamp-2 px-2 py-1.5 text-[11px] font-semibold leading-tight text-white/90">
          {manga.title}
        </span>
      </button>
    );
  }

  return (
    <div className="relative group">
      {/* Background glow utilizing theme accent */}
      <div
        className="absolute -inset-1 rounded-2xl opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-40 bg-yuui-accent/30"
      />

      <motion.div
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onClick={onClick}
        className="relative cursor-pointer overflow-hidden rounded-xl border border-white/[0.06] bg-yuui-panel shadow-card w-full aspect-[3/4]"
      >
        {/* Cover Image */}
        {manga.coverUrl && !coverError ? (
          <img
            src={manga.coverUrl}
            alt={manga.title}
            loading="lazy"
            onError={() => setCoverError(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="grid h-full w-full place-items-center text-4xl bg-gradient-to-br from-yuui-accent/20 to-[#0f0f16]"
          >
            📖
          </div>
        )}



        {/* Subtitle Badge (Top-Right) */}
        {subtitle && (
          <div className="absolute right-2 top-2 rounded-md bg-yuui-accent px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur z-10 uppercase tracking-wide">
            {subtitle}
          </div>
        )}

        {/* Dark bottom-to-top gradient overlay */}
        <div
          className={`absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black/95 via-black/50 to-transparent z-10 transition-opacity duration-300 ${
            isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        />

        {/* Non-hovered title block */}
        {!isHovered && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent p-3 pt-8 z-10">
            <span className="line-clamp-2 block text-xs font-bold leading-tight text-white drop-shadow">
              {manga.title}
            </span>
          </div>
        )}

        {/* Hovered details slide-up block */}
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={isHovered ? { y: 0, opacity: 1 } : { y: 12, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="absolute bottom-0 left-0 right-0 p-3 z-30 pointer-events-none flex flex-col gap-1.5"
        >
          <h3 className="line-clamp-2 text-xs font-bold leading-snug text-white drop-shadow">
            {manga.title}
          </h3>
          <div className="flex flex-wrap gap-1 text-[9px] text-muted-foreground font-semibold">
            {manga.year != null && (
              <span className="rounded bg-black/50 px-1 py-0.5 text-yuui-accent backdrop-blur border border-white/[0.04]">
                {manga.year}
              </span>
            )}
            <span className="rounded bg-black/50 px-1 py-0.5 capitalize backdrop-blur border border-white/[0.04]">
              {manga.status}
            </span>
            {manga.contentRating && (
              <span className="rounded bg-black/50 px-1 py-0.5 capitalize backdrop-blur border border-white/[0.04]">
                {manga.contentRating}
              </span>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default MangaCard;
