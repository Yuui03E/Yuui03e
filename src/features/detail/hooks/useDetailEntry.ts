import { useEffect, useState } from "react";
import { useLibrary } from "../../../store/library";
import type { StoredEntry, UserData } from "../../../lib/types";
import { saveMediaListEntry } from "../../../lib/api";

/**
 * The detail page's central data hook: loads the stored entry, exposes the
 * user-data fallback, and owns `update()` — the shared closure that patches
 * user data locally and persists it. `update` is threaded into every control
 * that mutates watch state (status/score/progress/favorite and the player).
 */
export function useDetailEntry(decodedKey: string) {
  const { fetchEntry, saveUserData, setActiveBackdrop } = useLibrary();

  const [entry, setEntry] = useState<StoredEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setEntry(null);
    setActiveBackdrop(null);
    fetchEntry(decodedKey).then((e) => {
      if (alive) {
        setEntry(e);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [decodedKey, fetchEntry, setActiveBackdrop]);

  const user: UserData = entry?.user ?? {
    status: null,
    score: null,
    progress: 0,
    notes: null,
    favorite: false,
  };

  const update = async (patch: Partial<UserData>) => {
    if (!entry) return;
    const next = { ...user, ...patch };
    setEntry({ ...entry, user: next });
    await saveUserData(entry.key, next);

    // Only mirror to AniList when a tracking field actually changed —
    // notes/favorite-only edits must not create or modify a list entry.
    const touchesTracking =
      "progress" in patch || "status" in patch || "score" in patch;
    const mediaId = entry.media?.id;
    if (mediaId && touchesTracking) {
      try {
        await saveMediaListEntry({
          mediaId,
          progress: next.progress,
          status: next.status ?? undefined,
          score: next.score ?? undefined,
        });
      } catch (e) {
        console.error("Failed to sync to AniList during detail update", e);
      }
    }
  };

  return { entry, setEntry, loading, user, update };
}
