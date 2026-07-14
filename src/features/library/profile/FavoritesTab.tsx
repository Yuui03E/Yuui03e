import { motion } from "framer-motion";
import type { ViewerProfile } from "./types";

interface FavoritesTabProps {
  profile: ViewerProfile | null;
  coverSize: number;
}

export default function FavoritesTab({ profile, coverSize }: FavoritesTabProps) {
  const cardWidth = coverSize * 1.8;

  return (
    <motion.div
      key="favorites-tab"
      initial={{ opacity: 0, x: 5 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -5 }}
      className="space-y-6 h-full overflow-y-auto pr-1 pb-8"
    >
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">Favorite Anime</h3>
        <div className="flex flex-wrap gap-2.5 justify-start">
          {profile?.favourites?.anime.nodes.map((anime) => (
            <div
              key={anime.id}
              style={{ width: `${cardWidth}px` }}
              className="glass rounded-3xl p-3 border border-white/[0.04] bg-yuui-surface/20 flex flex-col justify-between group hover:scale-[1.03] transition-all duration-300 shrink-0"
            >
              <img
                src={anime.coverImage.large}
                alt="cover"
                className="w-full aspect-[2/3] object-cover rounded-2xl border border-white/10 shadow-lg bg-white/5"
              />
              <span className="text-xs font-bold text-white/90 line-clamp-2 mt-3 leading-tight group-hover:text-yuui-accent transition-colors text-center">
                {anime.title.english || anime.title.romaji}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">Favorite Characters</h3>
        <div className="flex flex-wrap gap-2.5 justify-start">
          {profile?.favourites?.characters.nodes.map((char) => (
            <div
              key={char.id}
              style={{ width: `${cardWidth}px` }}
              className="glass rounded-3xl p-3 border border-white/[0.04] bg-yuui-surface/20 flex flex-col justify-between group hover:scale-[1.03] transition-all duration-300 shrink-0"
            >
              <img
                src={char.image.large}
                alt="avatar"
                className="w-full aspect-[2/3] object-cover rounded-2xl border border-white/10 shadow-lg bg-white/5"
              />
              <span className="text-xs font-bold text-white/90 line-clamp-1 mt-3 leading-tight group-hover:text-yuui-accent transition-colors text-center">
                {char.name.full}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
