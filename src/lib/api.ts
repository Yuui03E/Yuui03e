// Bridge to the Rust/Tauri backend.
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  AniListMedia,
  LibraryEntry,
  ScannedSeries,
  StoredEntry,
  UserData,
} from "./types";

/** Open the native folder picker; returns selected path or null. */
export async function pickFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Choose an anime library folder",
  });
  if (Array.isArray(selected)) return selected[0] ?? null;
  return selected ?? null;
}

/** Recursively scan a folder and return grouped, parsed series. */
export async function scanLibrary(path: string): Promise<ScannedSeries[]> {
  return invoke<ScannedSeries[]>("scan_library", { path });
}

/** Match scanned series against AniList and return enriched library entries. */
export async function matchSeries(
  series: ScannedSeries[],
): Promise<LibraryEntry[]> {
  return invoke<LibraryEntry[]>("match_series", { series });
}

/** Get the user's default anime folder from the backend. */
export async function defaultAnimePath(): Promise<string> {
  return invoke<string>("default_anime_path");
}

/**
 * Full pipeline: scan → match → persist → return the hydrated library from the
 * SQLite store. Re-scans are stable (manual matches + user data preserved).
 */
export async function syncLibrary(path: string): Promise<StoredEntry[]> {
  return invoke<StoredEntry[]>("sync_library", { path });
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

/** Get a persistent configuration setting from the SQLite store. */
export async function getSetting(key: string): Promise<string | null> {
  return invoke<string | null>("get_setting", { key });
}

/** Save a persistent configuration setting to the SQLite store. */
export async function setSetting(key: string, value: string): Promise<void> {
  return invoke("set_setting", { key, value });
}

/** Test connection to the AniDB UDP API using stored credentials. */
export async function testAnidbConnection(): Promise<string> {
  return invoke<string>("test_anidb_connection");
}

