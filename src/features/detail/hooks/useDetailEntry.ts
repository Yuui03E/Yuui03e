import { useEffect, useState } from "react";
import { useLibrary } from "../../../store/library";
import type { StoredEntry, UserData } from "../../../lib/types";
import { graphqlAnilist } from "../../../lib/api";

const toAniListStatus = (status: string) => {
  switch (status) {
    case "Watching": return "CURRENT";
    case "Completed": return "COMPLETED";
    case "Planning": return "PLANNING";
    case "Paused": return "PAUSED";
    case "Dropped": return "DROPPED";
    default: return "PLANNING";
  }
};

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

    const mediaId = entry.media?.id;
    if (mediaId) {
      try {
        await graphqlAnilist(
          `mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus, $score: Float) {
            SaveMediaListEntry (mediaId: $mediaId, progress: $progress, status: $status, score: $score) {
              id
              progress
              status
              score
            }
          }`,
          {
            mediaId,
            progress: next.progress,
            status: next.status ? toAniListStatus(next.status) : null,
            score: next.score
          }
        );
      } catch (e) {
        console.error("Failed to sync to AniList during detail update", e);
      }
    }
  };

  return { entry, setEntry, loading, user, update };
}
