//! Tauri commands exposed to the React frontend.

use tauri::State;
use tauri::Emitter;
use std::sync::atomic::Ordering;

use crate::db::{self, Db, StoredEntry, UserData, PlaybackHistoryEntry};
use crate::metadata::{self, LibraryEntry};
use crate::scanner::{self, ScannedSeries};
use crate::SyncControl;

/// Default anime library path from the plan (user can override in the UI).
#[tauri::command]
pub fn default_anime_path() -> String {
    if let Some(home) = dirs_home() {
        let p = std::path::Path::new(&home)
            .join("Documents")
            .join("anime");
        return p.to_string_lossy().to_string();
    }
    // Return empty string so the frontend prompts the user to pick a folder
    // instead of returning a developer-specific hardcoded path.
    String::new()
}

fn dirs_home() -> Option<String> {
    std::env::var("USERPROFILE")
        .ok()
        .or_else(|| std::env::var("HOME").ok())
}

/// Recursively scan a folder and return grouped, parsed series.
#[tauri::command]
pub fn scan_library(
    path: String,
) -> Result<Vec<ScannedSeries>, String> {
    scanner::scan(&path)
}

/// Match scanned series against AniList and return enriched entries.
#[tauri::command]
pub async fn match_series(series: Vec<ScannedSeries>) -> Result<Vec<LibraryEntry>, String> {
    metadata::match_series(series).await
}

