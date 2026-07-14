// Playback history (Phase 4 — SQLite-backed).
import { invoke } from "@tauri-apps/api/core";

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
