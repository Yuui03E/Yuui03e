import { invoke } from "@tauri-apps/api/core";
import type { MangaDexManga, MangaDexChapter, MangaDexPage } from "./types";

function getTitle(manga: MangaDexManga): string {
  return (
    manga.attributes.title.en ||
    Object.values(manga.attributes.title)[0] ||
    "Unknown"
  );
}

function getDescription(manga: MangaDexManga): string {
  const desc = manga.attributes.description;
  return desc.en || Object.values(desc)[0] || "";
}

function getCoverUrl(manga: MangaDexManga): string | null {
  const coverRel = manga.relationships?.find((r) => r.type === "cover_art");
  if (!coverRel?.attributes) return null;
  const filename = (coverRel.attributes as Record<string, unknown>)
    .fileName as string;
  if (!filename) return null;
  return `https://uploads.mangadex.org/covers/${manga.id}/${filename}.512.jpg`;
}

export interface MangaInfo {
  id: string;
  title: string;
  description: string;
  year: number | null;
  status: string;
  tags: string[];
  tagIds: string[];
  coverUrl: string | null;
  latestChapter: string | null;
  contentRating: string;
  availableTranslatedLanguages: string[];
  originalLanguage: string;
  publicationDemographic: string | null;
  createdAt?: string;
  author?: string | null;
  artist?: string | null;
  links?: Record<string, string> | null;
}

export interface ChapterInfo {
  id: string;
  title: string;
  chapter: string | null;
  volume: string | null;
  pages: number;
  lang: string;
  publishAt: string;
  readableAt: string;
  mangaId: string | null;
  groupName?: string | null;
}

export interface ChapterUpdateInfo extends ChapterInfo {
  groupName: string | null;
  manga?: MangaInfo;
}

export interface TagInfo {
  id: string;
  name: string;
  group: string;
}

// Persistence (Phase A) types — mirror the Rust structs in db/mangadex.rs.
export interface LibraryEntry {
  manga_id: string;
  added_at: number;
  is_favorite: boolean;
  title: string | null;
  cover_url: string | null;
  content_rating: string | null;
}

export interface ProgressRow {
  chapter_id: string;
  manga_id: string;
  chapter_number: string | null;
  read_at: number;
  progress: number;
}

export interface HistoryRow {
  chapter_id: string;
  manga_id: string;
  chapter_number: string | null;
  read_at: number;
  progress: number;
  title: string | null;
  cover_url: string | null;
}

export interface FavoritePayload {
  is_favorite: boolean;
  title: string | null;
  cover_url: string | null;
  content_rating: string | null;
}

function getAuthor(manga: MangaDexManga): string | null {
  const authorRel = manga.relationships?.find((r) => r.type === "author");
  if (!authorRel?.attributes) return null;
  return (authorRel.attributes as Record<string, unknown>).name as string;
}

function getArtist(manga: MangaDexManga): string | null {
  const artistRel = manga.relationships?.find((r) => r.type === "artist");
  if (!artistRel?.attributes) return null;
  return (artistRel.attributes as Record<string, unknown>).name as string;
}

function toMangaInfo(manga: MangaDexManga): MangaInfo {
  return {
    id: manga.id,
    title: getTitle(manga),
    description: getDescription(manga),
    year: manga.attributes.year,
    status: manga.attributes.status,
    tags: manga.attributes.tags.map(
      (t) =>
        t.attributes.name.en || Object.values(t.attributes.name)[0] || t.id,
    ),
    tagIds: manga.attributes.tags.map((t) => t.id),
    coverUrl: getCoverUrl(manga),
    latestChapter: manga.attributes.latestUploadedChapter,
    contentRating: manga.attributes.contentRating,
    availableTranslatedLanguages:
      manga.attributes.availableTranslatedLanguages ?? [],
    originalLanguage: manga.attributes.originalLanguage,
    publicationDemographic: manga.attributes.publicationDemographic,
    createdAt: manga.attributes.createdAt,
    author: getAuthor(manga),
    artist: getArtist(manga),
    links: manga.attributes.links,
  };
}

