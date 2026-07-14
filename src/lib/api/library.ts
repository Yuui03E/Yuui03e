// Library scan/read pipeline + user match data.
import { invoke } from "@tauri-apps/api/core";
import type { AniListMedia, StoredEntry, UserData } from "../types";

/** Get the user's default anime folder from the backend. */
export async function defaultAnimePath(): Promise<string> {
  return invoke<string>("default_anime_path");
}

/**
 * Full pipeline: scan → match → persist → return the hydrated library from the
 * SQLite store. Re-scans are stable (manual matches + user data preserved).
 */
export async function syncLibrary(path: string, prune = true): Promise<StoredEntry[]> {
  return invoke<StoredEntry[]>("sync_library", { path, prune });
}

/** Read the persisted library from SQLite (no network — instant startup). */
export async function getLibrary(): Promise<StoredEntry[]> {
  return invoke<StoredEntry[]>("get_library");
}

/**
 * Read a single stored entry by key, enriched with rich AniList detail
 * (characters, staff, relations, recommendations, trailer, tags…). Cached.
 */
export async function getEntry(key: string): Promise<StoredEntry | null> {
  return invoke<StoredEntry | null>("get_entry", { key });
}

/** Persist watch status / score / notes / favorite for a series. */
export async function setUserData(key: string, data: UserData): Promise<void> {
  return invoke("set_user_data", { key, data });
}

/** Pin a manual AniList match for a series (review-fix UI). */
export async function setManualMatch(
  key: string,
  media: unknown,
): Promise<void> {
  return invoke("set_manual_match", { key, media });
}

/**
 * Free-text AniList search returning media objects — powers the manual
 * match-fix (Review) UI.
 */
export async function searchAnilist(query: string): Promise<AniListMedia[]> {
  return invoke<AniListMedia[]>("search_anilist", { query });
}

/** Remove all library entries associated with a folder path, then return
 * the updated library. No scanning or network calls. */
export async function removeFolderEntries(
  folder: string,
): Promise<StoredEntry[]> {
  return invoke<StoredEntry[]>("remove_folder_entries", { folder });
}
