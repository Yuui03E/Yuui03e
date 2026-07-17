// Persistent configuration settings (SQLite key/value store).
import { invoke } from "@tauri-apps/api/core";

/** Get a persistent configuration setting from the SQLite store. */
export async function getSetting(key: string): Promise<string | null> {
  return invoke<string | null>("get_setting", { key });
}

/** Save a persistent configuration setting to the SQLite store. */
export async function setSetting(key: string, value: string): Promise<void> {
  return invoke("set_setting", { key, value });
}
