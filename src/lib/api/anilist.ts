// AniList GraphQL + artwork (TMDB backdrops).
import { invoke } from "@tauri-apps/api/core";

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
