import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import type { LibraryEntry } from "../api";

interface LibraryTabProps {
  favorites: LibraryEntry[];
  cardSize: number;
  onBrowse: () => void;
}

/** Library grid of favorited manga. */
export default function LibraryTab({
  favorites,
  cardSize,
  onBrowse,
}: LibraryTabProps) {
  const navigate = useNavigate();
  const favCount = favorites.filter((f) => f.is_favorite).length;

  return (
    <div className="mt-6 flex-1">
      <p className="mb-3 text-sm text-yuui-muted">
        {favCount} favorited · {favorites.length} total in library
      </p>
      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Heart className="h-10 w-10 text-yuui-muted/40" />
          <p className="mt-3 text-sm text-yuui-muted">
            Your library is empty. Browse manga and add favorites from the
            detail view.
          </p>
          <button
            onClick={onBrowse}
            className="mt-4 rounded-xl bg-yuui-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Browse manga
          </button>
        </div>
      ) : (
        <div
          className="grid gap-5"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`,
          }}
        >
          {favorites.map((f) => (
            <button
              key={f.manga_id}
              onClick={() => navigate(`/mangadex/manga/${f.manga_id}`)}
              className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-yuui-surface/40 text-left transition-all hover:border-white/[0.15]"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-white/5">
                {f.cover_url ? (
                  <img
                    src={f.cover_url}
                    alt={f.title ?? ""}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-yuui-muted">
                    No Cover
                  </div>
                )}
              </div>
              <span className="line-clamp-2 p-3 text-sm font-semibold text-white/90 leading-tight">
                {f.title ?? "Unknown"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