/// Full pipeline: scan → match → persist → return hydrated library from DB.
///
/// This is the primary command the frontend should call. It persists every
/// match (preserving manual matches + user data) so re-scans are stable, then
/// returns the stored library so the UI always reflects the DB source of truth.
///
/// Key improvements:
/// - Uses AniList token for 90 req/min (vs 30 without)
/// - Emits `sync:searching` events with per-series progress
/// - Emits `sync:entry-updated` events incrementally (so UI updates live)
/// - Respects cancel/pause flags from SyncControl state
/// - Emits `sync:error` events on API failures
#[tauri::command]
pub async fn sync_library(
    path: String,
    prune: bool,
    db: State<'_, Db>,
    sync_control: State<'_, SyncControl>,
    app: tauri::AppHandle,
) -> Result<Vec<StoredEntry>, String> {
    // Reset cancel/pause flags at the start of each sync
    sync_control.cancel.store(false, Ordering::Relaxed);
    sync_control.pause.store(false, Ordering::Relaxed);

    let _ = app.emit("sync:progress", "Scanning folders & files...");
    let paths: Vec<String> = path.split(';').map(|s| s.to_string()).filter(|s| !s.trim().is_empty()).collect();
    let mut series = scanner::scan_multiple(&paths)?;

    // Check cancel after scanning
    if sync_control.cancel.load(Ordering::Relaxed) {
        let _ = app.emit("sync:progress", "Sync cancelled");
        return db::all_entries(&db.0, &db.1).await;
    }

    // 1. Populate ed2k hashes, reusing existing ones from the DB where possible.
    let existing_files: Vec<(String, i64, Option<String>)> = sqlx::query_as(
        "SELECT path, size_bytes, ed2k FROM files WHERE ed2k IS NOT NULL",
    )
    .fetch_all(&db.0)
    .await
    .unwrap_or_default();

    let mut existing_map = std::collections::HashMap::new();
    for (fpath, size, ed2k) in existing_files {
        if let Some(h) = ed2k {
            existing_map.insert((fpath, size as u64), h);
        }
    }

    let hash_matching = db::get_setting(&db.0, "hash_matching")
        .await
        .unwrap_or(None)
        .map(|s| s == "true")
        .unwrap_or(true);

    let mut hashed_count = 0;
    let total_files: usize = series.iter().map(|s| s.files.len()).sum();

    if hash_matching {
        for s in &mut series {
            if sync_control.cancel.load(Ordering::Relaxed) {
                break;
            }
            for f in &mut s.files {
                if let Some(h) = existing_map.get(&(f.path.clone(), f.size_bytes)) {
                    f.ed2k = Some(h.clone());
                } else {
                    let path = f.path.clone();
                    let hash_result = tokio::task::spawn_blocking(move || {
                        crate::hashing::compute_ed2k_hash(&path)
                    })
                    .await;
                    if let Ok(Ok(h)) = hash_result {
                        f.ed2k = Some(h);
                    }
                }
                hashed_count += 1;
                let _ = app.emit(
                    "sync:progress",
                    format!("Hashing files ({} / {})", hashed_count, total_files),
                );
            }
        }
    }

    if sync_control.cancel.load(Ordering::Relaxed) {
        let _ = app.emit("sync:progress", "Sync cancelled");
        return db::all_entries(&db.0, &db.1).await;
    }

    // 2. Query AniDB for unmatched series if credentials are set.
    let username = db::get_setting(&db.0, "anidb_username")
        .await
        .unwrap_or(None);
    let password = db::get_setting(&db.0, "anidb_password")
        .await
        .unwrap_or(None);

    if let (Some(user), Some(pass)) = (username, password) {
        if !user.trim().is_empty() && !pass.trim().is_empty() {
            let _ = app.emit("sync:progress", "Contacting AniDB...");
            let series_keys: Vec<String> =
                series.iter().map(|s| crate::parser::normalize_title(&s.title)).collect();
            let matched_keys: std::collections::HashSet<String> = if !series_keys.is_empty() {
                let placeholders = series_keys.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                let query_str =
                    format!("SELECT key FROM series WHERE key IN ({placeholders}) AND matched = 1");
                let mut q = sqlx::query_as::<_, (String,)>(&query_str);
                for k in &series_keys {
                    q = q.bind(k);
                }
                q.fetch_all(&db.0)
                    .await
                    .map(|rows| rows.into_iter().map(|(k,)| k).collect())
                    .unwrap_or_default()
            } else {
                std::collections::HashSet::new()
            };

            // AniDB UDP is blocking — run in spawn_blocking to avoid stalling
            // the Tokio async runtime.
            let anidb_result = tokio::task::spawn_blocking(move || {
                let mut client = match crate::anidb::AniDBClient::new() {
                    Ok(c) => c,
                    Err(_) => return None,
                };
                if client.login(&user, &pass).is_err() {
                    return None;
                }
                Some((client, matched_keys))
            })
            .await;

            if let Ok(Some((mut client, matched_keys))) = anidb_result {
                for s in &mut series {
                    if sync_control.cancel.load(Ordering::Relaxed) {
                        break;
                    }
                    let key = crate::parser::normalize_title(&s.title);
                    if matched_keys.contains(&key) {
                        continue;
                    }
                    if let Some(first_file) = s.files.iter().find(|f| f.ed2k.is_some()) {
                        if let Ok(Some(anidb_match)) = client.lookup_file(
                            first_file.size_bytes,
                            first_file.ed2k.as_ref().unwrap(),
                        ) {
                            if let Some(ref title) = anidb_match.anime_title {
                                s.title = title.clone();
                            }
                            if let Some(ref group) = anidb_match.group_name {
                                if !s.release_groups.contains(group) {
                                    s.release_groups.push(group.clone());
                                }
                            }
                            for f in &mut s.files {
                                if let Some(ref group) = anidb_match.group_name {
                                    f.release_group = Some(group.clone());
                                }
                                if let Some(ep) = anidb_match.episode {
                                    f.episode = Some(ep);
                                }
                            }
                        }
                    }
                }
                let _ = client.logout();
            }
        }
    }

    if sync_control.cancel.load(Ordering::Relaxed) {
        let _ = app.emit("sync:progress", "Sync cancelled");
        return db::all_entries(&db.0, &db.1).await;
    }

    // 3. Match against AniList with token auth, progress events, cancel/pause support.
    let _ = app.emit("sync:progress", "Querying AniList...");

    // Get the AniList token from settings
    let anilist_token = db::get_setting(&db.0, "anilist_token")
        .await
        .unwrap_or(None);

    // Get all manual matches from the database to skip AniList lookup for them during scan
    let manual_rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT s.key, m.payload
         FROM series s
         JOIN media_cache m ON s.media_id = m.media_id
         WHERE s.manual = 1"
    )
    .fetch_all(&db.0)
    .await
    .unwrap_or_default();

    let mut manual_matches = std::collections::HashMap::new();
    for (key, payload) in manual_rows {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&payload) {
            manual_matches.insert(key, val);
        }
    }

    let entries = metadata::match_series_with_progress(
        series,
        &app,
        anilist_token,
        manual_matches,
        sync_control.cancel.clone(),
        sync_control.pause.clone(),
    )
    .await?;

    // Emit any API errors as sync:error events
    // (errors are already emitted per-series via sync:searching events)

    let total_entries = entries.len();
    let mut upserted_count = 0;

    for entry in &entries {
        db::upsert_entry(&db.0, entry).await?;
        upserted_count += 1;

        let _ = app.emit(
            "sync:progress",
            format!("Saving matches ({} / {})", upserted_count, total_entries),
        );

        // Emit entry-updated event so the frontend can update incrementally.
        // We send the FULL hydrated entry (read from the DB — no network) so the
        // frontend can insert it directly without issuing a second AniList query
        // per entry (that second request stream was causing 429 rate-limit storms).
        if let Ok(Some(hydrated)) = db::entry_by_key(&db.0, &entry.key, &db.1).await {
            let _ = app.emit("sync:entry-updated", &hydrated);
        }
    }

    // 4. Remove entries no longer present in the scan.
    //    Skip pruning if the sync was cancelled or if prune is false.
    if prune && !sync_control.cancel.load(Ordering::Relaxed) {
        let scanned_keys: std::collections::HashSet<String> = entries.iter().map(|e| e.key.clone()).collect();
        if scanned_keys.is_empty() {
            let _ = sqlx::query(
                "DELETE FROM series
                 WHERE manual = 0
                   AND key NOT IN (
                       SELECT series_key FROM user_data
                       WHERE status IS NOT NULL OR score IS NOT NULL OR progress > 0 OR notes IS NOT NULL OR favorite = 1
                   )"
            ).execute(&db.0).await;
        } else {
            let placeholders = scanned_keys.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            let delete_query = format!(
                "DELETE FROM series
                 WHERE key NOT IN ({placeholders})
                   AND manual = 0
                   AND key NOT IN (
                       SELECT series_key FROM user_data
                       WHERE status IS NOT NULL OR score IS NOT NULL OR progress > 0 OR notes IS NOT NULL OR favorite = 1
                   )"
            );
            let mut q = sqlx::query(&delete_query);
            for k in &scanned_keys {
                q = q.bind(k);
            }
            let _ = q.execute(&db.0).await;
        }
    }
    // 5. Update episode_count and release_groups for all remaining series (including setting to 0 for those with no files)
    let _ = sqlx::query(
        "UPDATE series SET
            episode_count = (SELECT COUNT(*) FROM files WHERE files.series_key = series.key),
            release_groups = COALESCE(
                (SELECT json_group_array(rg) FROM (
                    SELECT DISTINCT release_group as rg FROM files
                    WHERE files.series_key = series.key AND release_group IS NOT NULL
                )),
                '[]'
            )"
    )
    .execute(&db.0)
    .await;

    let _ = app.emit("sync:progress", "Finalizing sync...");
    let _ = app.emit("sync:complete", serde_json::json!({"matched": entries.len()}));
    db::all_entries(&db.0, &db.1).await
}

