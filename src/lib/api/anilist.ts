// AniList GraphQL + artwork (TMDB backdrops).
import { invoke } from "@tauri-apps/api/core";
import { toAniListStatus } from "../anilistStatus";

/**
 * Resolve the highest-resolution background artwork for a series via TMDB.
 * Returns an ordered list of full-res landscape backdrop URLs (best first), or
 * an empty array when no TMDB key is set or no confident match exists. Cached
 * per AniList id in the backend.
 */
export async function getBackdrops(
  anilistId: number,
  titles: (string | null | undefined)[],
  year: number | null,
  format: string | null,
): Promise<string[]> {
  return invoke<string[]>("get_backdrops", {
    anilistId,
    titles: titles.filter((t): t is string => !!t && t.trim().length > 0),
    year: year ?? null,
    format: format ?? null,
  });
}

/** Execute generic GraphQL query/mutation against AniList. */
export async function graphqlAnilist(
  query: string,
  variables: Record<string, any>,
): Promise<any> {
  return invoke("graphql_anilist", { query, variables });
}

export interface ViewerProfile {
  name: string;
  avatarUrl: string;
}

/** Fetch the authenticated AniList user's profile (name + avatar). */
export async function fetchViewer(): Promise<ViewerProfile | null> {
  try {
    const res = await graphqlAnilist(
      `query { Viewer { name avatar { large } } }`,
      {},
    );
    const user = res?.data?.Viewer;
    return user ? { name: user.name, avatarUrl: user.avatar.large } : null;
  } catch {
    return null;
  }
}

/**
 * Save (create or update) a media list entry on AniList.
 *
 * Accepts local display-status values (e.g. "Watching", "Completed") and
 * converts them internally. Fields that are `undefined` are omitted from the
 * GraphQL variables so the mutation only touches what was explicitly provided.
 */
export async function saveMediaListEntry({
  mediaId,
  progress,
  status,
  score,
}: {
  mediaId: number;
  progress?: number;
  status?: string;
  score?: number;
}): Promise<any> {
  const variables: Record<string, any> = { mediaId };
  if (progress !== undefined) variables.progress = progress;
  if (status !== undefined) variables.status = toAniListStatus(status);
  if (score !== undefined) variables.score = score;

  return graphqlAnilist(
    `mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus, $score: Float) {
      SaveMediaListEntry (mediaId: $mediaId, progress: $progress, status: $status, score: $score) {
        id
        progress
        status
        score
      }
    }`,
    variables,
  );
}