function toChapterInfo(chapter: MangaDexChapter): ChapterInfo {
  const mangaRel = chapter.relationships?.find((r) => r.type === "manga");
  const groupRel = chapter.relationships?.find(
    (r) => r.type === "scanlation_group",
  );
  return {
    id: chapter.id,
    title: chapter.attributes.title || `Chapter ${chapter.attributes.chapter}`,
    chapter: chapter.attributes.chapter,
    volume: chapter.attributes.volume,
    pages: chapter.attributes.pages,
    lang: chapter.attributes.translatedLanguage,
    publishAt: chapter.attributes.publishAt,
    readableAt: chapter.attributes.readableAt,
    mangaId: mangaRel ? (mangaRel as { id: string }).id : null,
    groupName: groupRel?.attributes
      ? (((groupRel.attributes as Record<string, unknown>).name as string) ??
        null)
      : null,
  };
}

/**
 * Helper: call the Rust backend proxy which fetches from MangaDex API.
 * This bypasses CORS restrictions that would block browser fetch().
 */
async function mdGet(path: string) {
  return invoke("mangadex_get", { path }) as Promise<any>;
}

/**
 * Build a query string honoring MangaDex's bracket-array convention.
 * Arrays are emitted as `key[]=v1&key[]=v2` (MangaDex rejects comma-joined
 * strings with HTTP 400 "String value found, but an array is required").
 * Pass keys WITHOUT the `[]` suffix for arrays — it's added automatically.
 */