/// Read the persisted library (no network). Used on startup for instant load.
#[tauri::command]
pub async fn get_library(db: State<'_, Db>) -> Result<Vec<StoredEntry>, String> {
    db::all_entries(&db.0, &db.1).await
}

/// Read a single persisted entry by key, enriching it with rich AniList detail
/// (cached in `media_cache` after the first fetch).
#[tauri::command]
pub async fn get_entry(key: String, db: State<'_, Db>) -> Result<Option<StoredEntry>, String> {
    if key.starts_with("anilist:") {
        let id_str = key.trim_start_matches("anilist:");
        if let Ok(media_id) = id_str.parse::<i64>() {
            let detail = match db::get_detail(&db.0, media_id).await {
                Some(d) => Some(d),
                None => {
                    let token = db::get_setting(&db.0, "anilist_token").await.unwrap_or(None);
                    match metadata::fetch_detail(media_id, token).await {
                        Ok(d) => {
                            let _ = db::put_detail(&db.0, media_id, &d).await;
                            Some(d)
                        }
                        Err(_) => None,
                    }
                }
            };
            if let Some(d) = detail {
                let title = d
                    .get("title")
                    .and_then(|t| t.get("english").or(t.get("romaji")))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown")
                    .to_string();
                let entry = StoredEntry {
                    key: key.clone(),
                    title,
                    folder: "".to_string(),
                    release_groups: vec![],
                    episode_count: 0,
                    confidence: 1.0,
                    matched: true,
                    manual: false,
                    media: Some(d),
                    user: UserData::default(),
                    files: vec![],
                    analysis: crate::library_analysis::SeriesAnalysis::default(),
                };
                return Ok(Some(entry));
            }
        }
        return Ok(None);
    }

    let mut entry = match db::entry_by_key(&db.0, &key, &db.1).await? {
        Some(e) => e,
        None => return Ok(None),
    };

    if let Some(media_id) = entry
        .media
        .as_ref()
        .and_then(|m| m.get("id"))
        .and_then(|v| v.as_i64())
    {
        let detail = match db::get_detail(&db.0, media_id).await {
            Some(d) => Some(d),
            None => {
                let token = db::get_setting(&db.0, "anilist_token").await.unwrap_or(None);
                match metadata::fetch_detail(media_id, token).await {
                    Ok(d) => {
                        let _ = db::put_detail(&db.0, media_id, &d).await;
                        if let Some(id_mal) = d.get("idMal").and_then(|v| v.as_i64()) {
                            let _ = sqlx::query(
                                "INSERT OR REPLACE INTO id_mappings (anilist_id, mal_id) VALUES (?, ?)",
                            )
                            .bind(media_id)
                            .bind(id_mal)
                            .execute(&db.0)
                            .await;
                        }
                        Some(d)
                    }
                    Err(_) => None,
                }
            }
        };
        if let Some(d) = detail {
            entry.media = Some(d);
        }
    }

    Ok(Some(entry))
}

