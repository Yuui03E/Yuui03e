//! Tauri commands exposed to the React frontend.

use tauri::State;

use crate::db::{self, Db, StoredEntry, UserData};
use crate::metadata::{self, LibraryEntry};
use crate::scanner::{self, ScannedSeries};

/// Default anime library path from the plan (user can override in the UI).
#[tauri::command]
pub fn default_anime_path() -> String {
    if let Some(home) = dirs_home() {
        let p = std::path::Path::new(&home)
            .join("Documents")
            .join("anime");
        return p.to_string_lossy().to_string();
    }
    "C:\\Users\\Yuui\\Documents\\anime".to_string()
}

fn dirs_home() -> Option<String> {
    std::env::var("USERPROFILE")
        .ok()
        .or_else(|| std::env::var("HOME").ok())
}

/// Recursively scan a folder and return grouped, parsed series.
#[tauri::command]
pub fn scan_library(path: String) -> Result<Vec<ScannedSeries>, String> {
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
#[tauri::command]
pub async fn sync_library(
    path: String,
    db: State<'_, Db>,
) -> Result<Vec<StoredEntry>, String> {
    let mut series = scanner::scan(&path)?;

    // 1. Populate ed2k hashes, reusing existing ones from the DB where possible.
    let existing_files: Vec<(String, i64, Option<String>)> = sqlx::query_as(
        "SELECT path, size_bytes, ed2k FROM files WHERE ed2k IS NOT NULL"
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

    for s in &mut series {
        for f in &mut s.files {
            if let Some(h) = existing_map.get(&(f.path.clone(), f.size_bytes)) {
                f.ed2k = Some(h.clone());
            } else {
                if let Ok(h) = crate::hashing::compute_ed2k_hash(&f.path) {
                    f.ed2k = Some(h);
                }
            }
        }
    }

    // 2. Query AniDB for unmatched series if credentials are set.
    let username = db::get_setting(&db.0, "anidb_username").await.unwrap_or(None);
    let password = db::get_setting(&db.0, "anidb_password").await.unwrap_or(None);

    if let (Some(user), Some(pass)) = (username, password) {
        if !user.trim().is_empty() && !pass.trim().is_empty() {
            if let Ok(mut client) = crate::anidb::AniDBClient::new() {
                if client.login(&user, &pass).is_ok() {
                    for s in &mut series {
                        // Check if already matched in DB
                        let already_matched: bool = sqlx::query("SELECT 1 FROM series WHERE key = ? AND matched = 1")
                            .bind(crate::parser::normalize_title(&s.title))
                            .fetch_optional(&db.0)
                            .await
                            .map(|o| o.is_some())
                            .unwrap_or(false);

                        if !already_matched {
                            if let Some(first_file) = s.files.iter().find(|f| f.ed2k.is_some()) {
                                if let Ok(Some(anidb_match)) = client.lookup_file(first_file.size_bytes, first_file.ed2k.as_ref().unwrap()) {
                                    if let Some(ref title) = anidb_match.anime_title {
                                        s.title = title.clone();
                                    }
                                    
                                    // Update parsed release groups and episode data from AniDB
                                    if let Some(ref group) = anidb_match.group_name {
                                        if !s.release_groups.contains(group) {
                                            s.release_groups.push(group.clone());
                                        }
                                    }
                                    
                                    // Overwrite release group/episodes on files if AniDB returned specific info
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
                    }
                    let _ = client.logout();
                }
            }
        }
    }

    // 3. Match against AniList (fuzzy title match)
    let entries = metadata::match_series(series).await?;

    for entry in &entries {
        db::upsert_entry(&db.0, entry).await?;
    }

    db::all_entries(&db.0).await
}

/// Read the persisted library (no network). Used on startup for instant load.
#[tauri::command]
pub async fn get_library(db: State<'_, Db>) -> Result<Vec<StoredEntry>, String> {
    db::all_entries(&db.0).await
}

/// Read a single persisted entry by key, enriching it with rich AniList detail
/// (cached in `media_cache` after the first fetch).
#[tauri::command]
pub async fn get_entry(
    key: String,
    db: State<'_, Db>,
) -> Result<Option<StoredEntry>, String> {
    if key.starts_with("anilist:") {
        let id_str = key.trim_start_matches("anilist:");
        if let Ok(media_id) = id_str.parse::<i64>() {
            let detail = match db::get_detail(&db.0, media_id).await {
                Some(d) => Some(d),
                None => match metadata::fetch_detail(media_id).await {
                    Ok(d) => {
                        let _ = db::put_detail(&db.0, media_id, &d).await;
                        Some(d)
                    }
                    Err(_) => None,
                }
            };
            if let Some(d) = detail {
                let title = d.get("title")
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

    let mut entry = match db::entry_by_key(&db.0, &key).await? {
        Some(e) => e,
        None => return Ok(None),
    };

    // If we have a media id, try to attach rich detail (cache-first).
    if let Some(media_id) = entry
        .media
        .as_ref()
        .and_then(|m| m.get("id"))
        .and_then(|v| v.as_i64())
    {
        let detail = match db::get_detail(&db.0, media_id).await {
            Some(d) => Some(d),
            None => match metadata::fetch_detail(media_id).await {
                Ok(d) => {
                    let _ = db::put_detail(&db.0, media_id, &d).await;
                    if let Some(id_mal) = d.get("idMal").and_then(|v| v.as_i64()) {
                        let _ = sqlx::query(
                            "INSERT OR REPLACE INTO id_mappings (anilist_id, mal_id) VALUES (?, ?)"
                        )
                        .bind(media_id)
                        .bind(id_mal)
                        .execute(&db.0)
                        .await;
                    }
                    Some(d)
                }
                Err(_) => None,
            },
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
pub async fn get_setting(key: String, db: State<'_, Db>) -> Result<Option<String>, String> {
    db::get_setting(&db.0, &key).await
}

#[tauri::command]
pub async fn set_setting(key: String, value: String, db: State<'_, Db>) -> Result<(), String> {
    db::set_setting(&db.0, &key, &value).await
}

#[tauri::command]
pub async fn test_anidb_connection(db: State<'_, Db>) -> Result<String, String> {
    let user = db::get_setting(&db.0, "anidb_username")
        .await?
        .ok_or_else(|| "AniDB username not set".to_string())?;
    let pass = db::get_setting(&db.0, "anidb_password")
        .await?
        .ok_or_else(|| "AniDB password not set".to_string())?;

    if user.trim().is_empty() || pass.trim().is_empty() {
        return Err("AniDB credentials cannot be empty".to_string());
    }

    let mut client = crate::anidb::AniDBClient::new()?;
    client.login(&user, &pass)?;
    let _ = client.logout();

    Ok("Successfully connected to AniDB!".to_string())
}

#[tauri::command]
pub fn play_video(path: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("file path is empty".to_string());
    }

    std::process::Command::new("cmd")
        .args(&["/C", "start", "", &path])
        .spawn()
        .map_err(|e| format!("failed to launch player: {e}"))?;

    Ok(())
}

#[tauri::command]
pub async fn generate_previews_for_all(_db: State<'_, Db>) -> Result<(), String> {
    // Background worker is already running in a loop, but let's trigger a check.
    tauri::async_runtime::spawn(async move {
        // Just let it yield to verify files
        // Handled dynamically in the loop in media.rs
    });
    Ok(())
}

#[tauri::command]
pub async fn graphql_anilist(query: String, variables: serde_json::Value) -> Result<serde_json::Value, String> {
    crate::metadata::query_anilist(query, variables).await
}

#[tauri::command]
pub async fn exchange_anilist_code(
    code: String,
    client_id: String,
    client_secret: String,
    redirect_uri: String,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://anilist.co/api/v2/oauth/token")
        .json(&serde_json::json!({
            "grant_type": "authorization_code",
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "code": code,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let err_body = resp.text().await.unwrap_or_default();
        return Err(format!("AniList exchange failed: {}", err_body));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let token = json
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "No access_token in response".to_string())?;

    Ok(token.to_string())
}


