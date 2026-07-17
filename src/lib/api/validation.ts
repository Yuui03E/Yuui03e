// Settings validation (Phase 4).
import { invoke } from "@tauri-apps/api/core";

/** Validate a TMDB API key. Resolves with a success message or rejects with an error. */
export async function testTmdbKey(key: string): Promise<string> {
  return invoke<string>("test_tmdb_key", { key });
}

/** Test AniDB credentials by attempting a login. Returns success message or error. */
export async function testAnidbCredentials(
  username: string,
  password: string,
): Promise<string> {
  return invoke<string>("test_anidb_credentials", { username, password });
}