/// Persist watch status / score / notes / favorite for a series.
#[tauri::command]
pub async fn set_user_data(
    key: String,
    data: UserData,
    db: State<'_, Db>,
) -> Result<(), String> {
    db::set_user_data(&db.0, &key, &data).await
}

/// Pin a manual AniList match (used by the review-fix UI later).
#[tauri::command]
pub async fn set_manual_match(
    key: String,
    media: serde_json::Value,
    db: State<'_, Db>,
) -> Result<(), String> {
    db::set_manual_match(&db.0, &key, &media).await
}

/// Search AniList by free-text query — powers the manual match-fix (Review) UI.
/// Returns raw AniList media objects (frontend-shaped) for the user to pick from.
#[tauri::command]
pub async fn search_anilist(query: String) -> Result<Vec<serde_json::Value>, String> {
    metadata::search_frontend(&query).await
}

#[tauri::command]
pub async fn get_setting(
    key: String,
    db: State<'_, Db>,
) -> Result<Option<String>, String> {
    db::get_setting(&db.0, &key).await
}

#[tauri::command]
pub async fn set_setting(
    key: String,
    value: String,
    db: State<'_, Db>,
) -> Result<(), String> {
    db::set_setting(&db.0, &key, &value).await
}

/// Resolve the highest-resolution background artwork for a series.
///
/// AniList only exposes one (often-null) banner, so we match the title against
/// TMDB and return its full-resolution landscape backdrops (best-first). Results
/// are cached per AniList id; an empty list is returned (and cached) when no
/// TMDB key is set or no confident match exists — the UI then keeps the AniList
/// banner. `titles` should be [romaji, english, native] as available.
#[tauri::command]
pub async fn get_backdrops(
    anilist_id: i64,
    titles: Vec<String>,
    year: Option<i64>,
    format: Option<String>,
    db: State<'_, Db>,
) -> Result<Vec<String>, String> {
    // Serve from cache when we've resolved this series before.
    if let Some(cached) = db::get_backdrops(&db.0, anilist_id).await {
        return Ok(cached);
    }

    let api_key = db::get_setting(&db.0, "tmdb_api_key")
        .await?
        .unwrap_or_default();
    if api_key.trim().is_empty() {
        return Ok(vec![]); // No key configured — graceful fallback.
    }

    let kind = crate::tmdb::TmdbKind::from_format(format.as_deref());
    let title_refs: Vec<&str> = titles.iter().map(|s| s.as_str()).collect();

    // Reuse a previously resolved TMDB id when available; otherwise search.
    let tmdb_id = match db::get_tmdb_id(&db.0, anilist_id).await {
        Some(id) => Some(id),
        None => {
            let found =
                crate::tmdb::find_tmdb_id(&api_key, &title_refs, year, kind).await;
            if let Some(id) = found {
                let _ = db::put_tmdb_id(&db.0, anilist_id, id).await;
            }
            found
        }
    };

    let urls = match tmdb_id {
        Some(id) => crate::tmdb::fetch_backdrops(&api_key, id, kind).await,
        None => vec![],
    };

    // Cache even an empty result to avoid re-hitting TMDB on every visit.
    let _ = db::put_backdrops(&db.0, anilist_id, &urls).await;
    Ok(urls)
}

