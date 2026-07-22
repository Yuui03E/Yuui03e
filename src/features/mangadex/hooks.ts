import { useCallback, useEffect, useState } from "react";
import { isFavorite as dbIsFavorite, listFavorites } from "./api";
import type { LibraryEntry, FavoritePayload } from "./api";
import { addFavorite, removeFavorite } from "./api";
import type { MangaInfo } from "./api";

/**
 * Subscribe to the favorited state of a single manga, refreshed on mount
 * and after every toggle. Returns `[fav, toggle]`.
 */
export function useFavorite(mangaId: string | undefined): {
  fav: boolean;
  toggle: (manga?: MangaInfo) => Promise<void>;
  loading: boolean;
} {
  const [fav, setFav] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!mangaId) {
      setFav(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    dbIsFavorite(mangaId)
      .then((v) => {
        if (alive) setFav(v);
      })
      .catch(() => {
        if (alive) setFav(false);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [mangaId]);

  const toggle = useCallback(
    async (manga?: MangaInfo) => {
      if (!mangaId) return;
      if (fav) {
        try {
          await removeFavorite(mangaId);
        } catch {
          // Silently ignore removal failure — fav state will be refreshed on next mount
        }
        setFav(false);
        return;
      }
      const payload: FavoritePayload = {
        is_favorite: true,
        title: manga?.title ?? null,
        cover_url: manga?.coverUrl ?? null,
        content_rating: manga?.contentRating ?? null,
      };
      try {
        await addFavorite(mangaId, payload);
        setFav(true);
      } catch {
        // Silently ignore add failure — fav state will be refreshed on next mount
      }
    },
    [fav, mangaId],
  );

  return { fav, toggle, loading };
}

/** Cached favorite-manga ID set, useful for grids of cards. Refreshed once. */
export function useFavoriteIds(): { ids: Set<string>; refresh: () => void } {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    listFavorites()
      .then((rows: LibraryEntry[]) => {
        if (alive)
          setIds(
            new Set(rows.filter((r) => r.is_favorite).map((r) => r.manga_id)),
          );
      })
      .catch(() => {
        if (alive) setIds(new Set());
      });
    return () => {
      alive = false;
    };
  }, [nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { ids, refresh };
}
