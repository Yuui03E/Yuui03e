import { useState } from "react";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import type { MangaInfo } from "./api";
import { useFavorite } from "./hooks";

interface Props {
  manga: MangaInfo;
  onClick: () => void;
  showFavorite?: boolean;
}

/** Big 2/3 poster card in the style of the anime DiscoverCard. */
export default function MangaPosterCard({
  manga,
  onClick,
  showFavorite = false,
}: Props) {
  const { fav, toggle } = useFavorite(showFavorite ? manga.id : undefined);
  const [hovered, setHovered] = useState(false);

  const onHeart = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggle(manga);
  };

  return (
    <div className="group relative">
      <div className="absolute -inset-1 rounded-2xl bg-yuui-accent/30 opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-40" />
      <motion.div
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        onClick={onClick}
        className="relative aspect-[2/3] w-full cursor-pointer overflow-hidden rounded-xl border border-white/[0.06] bg-yuui-panel shadow-card"
      >
        {manga.coverUrl ? (
          <img
            src={manga.coverUrl}
            alt={manga.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-yuui-accent/20 to-[#0f0f16] text-3xl">
            📖
          </div>
        )}

        {!hovered && (
          <div className="absolute left-2 top-2 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-white/85 backdrop-blur">
            {manga.contentRating}
          </div>
        )}

        {showFavorite && (
          <button
            onClick={onHeart}
            className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 backdrop-blur transition-colors hover:bg-black/75"
            aria-label={fav ? "Unfavorite" : "Favorite"}
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                fav ? "fill-rose-500 text-rose-500" : "text-white/80"
              }`}
            />
          </button>
        )}

        <div
          className={`absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black/95 via-black/50 to-transparent transition-opacity duration-300 ${
            hovered ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />

        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={hovered ? { y: 0, opacity: 1 } : { y: 12, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="pointer-events-none absolute bottom-0 left-0 right-0 z-30 flex flex-col gap-1.5 p-3"
        >
          <h3 className="line-clamp-2 text-xs font-bold leading-snug text-white drop-shadow">
            {manga.title}
          </h3>
          <div className="flex flex-wrap gap-1 text-[9px] font-semibold">
            {manga.year != null && (
              <span className="rounded border border-white/[0.04] bg-black/50 px-1 py-0.5 backdrop-blur">
                {manga.year}
              </span>
            )}
            <span className="rounded border border-white/[0.04] bg-black/50 px-1 py-0.5 capitalize backdrop-blur">
              {manga.status}
            </span>
            {manga.tags[0] && (
              <span className="rounded border border-white/[0.04] bg-black/50 px-1 py-0.5 backdrop-blur">
                {manga.tags[0]}
              </span>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