function buildQuery(params: Record<string, string | string[]>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    const arrayKey = key.endsWith("[]") ? key : `${key}[]`;
    if (Array.isArray(value)) {
      for (const v of value) {
        parts.push(`${encodeURIComponent(arrayKey)}=${encodeURIComponent(v)}`);
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  return parts.join("&");
}

// ---------------------------------------------------------------------------
// Default-filters helper (respects persisted user settings)
// ---------------------------------------------------------------------------

/** Default content-rating set when none is supplied by the caller. */
const DEFAULT_CONTENT_RATING = ["safe", "suggestive"];

interface DefaultFilters {
  contentRating?: string[];
  translatedLanguage?: string;
  originalLanguage?: string;
  offset?: number;
}

function applyDefaults(
  params: Record<string, string | string[]>,
  filters?: DefaultFilters,
): Record<string, string | string[]> {
  const out = { ...params };
  if (!("contentRating" in out)) {
    out.contentRating = filters?.contentRating ?? DEFAULT_CONTENT_RATING;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Manga list feeds
// ---------------------------------------------------------------------------

/** Search manga by title. */
export async function searchManga(query: string): Promise<MangaInfo[]> {
  const qs = buildQuery({
    title: query,
    limit: "30",
    "order[relevance]": "desc",
    includes: ["cover_art"],
    contentRating: ["safe", "suggestive", "erotica"],
  });
  const json = await mdGet(`/manga?${qs}`);
  return (json.data as MangaDexManga[]).map(toMangaInfo);
}

/** Get trending/popular manga. Matches the MangaDex website's "Popular" section. */
export async function getTrendingManga(
  limit = 30,
  filters?: DefaultFilters,
): Promise<MangaInfo[]> {
  const params: Record<string, string | string[]> = {
    limit: String(limit),
    "order[followedCount]": "desc",
    includes: ["cover_art"],
    // Do NOT filter by contentRating — the website shows all ratings.
    // Users control filtering via settings; the "Popular" section should
    // match the website exactly.
    contentRating: filters?.contentRating ?? ["safe", "suggestive", "r15", "erotica"],
  };
  if (filters?.offset) params.offset = String(filters.offset);
  const qs = buildQuery(applyDefaults(params, filters));
  const json = await mdGet(`/manga?${qs}`);
  return (json.data as MangaDexManga[]).map(toMangaInfo);
}

/** Get recently added manga. */
export async function getRecentlyAddedManga(
  limit = 30,
  filters?: DefaultFilters,
): Promise<MangaInfo[]> {
  const params: Record<string, string | string[]> = {
    limit: String(limit),
    "order[createdAt]": "desc",
    includes: ["cover_art"],
  };
  if (filters?.offset) params.offset = String(filters.offset);
  const qs = buildQuery(applyDefaults(params, filters));
  const json = await mdGet(`/manga?${qs}`);
  return (json.data as MangaDexManga[]).map(toMangaInfo);
}

/** Get recommended manga (official Staff Picks). */
export async function getRecommendedManga(
  limit = 30,
  filters?: DefaultFilters,
): Promise<MangaInfo[]> {
  const listId = "805ba886-dd99-4aa4-b460-4bd7c7b71352"; // Official Recommended List ID
  try {
    const mangaIds = await getCustomListMangaIds(listId);
    if (mangaIds.length === 0) {
      return getTrendingManga(limit, filters);
    }
    
    const offsetVal = filters?.offset ?? 0;
    const pageIds = mangaIds.slice(offsetVal, offsetVal + limit);
    if (pageIds.length === 0) {
      return getTrendingManga(limit, filters);
    }

    const resolved = await browseManga({
      contentRating: filters?.contentRating ?? ["safe", "suggestive", "erotica"],
      limit: pageIds.length,
      ids: pageIds,
    });

    const origLangFilter = filters?.originalLanguage ?? undefined;

    return pageIds
      .map((id) => resolved.find((item) => item.id === id))
      .filter((item): item is MangaInfo => !!item)
      .filter(
        (m) =>
          !origLangFilter || m.originalLanguage === origLangFilter,
      );
  } catch (err) {
    console.error("Failed to fetch recommended list:", err);
    return getTrendingManga(limit, filters);
  }
}

/** Get top-rated manga. */
export async function getTopRatedManga(
  limit = 30,
  filters?: DefaultFilters,
): Promise<MangaInfo[]> {
  const params: Record<string, string | string[]> = {
    limit: String(limit),
    "order[rating]": "desc",
    includes: ["cover_art"],
  };
  if (filters?.offset) params.offset = String(filters.offset);
  const qs = buildQuery(applyDefaults(params, filters));
  const json = await mdGet(`/manga?${qs}`);
  return (json.data as MangaDexManga[]).map(toMangaInfo);
}

/** Get popular new titles matching MangaDex's "Popular New Titles" section. */
export async function getPopularNewTitles(
  limit = 30,
  filters?: DefaultFilters,
): Promise<MangaInfo[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19);

  const params: Record<string, string | string[]> = {
    limit: String(limit),
    "order[followedCount]": "desc",
    includes: ["cover_art"],
    createdAtSince: thirtyDaysAgo,
    hasAvailableChapters: "true",
  };
  if (filters?.offset) params.offset = String(filters.offset);
  if (filters?.originalLanguage)
    params.originalLanguage = [filters.originalLanguage];
  if (filters?.translatedLanguage && filters.translatedLanguage.trim() !== "")
    params.availableTranslatedLanguage = [filters.translatedLanguage];

  const qs = buildQuery(applyDefaults(params, filters));
  const json = await mdGet(`/manga?${qs}`);
  const results = (json.data as MangaDexManga[]).map(toMangaInfo);

  // If 30 days yields no results (e.g. strict filters), fall back to 90 days
  if (results.length === 0 && !filters?.offset) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19);
    const fallbackParams = { ...params, createdAtSince: ninetyDaysAgo };
    const fallbackQs = buildQuery(applyDefaults(fallbackParams, filters));
    const fallbackJson = await mdGet(`/manga?${fallbackQs}`);
    return (fallbackJson.data as MangaDexManga[]).map(toMangaInfo);
  }

  return results;
}


/** Fetch the full tag list from `/manga/tag`. Results are cached in-process. */
let tagCache: TagInfo[] | null = null;
export async function getTags(): Promise<TagInfo[]> {
  if (tagCache) return tagCache;
  const json = await mdGet(`/manga/tag`);
  const data = json.data as {
    id: string;
    attributes: { name: Record<string, string>; group: string };
  }[];
  tagCache = data.map((t) => ({
    id: t.id,
    name: t.attributes.name.en || Object.values(t.attributes.name)[0] || t.id,
    group: t.attributes.group,
  }));
  return tagCache;
}

/**
 * Generic browse builder. `filters` lets the caller pass any combination of
 * tag / content-rating / language filters; missing values fall back to
 * sensible defaults.
 */
export interface BrowseFilters extends DefaultFilters {
  title?: string;
  includedTags?: string[];
  excludedTags?: string[];
  status?: string[];
  publicationDemographic?: string[];
  order?: Record<string, string>;
  limit?: number;
  offset?: number;
  year?: number;
  createdAtSince?: string;
  ids?: string[];
}

export async function browseManga(
  filters: BrowseFilters,
): Promise<MangaInfo[]> {
  const params: Record<string, string | string[]> = {
    includes: ["cover_art"],
    limit: String(filters.limit ?? 30),
  };
  if (filters.offset) params.offset = String(filters.offset);
  if (filters.year) params.year = String(filters.year);
  if (filters.createdAtSince) params.createdAtSince = filters.createdAtSince;
  if (filters.ids?.length) params.ids = filters.ids;
  if (filters.title) params.title = filters.title;
  if (filters.includedTags?.length) params.includedTags = filters.includedTags;
  if (filters.excludedTags?.length) params.excludedTags = filters.excludedTags;
  if (filters.status?.length) params.status = filters.status;
  if (filters.publicationDemographic?.length)
    params.publicationDemographic = filters.publicationDemographic;
  if (filters.originalLanguage)
    params.originalLanguage = [filters.originalLanguage];
  if (filters.translatedLanguage && filters.translatedLanguage.trim() !== "")
    params.availableTranslatedLanguage = [filters.translatedLanguage];
  params.contentRating = filters.contentRating ?? DEFAULT_CONTENT_RATING;
  if (filters.order) {
    for (const [k, v] of Object.entries(filters.order)) {
      params[`order[${k}]`] = v;
    }
  } else if (!filters.title) {
    params["order[followedCount]"] = "desc";
  } else {
    params["order[relevance]"] = "desc";
  }

  const qs = buildQuery(params);
  const json = await mdGet(`/manga?${qs}`);
  return (json.data as MangaDexManga[]).map(toMangaInfo);
}

/**
 * Latest chapter updates: fetches recent chapters then bulk-fetches the
 * associated manga in one `/manga?ids[]=...` call, deduping IDs.
 * Returns `ChapterUpdateInfo[]` with the resolved `manga` attached.
 */
export async function getLatestChapterUpdates(
  limit = 30,
  filters?: DefaultFilters,
): Promise<ChapterUpdateInfo[]> {
  const contentRating = filters?.contentRating ?? DEFAULT_CONTENT_RATING;
  // Match the website's Latest Updates page: do NOT filter by translatedLanguage
  // unless the user explicitly set a language in settings.
  const langFilter = filters?.translatedLanguage;
  const params: Record<string, string | string[]> = {
    limit: String(limit),
    "order[readableAt]": "desc",
    contentRating,
    includes: ["scanlation_group"],
  };
  if (langFilter && langFilter.trim() !== "") {
    params.translatedLanguage = [langFilter];
  }
  if (filters?.offset) params.offset = String(filters.offset);
  const chapterQs = buildQuery(params);
  const chapterJson = await mdGet(`/chapter?${chapterQs}`);
  const chapters = chapterJson.data as MangaDexChapter[];

  // Collect unique manga IDs and a map of scanlation-group name per chapter.
  const mangaIds = new Set<string>();
  const groupNameById = new Map<string, string | null>();
  for (const ch of chapters) {
    const mangaRel = ch.relationships?.find((r) => r.type === "manga");
    const groupRel = ch.relationships?.find(
      (r) => r.type === "scanlation_group",
    );
    if (mangaRel) mangaIds.add((mangaRel as { id: string }).id);
    groupNameById.set(
      ch.id,
      groupRel?.attributes
        ? (((groupRel.attributes as Record<string, unknown>).name as string) ??
            null)
        : null,
    );
  }

  // Bulk-fetch the manga in one request using ids[].
  let mangaById = new Map<string, MangaInfo>();
  if (mangaIds.size > 0) {
    const mangaQs = buildQuery({
      ids: Array.from(mangaIds),
      includes: ["cover_art"],
      limit: String(mangaIds.size),
      contentRating,
    });
    const mangaJson = await mdGet(`/manga?${mangaQs}`);
    for (const m of mangaJson.data as MangaDexManga[]) {
      mangaById.set(m.id, toMangaInfo(m));
    }
  }

  const seenManga = new Set<string>();
  const updates: ChapterUpdateInfo[] = [];

  for (const ch of chapters) {
    const info = toChapterInfo(ch);
    if (!info.mangaId) continue;
    const manga = mangaById.get(info.mangaId);
    if (!manga) continue; // Exclude chapters whose manga failed to load
    if (seenManga.has(info.mangaId)) continue; // Deduplicate by mangaId

    seenManga.add(info.mangaId);
    updates.push({
      ...info,
      groupName: groupNameById.get(ch.id) ?? null,
      manga,
    });
  }

  return updates;
}

/**
 * Featured manga: fetches the popular new trending titles matching the
 * MangaDex website's "Popular New Titles" section. Periodically refreshed so the carousel stays current.
 */
export async function getFeaturedManga(
  limit = 10,
  filters?: DefaultFilters,
): Promise<MangaInfo[]> {
  return getPopularNewTitles(limit, filters);
}

/** Get full details for a single manga. */
export async function getMangaDetail(id: string): Promise<MangaInfo | null> {
  const qs = buildQuery({
    includes: ["cover_art", "author", "artist"],
  });
  try {
    const json = await mdGet(`/manga/${id}?${qs}`);
    return toMangaInfo(json.data as MangaDexManga);
  } catch {
    return null;
  }
}

/** Resolve mangaId, title, and coverUrl from a chapter ID. */
export async function getMangaIdFromChapter(
  chapterId: string,
): Promise<{
  mangaId: string | null;
  title: string | null;
  coverUrl: string | null;
}> {
  try {
    const json = await mdGet(`/chapter/${chapterId}?includes[]=manga`);
    const mangaRel = json.data?.relationships?.find(
      (r: Record<string, unknown>) => r.type === "manga",
    );
    if (!mangaRel?.id) return { mangaId: null, title: null, coverUrl: null };
    const mangaId = mangaRel.id as string;
    const title = mangaRel.attributes?.title
      ? ((mangaRel.attributes as Record<string, unknown>).title as Record<string, string>).en ||
        Object.values(
          (mangaRel.attributes as Record<string, unknown>).title as Record<string, string>,
        )[0] ||
        null
      : null;

    const detail = await getMangaDetail(mangaId);
    return {
      mangaId,
      title: title ?? detail?.title ?? null,
      coverUrl: detail?.coverUrl ?? null,
    };
  } catch {
    return { mangaId: null, title: null, coverUrl: null };
  }
}

/** Get chapter list for a manga. */
export async function getChapters(
  mangaId: string,
  lang?: string,
  contentRating: string[] = ["safe", "suggestive", "erotica", "pornographic"],
): Promise<ChapterInfo[]> {
  // The manga ID is in the path (`/manga/{id}/feed`); it must NOT also be
  // passed as a `manga` query param — MangaDex rejects that with HTTP 400
  // ("The property manga is not defined and the definition does not allow
  // additional properties").
  const queryParams: Record<string, string | string[]> = {
    "order[chapter]": "desc",
    limit: "100",
    offset: "0",
    includes: ["scanlation_group"],
    contentRating,
  };
  if (lang && lang.trim() !== "") {
    queryParams.translatedLanguage = [lang];
  }
  const qs = buildQuery(queryParams);
  const json = await mdGet(`/manga/${mangaId}/feed?${qs}`);
  return (json.data as MangaDexChapter[]).map((c) => ({
    ...toChapterInfo(c),
    mangaId,
  }));
}

/** Get page URLs for a chapter (at-home CDN).
 *  `quality`: "data" = full quality, "data-saver" = compressed images. */
export async function getChapterPages(
  chapterId: string,
  quality: "data" | "data-saver" = "data",
): Promise<MangaDexPage[]> {
  const json = await mdGet(
    `https://api.mangadex.org/at-home/server/${chapterId}`,
  );
  const baseUrl = json.baseUrl as string;
  const chapter = json.chapter as {
    hash: string;
    data: string[];
    dataSaver: string[];
  };
  const useSaver = quality === "data-saver" && chapter.dataSaver?.length > 0;
  const files = useSaver ? chapter.dataSaver : chapter.data;
  const seg = useSaver ? "data-saver" : "data";
  return files.map((filename: string) => ({
    url: `${baseUrl}/${seg}/${chapter.hash}/${filename}`,
    filename,
  }));
}

// ---------------------------------------------------------------------------
// Persistence wrappers (Phase A) — invoke the new Rust commands.
// ---------------------------------------------------------------------------

export async function addFavorite(
  mangaId: string,
  payload: FavoritePayload,
): Promise<void> {
  return invoke("mangadex_add_favorite", { mangaId, payload });
}

export async function removeFavorite(mangaId: string): Promise<void> {
  return invoke("mangadex_remove_favorite", { mangaId });
}

export async function isFavorite(mangaId: string): Promise<boolean> {
  return invoke<boolean>("mangadex_is_favorite", { mangaId });
}

export async function listFavorites(): Promise<LibraryEntry[]> {
  return invoke<LibraryEntry[]>("mangadex_list_favorites");
}

export async function saveReadingProgress(
  chapterId: string,
  mangaId: string,
  chapterNumber: string | null,
  progress: number,
  title?: string | null,
  coverUrl?: string | null,
): Promise<void> {
  return invoke("mangadex_save_reading_progress", {
    chapterId,
    mangaId,
    chapterNumber,
    progress,
    title,
    coverUrl,
  });
}

export async function getReadingProgress(
  mangaId: string,
): Promise<ProgressRow | null> {
  return invoke<ProgressRow | null>("mangadex_get_reading_progress", {
    mangaId,
  });
}

export async function listHistory(limit = 50): Promise<HistoryRow[]> {
  return invoke<HistoryRow[]>("mangadex_list_history", { limit });
}

export async function clearHistory(): Promise<void> {
  return invoke("mangadex_clear_history");
}

export async function deleteHistoryEntries(chapterIds: string[]): Promise<void> {
  return invoke("mangadex_delete_history_entries", { chapterIds });
}

export async function getCustomListMangaIds(listId: string): Promise<string[]> {
  try {
    const json = await mdGet(`/list/${listId}`);
    if (json.data) {
      const listData = json.data;
      return listData.relationships
        ? listData.relationships
            .filter((r: any) => r.type === "manga")
            .map((r: any) => r.id)
        : [];
    }
  } catch (e) {
    console.error("Failed to fetch custom list manga IDs", e);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Seasonal helpers
// ---------------------------------------------------------------------------

/**
 * Known MangaDex "seasonal" custom lists, keyed by `<season>-<year>`.
 * Season names are lowercase (`winter`, `spring`, `summer`, `fall`).
 * Add new entries here as MangaDex publishes new seasonal lists.
 */
export const SEASONAL_LIST_MAP: Record<string, string> = {
  "summer-2026": "68ab4f4e-6f01-4898-9038-c5eee066be27",
  "spring-2026": "77a339bd-6086-4e5c-bf1b-c67d16ab0c94",
  "winter-2025": "0e4ec8f9-410a-436f-bcf2-f791550c8d18",
  "spring-2025": "b65f7c32-1563-4414-9964-b620718525b6",
  "fall-2023": "8c4f0b35-776e-4404-897b-8219662e0861",
  "winter-2023": "7924e2c0-43b6-43b5-903c-87d27e274640",
};

/**
 * Derive the MangaDex/AniList season key (`<season>-<year>`) for a given date.
 * Conventions: spring=Mar–May, summer=Jun–Aug, fall=Sep–Nov, winter=Dec–Feb.
 * A January/February date belongs to the *previous* calendar year's winter
 * season (anime-season convention), e.g. 2027-01 → "winter-2026".
 */
export function getSeasonalKey(date: Date = new Date()): {
  season: string;
  year: number;
  key: string;
} {
  const m = date.getMonth(); // 0-11
  let season: string;
  let year = date.getFullYear();

  if (m >= 2 && m <= 4) season = "spring";
  else if (m >= 5 && m <= 7) season = "summer";
  else if (m >= 8 && m <= 10) season = "fall";
  else {
    season = "winter";
    // Jan/Feb belong to the prior year's winter season.
    if (m <= 1) year -= 1;
  }
  return { season, year, key: `${season}-${year}` };
}

/** Resolve a seasonal custom list id for the given season key, if known. */
export function getSeasonalListId(season: string, year: number): string | null {
  return SEASONAL_LIST_MAP[`${season}-${year}`] ?? null;
}
