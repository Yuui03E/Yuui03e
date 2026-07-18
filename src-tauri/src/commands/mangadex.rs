//! MangaDex API proxy commands + persistence (favorites / reading history).
//!
//! MangaDex's API does not send `Access-Control-Allow-Origin` headers, so
//! browser `fetch()` from the Tauri WebView would be blocked. We proxy all
//! requests through the Rust backend (which has no CORS restrictions).

use tauri::State;
use crate::http_client;
use crate::db::{self, Db, FavoritePayload, LibraryEntry, ProgressRow, HistoryRow};
use serde_json::Value;

/// Proxy a GET request to MangaDex API and return the JSON body.
#[tauri::command]
pub async fn mangadex_get(path: String) -> Result<Value, String> {
    let url = if path.starts_with("https://") {
        path
    } else {
        format!("https://api.mangadex.org{}", path)
    };

    let resp = http_client()
        .get(&url)
        .header("User-Agent", "Yuui/2.0")
        .send()
        .await
        .map_err(|e| format!("MangaDex request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!(
            "MangaDex returned HTTP {}",
            resp.status().as_u16()
        ));
    }

    resp.json::<Value>()
        .await
        .map_err(|e| format!("MangaDex JSON parse failed: {e}"))
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

/// Add or update a favorite/library entry. `payload` carries cached metadata
/// so the frontend Library grid can render without re-fetching from MangaDex.
#[tauri::command]
pub async fn mangadex_add_favorite(
    manga_id: String,
    payload: FavoritePayload,
    db: State<'_, Db>,
) -> Result<(), String> {
    db::add_favorite(&db.0, &manga_id, &payload).await
}

/// Remove a manga from the library (unfavorite).
#[tauri::command]
pub async fn mangadex_remove_favorite(
    manga_id: String,
    db: State<'_, Db>,
) -> Result<(), String> {
    db::remove_favorite(&db.0, &manga_id).await
}

/// Whether a manga is currently favorited.
#[tauri::command]
pub async fn mangadex_is_favorite(
    manga_id: String,
    db: State<'_, Db>,
) -> Result<bool, String> {
    db::is_favorite(&db.0, &manga_id).await
}

/// List all library entries (favorites first, then by added_at desc).
#[tauri::command]
pub async fn mangadex_list_favorites(
    db: State<'_, Db>,
) -> Result<Vec<LibraryEntry>, String> {
    db::list_favorites(&db.0).await
}

// ---------------------------------------------------------------------------
// Reading progress + history
// ---------------------------------------------------------------------------

/// Save (upsert) reading progress for a chapter. `progress` is 0..1
/// (fraction of pages read).
#[tauri::command]
pub async fn mangadex_save_reading_progress(
    chapter_id: String,
    manga_id: String,
    chapter_number: Option<String>,
    progress: f64,
    db: State<'_, Db>,
) -> Result<(), String> {
    db::save_reading_progress(&db.0, &chapter_id, &manga_id, chapter_number.as_deref(), progress).await
}

/// Get the most recent reading-progress row for a manga, or `None`.
#[tauri::command]
pub async fn mangadex_get_reading_progress(
    manga_id: String,
    db: State<'_, Db>,
) -> Result<Option<ProgressRow>, String> {
    db::get_reading_progress(&db.0, &manga_id).await
}

/// List recent reading-history rows (joined with library metadata).
#[tauri::command]
pub async fn mangadex_list_history(
    limit: Option<u32>,
    db: State<'_, Db>,
) -> Result<Vec<HistoryRow>, String> {
    db::list_history(&db.0, limit.unwrap_or(50)).await
}

/// Clear all reading history.
#[tauri::command]
pub async fn mangadex_clear_history(db: State<'_, Db>) -> Result<(), String> {
    db::clear_manga_history(&db.0).await
}