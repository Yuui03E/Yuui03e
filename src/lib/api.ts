// Bridge to the Rust/Tauri backend.
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { AniListMedia, StoredEntry, UserData } from "./types";

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

/** Open the native path picker for multiple folders or files. */
export async function pickMultiplePaths(
  selectFolders: boolean,
): Promise<string[]> {
  const selected = await open({
    directory: selectFolders,
    multiple: true,
    title: selectFolders
      ? "Select Anime Library folders"
      : "Select Anime video files",
    filters: selectFolders
      ? undefined
      : [
          {
            name: "Video Files",
            extensions: ["mp4", "mkv", "avi", "webm", "m4v"],
          },
        ],
  });
  if (!selected) return [];
  if (Array.isArray(selected)) return selected;
  return [selected];
}

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

/** Get a persistent configuration setting from the SQLite store. */
export async function getSetting(key: string): Promise<string | null> {
  return invoke<string | null>("get_setting", { key });
}

/** Save a persistent configuration setting to the SQLite store. */
export async function setSetting(key: string, value: string): Promise<void> {
  return invoke("set_setting", { key, value });
}

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

/** Validate a TMDB API key. Resolves with a success message or rejects with an error. */
export async function testTmdbKey(key: string): Promise<string> {
  return invoke<string>("test_tmdb_key", { key });
}

/** Execute generic GraphQL query/mutation against AniList. */
export async function graphqlAnilist(
  query: string,
  variables: Record<string, any>,
): Promise<any> {
  return invoke("graphql_anilist", { query, variables });
}

// ---------------------------------------------------------------------------
// Playback history (Phase 4 — SQLite-backed)
// ---------------------------------------------------------------------------

export interface PlaybackHistoryEntry {
  file_path: string;
  series_key: string | null;
  episode: number | null;
  title: string | null;
  position: number;
  duration: number;
}

/** Save or update the playback position for a file. */
export async function savePlaybackPosition(
  entry: PlaybackHistoryEntry,
): Promise<void> {
  return invoke("save_playback_position", { entry });
}

/** Get the saved playback position (in seconds) for a file. */
export async function getPlaybackPosition(
  filePath: string,
): Promise<number | null> {
  return invoke<number | null>("get_playback_position", { filePath });
}

/** Delete the playback history entry for a file (e.g. after 85%+ watched). */
export async function deletePlaybackPosition(filePath: string): Promise<void> {
  return invoke("delete_playback_position", { filePath });
}

/** Get recent playback entries for "Continue Watching" UI. */
export async function recentPlayback(): Promise<PlaybackHistoryEntry[]> {
  return invoke<PlaybackHistoryEntry[]>("recent_playback");
}

// ---------------------------------------------------------------------------
// Settings validation (Phase 4)
// ---------------------------------------------------------------------------

/** Test AniDB credentials by attempting a login. Returns success message or error. */
export async function testAnidbCredentials(
  username: string,
  password: string,
): Promise<string> {
  return invoke<string>("test_anidb_credentials", { username, password });
}

/** Test if FFmpeg exists at the given path (or on PATH if empty). Returns version string. */
export async function testFfmpegPath(path: string): Promise<string> {
  return invoke<string>("test_ffmpeg_path", { path });
}

/** Remove all library entries associated with a folder path, then return
 * the updated library. No scanning or network calls. */
export async function removeFolderEntries(
  folder: string,
): Promise<StoredEntry[]> {
  return invoke<StoredEntry[]>("remove_folder_entries", { folder });
}

// ---------------------------------------------------------------------------
// Sync control — cancel, pause, resume an ongoing sync
// ---------------------------------------------------------------------------

/** Cancel an ongoing sync. Current series finishes, then matching stops. */
export async function cancelSync(): Promise<void> {
  return invoke("cancel_sync");
}

/** Pause an ongoing sync. Current series finishes, then matching pauses. */
export async function pauseSync(): Promise<void> {
  return invoke("pause_sync");
}

/** Resume a paused sync. */
export async function resumeSync(): Promise<void> {
  return invoke("resume_sync");
}

/** Open the native file selector to pick a background image. */
export async function pickBackgroundImage(): Promise<string | null> {
  const selected = await open({
    directory: false,
    multiple: false,
    title: "Select Background Image",
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "webp", "gif"],
      },
    ],
  });
  if (Array.isArray(selected)) return selected[0] ?? null;
  return selected ?? null;
}