/// Validate a TMDB API key against TMDB's `/configuration` endpoint. Returns a
/// success message, or an error describing why the key was rejected.
#[tauri::command]
pub async fn test_tmdb_key(key: String) -> Result<String, String> {
    crate::tmdb::validate_key(key.trim()).await?;
    Ok("TMDB API key verified successfully".to_string())
}

/// Open a video file in the OS default external media player (e.g., VLC, MPC-HC).
#[tauri::command]
pub fn play_video(path: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("file path is empty".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(&["/C", "start", "", &path])
            .spawn()
            .map_err(|e| format!("failed to launch player: {e}"))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("failed to launch player: {e}"))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("failed to launch player: {e}"))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn graphql_anilist(
    query: String,
    variables: serde_json::Value,
    db: State<'_, Db>,
) -> Result<serde_json::Value, String> {
    let token = db::get_setting(&db.0, "anilist_token")
        .await
        .unwrap_or(None);
    crate::metadata::query_anilist(query, variables, token).await
}

// ---------------------------------------------------------------------------
// Sync control commands — cancel, pause, resume
// ---------------------------------------------------------------------------

/// Cancel an ongoing sync. The current series will finish, then matching stops.
/// Entries already persisted stay in the DB.
#[tauri::command]
pub fn cancel_sync(sync_control: State<'_, SyncControl>) -> Result<(), String> {
    sync_control.cancel.store(true, Ordering::Relaxed);
    Ok(())
}

/// Pause an ongoing sync. The current series search will finish, then
/// matching pauses until `resume_sync` is called.
#[tauri::command]
pub fn pause_sync(sync_control: State<'_, SyncControl>) -> Result<(), String> {
    sync_control.pause.store(true, Ordering::Relaxed);
    Ok(())
}

/// Resume a paused sync.
#[tauri::command]
pub fn resume_sync(sync_control: State<'_, SyncControl>) -> Result<(), String> {
    sync_control.pause.store(false, Ordering::Relaxed);
    Ok(())
}

