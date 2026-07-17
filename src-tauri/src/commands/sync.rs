//! Sync pipeline Tauri commands.

use tauri::{State, Emitter};
use std::sync::atomic::Ordering;

use crate::{db::{self, Db, StoredEntry}, metadata, scanner, SyncControl};

/// Clears the `SyncControl::running` flag when a sync exits (on every return
/// path, including `?` early-returns), so a failed sync never wedges the guard.
struct SyncRunningGuard(std::sync::Arc<std::sync::atomic::AtomicBool>);

impl Drop for SyncRunningGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

/// Full pipeline: scan → match → persist → return hydrated library from DB.
#[tauri::command]
pub async fn sync_library(
    path: String,
    prune: bool,
    db: State<'_, Db>,
    sync_control: State<'_, SyncControl>,
    app: tauri::AppHandle,
) -> Result<Vec<StoredEntry>, String> {
    if sync_control.running.swap(true, Ordering::SeqCst) {
        return Err("A sync is already running".to_string());
    }
    let _running = SyncRunningGuard(sync_control.running.clone());

    sync_control.cancel.store(false, Ordering::Relaxed);
    sync_control.pause.store(false, Ordering::Relaxed);

    let _ = app.emit("sync:progress", "Scanning folders & files...");
    // Split on RS/Unit Separator (\u001E) to match the frontend's privateJoinPaths
    // This avoids collisions with semicolons in Windows UNC paths or Unix paths containing semicolons.
    let paths: Vec<String> = path.split('\u{1E}').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    let mut series = scanner::scan_multiple(&paths)?;

    if sync_control.cancel.load(Ordering::Relaxed) {
        let _ = app.emit("sync:progress", "Sync cancelled");
        let _ = app.emit("sync:complete", serde_json::json!({"cancelled": true}));
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
        .unwrap_or(false);

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
                    hashed_count += 1;
                    let _ = app.emit(
                        "sync:progress",
                        format!("Hashing files ({} / {})", hashed_count, total_files),
                    );
                }
            }
        }
    }

    if sync_control.cancel.load(Ordering::Relaxed) {
        let _ = app.emit("sync:progress", "Sync cancelled");
        // Emit sync:complete so the frontend listener resets isSearching.
        // The early-return below prevents reaching the happy-path emit at
        // line 288.
        let _ = app.emit("sync:complete", serde_json::json!({"cancelled": true}));
        return db::all_entries(&db.0, &db.1).await;
    }

    // 2. Query AniDB for unmatched series if credentials are set.
    let username = db::get_setting(&db.0, "anidb_username")
        .await
        .map_err(|e| format!("DB error fetching anidb_username: {e}"))?
        .filter(|s| !s.trim().is_empty());
    let password = db::get_setting(&db.0, "anidb_password")
        .await
        .map_err(|e| format!("DB error fetching anidb_password: {e}"))?
        .filter(|s| !s.trim().is_empty());

    if let (Some(user), Some(pass)) = (username, password) {
        if !user.trim().is_empty() && !pass.trim().is_empty() {
            let _ = app.emit("sync:progress", "Contacting AniDB...");
            let series_keys: Vec<String> =
                series.iter().map(|s| crate::parser::normalize_title(&s.title)).collect();
            let matched_keys: std::collections::HashSet<String> = if !series_keys.is_empty() {
                let placeholders = db::placeholders(series_keys.len());
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

            if let Ok(Some((client, matched_keys))) = anidb_result {
                let mut client_slot = Some(client);
                for s in &mut series {
                    if sync_control.cancel.load(Ordering::Relaxed) {
                        break;
                    }
                    let key = crate::parser::normalize_title(&s.title);
                    if matched_keys.contains(&key) {
                        continue;
                    }
                    let Some(idx) = s.files.iter().position(|f| f.ed2k.is_some()) else {
                        continue;
                    };
                    let size = s.files[idx].size_bytes;
                    let Some(hash) = s.files[idx].ed2k.clone() else {
                        continue;
                    };
                    let Some(mut client) = client_slot.take() else {
                        break;
                    };
                    let lookup_result = tokio::task::spawn_blocking(move || {
                        let res = client.lookup_file(size, &hash);
                        (client, res)
                    })
                    .await;

                    match lookup_result {
                        Ok((client, Ok(lookup))) => {
                            client_slot = Some(client);
                            if let Some(anidb_match) = lookup {
                                if let Some(ref title) = anidb_match.anime_title {
                                    s.title = title.clone();
                                }
                                if let Some(ref group) = anidb_match.group_name {
                                    if !s.release_groups.contains(group) {
                                        s.release_groups.push(group.clone());
                                    }
                                    for f in &mut s.files {
                                        f.release_group = Some(group.clone());
                                    }
                                }
                                if let Some(ep) = anidb_match.episode {
                                    s.files[idx].episode = Some(ep);
                                }
                            }
                        }
                        Ok((client, Err(_))) => {
                            client_slot = Some(client);
                        }
                        Err(_) => {
                            // Join error, client is lost
                            client_slot = None;
                        }
                    }
                }
                if let Some(mut client) = client_slot.take() {
                    let _ = tokio::task::spawn_blocking(move || client.logout()).await;
                }
            }
        }
    }

    if sync_control.cancel.load(Ordering::Relaxed) {
        let _ = app.emit("sync:progress", "Sync cancelled");
        let _ = app.emit("sync:complete", serde_json::json!({"cancelled": true}));
        return db::all_entries(&db.0, &db.1).await;
    }

    // 3. Match against AniList with token auth, progress events, cancel/pause support.
    let _ = app.emit("sync:progress", "Querying AniList...");

    let anilist_token = db::get_setting(&db.0, "anilist_token")
        .await
        .map_err(|e| format!("DB error fetching anilist_token: {e}"))?
        .filter(|s| !s.trim().is_empty());

    let manual_rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT s.key, m.payload
         FROM series s
         JOIN media_cache m ON s.media_id = m.media_id
         WHERE s.manual = 1"
    )
    .fetch_all(&db.0)
    .await
    .map_err(|e| format!("DB error fetching manual matches: {e}"))?;

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

    let total_entries = entries.len();
    let mut upserted_count = 0;

    for entry in &entries {
        db::upsert_entry(&db.0, entry).await?;
        upserted_count += 1;

        let _ = app.emit(
            "sync:progress",
            format!("Saving matches ({} / {})", upserted_count, total_entries),
        );

        if let Ok(Some(hydrated)) = db::entry_by_key(&db.0, &entry.key, &db.1).await {
            let _ = app.emit("sync:entry-updated", &hydrated);
        }
    }

    // 4. Remove entries no longer present in the scan.
    if prune && !sync_control.cancel.load(Ordering::Relaxed) {
        let scanned_keys: Vec<String> = entries.iter().map(|e| e.key.clone()).collect();
        if scanned_keys.is_empty() {
            // Defense-in-depth (audit #2): the inner subquery already filters
            // by user_data-with-data, AND the outer `manual = 0` excludes
            // manually-pinned series. We add the manual-pinned guard here
            // again so any future schema edit that drops the outer guard
            // cannot silently start deleting user-pinned series.
            let _ = sqlx::query(
                "DELETE FROM series
                 WHERE manual = 0
                   AND key NOT IN (
                       SELECT series_key FROM user_data
                       WHERE status IS NOT NULL OR score IS NOT NULL OR progress > 0 OR notes IS NOT NULL OR favorite = 1
                       OR series_key IN (SELECT s2.key FROM series s2 WHERE s2.manual = 1)
                   )"
            ).execute(&db.0).await;
        } else {
            // Use QueryBuilder to safely construct the IN clause without string interpolation
            let mut qb = sqlx::QueryBuilder::new(
                "DELETE FROM series
                 WHERE key NOT IN ("
            );
            qb.push_values(&scanned_keys, |mut b, k| {
                b.push_bind(k);
            });
            qb.push(") AND manual = 0
                   AND key NOT IN (
                       SELECT series_key FROM user_data
                       WHERE status IS NOT NULL OR score IS NOT NULL OR progress > 0 OR notes IS NOT NULL OR favorite = 1
                       OR series_key IN (SELECT s2.key FROM series s2 WHERE s2.manual = 1)
                   )");
            let _ = qb.build().execute(&db.0).await;
        }
    }
    // 5. Update episode_count and release_groups for all remaining series.
    let _ = db::refresh_series_aggregates(&db.0).await;

    let _ = app.emit("sync:progress", "Finalizing sync...");
    let _ = app.emit("sync:complete", serde_json::json!({"matched": entries.len()}));
    db::all_entries(&db.0, &db.1).await
}

/// Escape special LIKE pattern characters (%, _, ^) using ^ as the escape character.
fn escape_like_pattern(s: &str) -> String {
    s.replace('^', "^^")
        .replace('%', "^%")
        .replace('_', "^_")
}

#[cfg(test)]
mod tests {
    use super::escape_like_pattern;

    #[test]
    fn test_escape_like_pattern_empty_string() {
        assert_eq!(escape_like_pattern(""), "");
    }

    #[test]
    fn test_escape_like_pattern_only_special_chars() {
        assert_eq!(escape_like_pattern("^%_"), "^^^%^_");
    }

    #[test]
    fn test_escape_like_pattern_no_special_chars() {
        assert_eq!(escape_like_pattern("anime/series"), "anime/series");
    }

    #[test]
    fn test_escape_like_pattern_mixed() {
        assert_eq!(escape_like_pattern("anime%series_test^folder"), "anime^%series^_test^^folder");
    }

    #[test]
    fn test_like_pattern_building() {
        let folder = "anime/series";
        let sep = std::path::MAIN_SEPARATOR.to_string();
        let prefix = if folder.ends_with(&sep) {
            folder.to_string()
        } else {
            format!("{}{}", folder, sep)
        };

        let escaped_prefix = escape_like_pattern(&prefix);
        let pattern = format!("{}%", escaped_prefix);

        // The input folder uses forward slashes, but we append the platform separator.
        // On Windows this results in "anime/series\\%", on Unix "anime/series/%".
        #[cfg(target_os = "windows")]
        {
            assert_eq!(pattern, "anime/series\\%");
        }
        #[cfg(not(target_os = "windows"))]
        {
            assert_eq!(pattern, "anime/series/%");
        }
    }

    #[test]
    fn test_like_pattern_with_special_chars_in_folder_name() {
        let folder = "anime%series_test^folder";
        let sep = std::path::MAIN_SEPARATOR.to_string();
        let prefix = if folder.ends_with(&sep) {
            folder.to_string()
        } else {
            format!("{}{}", folder, sep)
        };

        let escaped_prefix = escape_like_pattern(&prefix);
        let pattern = format!("{}%", escaped_prefix);

        #[cfg(target_os = "windows")]
        {
            assert_eq!(pattern, "anime^%series^_test^^folder\\%");
        }
        #[cfg(not(target_os = "windows"))]
        {
            assert_eq!(pattern, "anime^%series^_test^^folder/%");
        }
    }
}

/// Remove library entries associated with an EXACT file path match.
/// Unlike remove_folder_entries, this does an exact path comparison,
/// not a prefix match. Used for individual video files added via "Add Video Files".
#[tauri::command]
#[allow(dead_code)]
pub async fn remove_file_entries(
    file_path: String,
    db: State<'_, Db>,
) -> Result<Vec<StoredEntry>, String> {
    let mut tx = db.0.begin().await.map_err(|e| e.to_string())?;

    // Delete playback history for this exact file path
    sqlx::query("DELETE FROM playback_history WHERE file_path = ?")
        .bind(&file_path)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    // Delete files with this exact path
    sqlx::query("DELETE FROM files WHERE path = ?")
        .bind(&file_path)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    // Defense-in-depth (audit #2): mirrors the guard in prune/remove_folder_entries.
    // Removes series that no longer have any files, aren't manually pinned, and have no user data.
    sqlx::query(
        "DELETE FROM series
         WHERE key NOT IN (SELECT DISTINCT series_key FROM files)
           AND manual = 0
           AND key NOT IN (
               SELECT series_key FROM user_data
               WHERE status IS NOT NULL OR score IS NOT NULL OR progress > 0 OR notes IS NOT NULL OR favorite = 1
               OR series_key IN (SELECT s2.key FROM series s2 WHERE s2.manual = 1)
           )"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    db::refresh_series_aggregates(&db.0).await?;

    db::all_entries(&db.0, &db.1).await
}

/// Read the persisted library (no network).
#[tauri::command]
pub async fn get_library(db: State<'_, Db>) -> Result<Vec<StoredEntry>, String> {
    db::all_entries(&db.0, &db.1).await
}

/// Read a single persisted entry by key, enriching with rich AniList detail.
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
                    .and_then(|t| {
                        t.get("english")
                            .filter(|v| !v.is_null())
                            .or_else(|| t.get("romaji"))
                    })
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
                    user: crate::db::UserData::default(),
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
                                "INSERT INTO id_mappings (anilist_id, mal_id, updated_at)
                                 VALUES (?, ?, datetime('now'))
                                 ON CONFLICT(anilist_id) DO UPDATE SET
                                    mal_id = excluded.mal_id,
                                    updated_at = datetime('now')",
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

/// Cancel an ongoing sync.
#[tauri::command]
pub fn cancel_sync(sync_control: State<'_, SyncControl>) -> Result<(), String> {
    sync_control.cancel.store(true, Ordering::Relaxed);
    Ok(())
}

/// Pause an ongoing sync.
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

/// Remove all library entries whose folder is under the given path.
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

    let escaped_prefix = escape_like_pattern(&prefix);
    let pattern = format!("{}%", escaped_prefix);

    sqlx::query("DELETE FROM playback_history WHERE file_path LIKE ? ESCAPE '^'")
        .bind(&pattern)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM files WHERE path LIKE ? ESCAPE '^'")
        .bind(&pattern)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    // Defense-in-depth (audit #2): mirrors the guard added to the prune
    // branch above — `manual = 0` already excludes user-pinned series, and
    // the inner subquery now ALSO excludes them so future edits can't
    // accidentally drop the protection.
    sqlx::query(
        "DELETE FROM series
         WHERE key NOT IN (SELECT DISTINCT series_key FROM files)
           AND manual = 0
           AND key NOT IN (
               SELECT series_key FROM user_data
               WHERE status IS NOT NULL OR score IS NOT NULL OR progress > 0 OR notes IS NOT NULL OR favorite = 1
               OR series_key IN (SELECT s2.key FROM series s2 WHERE s2.manual = 1)
           )"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    db::refresh_series_aggregates(&db.0).await?;

    db::all_entries(&db.0, &db.1).await
}
