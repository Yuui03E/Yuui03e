import type { StoredEntry } from "./types";

/**
 * Given a list of stored entries and an AniList media id, return the local
 * entry key if a folder match with files exists, otherwise fall back to
 * `anilist:<id>` so the user can still navigate to a detail page.
 */
export function resolveEntryKey(
  entries: StoredEntry[],
  anilistId: number,
): string {
  const local = entries.find(
    (e) => e.media?.id === anilistId && e.files && e.files.length > 0,
  );
  return local ? local.key : `anilist:${anilistId}`;
}