/// Remove all library entries whose folder is under the given path, then
/// return the updated library from what remains. Lightweight — no scanning
/// or network calls; the DB cascade deletes files, user_data, and history.
#[tauri::command]
pub async fn remove_folder_entries(
    folder: String,
    db: State<'_, Db>,
) -> Result<Vec<StoredEntry>, String> {
    let mut tx = db.0.begin().await.map_err(|e| e.to_string())?;

    let sep = std::path::MAIN_SEPARATOR;
    let prefix = if folder.ends_with(sep) {
        folder.clone()
    } else {
        format!("{}{}", folder, sep)
    };

    // Escape wildcards for LIKE pattern using '^' as escape character
    let escaped_prefix = prefix
        .replace('^', "^^")
        .replace('%', "^%")
        .replace('_', "^_");
    let pattern = format!("{}%", escaped_prefix);

    // 1. Delete from playback_history for files under this folder
    sqlx::query("DELETE FROM playback_history WHERE file_path LIKE ? ESCAPE '^'")
        .bind(&pattern)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    // 2. Delete from files under this folder
    sqlx::query("DELETE FROM files WHERE path LIKE ? ESCAPE '^'")
        .bind(&pattern)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    // 3. Delete series that no longer have any files associated with them,
    //    BUT preserve any series that were manually matched (manual = 1) or have user_data.
    sqlx::query(
        "DELETE FROM series
         WHERE key NOT IN (SELECT DISTINCT series_key FROM files)
           AND manual = 0
           AND key NOT IN (
               SELECT series_key FROM user_data
               WHERE status IS NOT NULL OR score IS NOT NULL OR progress > 0 OR notes IS NOT NULL OR favorite = 1
           )"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // 4. Update episode_count and release_groups for all remaining series (including setting to 0 for those with no files)
    sqlx::query(
        "UPDATE series SET
            episode_count = (SELECT COUNT(*) FROM files WHERE files.series_key = series.key),
            release_groups = COALESCE(
                (SELECT json_group_array(rg) FROM (
                    SELECT DISTINCT release_group as rg FROM files
                    WHERE files.series_key = series.key AND release_group IS NOT NULL
                )),
                '[]'
            )"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    db::all_entries(&db.0, &db.1).await
}


// ---------------------------------------------------------------------------
// Playback history commands (SQLite-backed playback history)
// ---------------------------------------------------------------------------

/// Save or update the playback position for a file.
#[tauri::command]
pub async fn save_playback_position(
    entry: PlaybackHistoryEntry,
    db: State<'_, Db>,
) -> Result<(), String> {
    db::save_playback_position(&db.0, &entry).await
}

/// Get the saved playback position (in seconds) for a file.
#[tauri::command]
pub async fn get_playback_position(
    file_path: String,
    db: State<'_, Db>,
) -> Result<Option<f64>, String> {
    db::get_playback_position(&db.0, &file_path).await
}

/// Delete the playback history entry for a file (e.g. after watching 85%+).
#[tauri::command]
pub async fn delete_playback_position(
    file_path: String,
    db: State<'_, Db>,
) -> Result<(), String> {
    db::delete_playback_position(&db.0, &file_path).await
}

/// Get recent playback entries for "Continue Watching" UI.
#[tauri::command]
pub async fn recent_playback(
    db: State<'_, Db>,
) -> Result<Vec<PlaybackHistoryEntry>, String> {
    db::recent_playback(&db.0, 20).await
}

// ---------------------------------------------------------------------------
// Settings validation commands
// ---------------------------------------------------------------------------

/// Test AniDB credentials by attempting a login. Returns Ok with the session
/// info if successful, or Err with a descriptive error message.
#[tauri::command]
pub async fn test_anidb_credentials(
    username: String,
    password: String,
) -> Result<String, String> {
    if username.trim().is_empty() || password.trim().is_empty() {
        return Err("Username and password are required".to_string());
    }

    let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let mut client = crate::anidb::AniDBClient::new()
            .map_err(|e| format!("Failed to create AniDB client: {e}"))?;
        client
            .login(&username, &password)
            .map_err(|e| format!("AniDB login failed: {e}"))?;
        let _ = client.logout();
        Ok("AniDB credentials verified successfully".to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?;

    result
}

/// Test if an FFmpeg binary exists at the given path (or on PATH if empty).
#[tauri::command]
pub fn test_ffmpeg_path(path: String) -> Result<String, String> {
    let cmd = if path.trim().is_empty() {
        "ffmpeg".to_string()
    } else {
        path.trim().to_string()
    };

    let output = std::process::Command::new(&cmd)
        .arg("-version")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .map_err(|e| format!("FFmpeg not found at '{cmd}': {e}"))?;

    if !output.status.success() {
        return Err(format!("FFmpeg at '{cmd}' exited with non-zero status"));
    }

    let version_line = String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()
        .unwrap_or("FFmpeg (version unknown)")
        .to_string();

    Ok(version_line)
}

/// Copies text directly to the system clipboard from the backend.
/// Guaranteed to work in Tauri webviews where navigator.clipboard is unavailable.
#[tauri::command]
pub fn copy_to_clipboard(text: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args(&[
                "-NoProfile",
                "-Command",
                &format!("Set-Clipboard -Value '{}'", text.replace("'", "''")),
            ])
            .output()
            .map_err(|e| format!("Failed to copy to clipboard: {e}"))?;
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        use std::io::Write;
        use std::process::{Command, Stdio};
        let mut child = Command::new("pbcopy")
            .stdin(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn pbcopy: {e}"))?;
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
        }
        child.wait().map_err(|e| e.to_string())?;
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        use std::io::Write;
        use std::process::{Command, Stdio};
        if let Ok(mut child) = Command::new("xclip")
            .args(&["-selection", "clipboard"])
            .stdin(Stdio::piped())
            .spawn()
        {
            if let Some(mut stdin) = child.stdin.take() {
                let _ = stdin.write_all(text.as_bytes());
            }
            let _ = child.wait();
            return Ok(());
        }
        if let Ok(mut child) = Command::new("xsel")
            .args(&["--clipboard", "--input"])
            .stdin(Stdio::piped())
            .spawn()
        {
            if let Some(mut stdin) = child.stdin.take() {
                let _ = stdin.write_all(text.as_bytes());
            }
            let _ = child.wait();
            return Ok(());
        }
        Err("No clipboard utility found (xclip or xsel required)".to_string())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Unsupported platform for clipboard operations".to_string())
    }
}
