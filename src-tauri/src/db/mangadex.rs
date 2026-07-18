//! MangaDex persistence (favorites + reading history).

use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

/// A library entry (a favorited/tracked manga).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryEntry {
    pub manga_id: String,
    pub added_at: i64,
    pub is_favorite: bool,
    pub title: Option<String>,
    pub cover_url: Option<String>,
    pub content_rating: Option<String>,
}

/// A reading-progress row for a single chapter.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressRow {
    pub chapter_id: String,
    pub manga_id: String,
    pub chapter_number: Option<String>,
    pub read_at: i64,
    pub progress: f64,
}

/// A history row (most recently read chapters across all manga).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryRow {
    pub chapter_id: String,
    pub manga_id: String,
    pub chapter_number: Option<String>,
    pub read_at: i64,
    pub progress: f64,
    pub title: Option<String>,
    pub cover_url: Option<String>,
}

// ---------------------------------------------------------------------------
// Payload for add_favorite
// ---------------------------------------------------------------------------

/// Metadata payload sent by the frontend when adding a favorite so we can
/// render the Library grid without re-fetching every manga from MangaDex.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FavoritePayload {
    pub is_favorite: bool,
    pub title: Option<String>,
    pub cover_url: Option<String>,
    pub content_rating: Option<String>,
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

/// Upsert a library/favorite row. If the manga already exists we update the
/// favorite flag and cached metadata; otherwise we insert a new row.
pub async fn add_favorite(
    pool: &SqlitePool,
    manga_id: &str,
    payload: &FavoritePayload,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO manga_library
            (manga_id, added_at, is_favorite, title, cover_url, content_rating)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(manga_id) DO UPDATE SET
            is_favorite    = excluded.is_favorite,
            title          = excluded.title,
            cover_url      = excluded.cover_url,
            content_rating = excluded.content_rating",
    )
    .bind(manga_id)
    .bind(chrono::Utc::now().timestamp())
    .bind(payload.is_favorite as i32)
    .bind(&payload.title)
    .bind(&payload.cover_url)
    .bind(&payload.content_rating)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Remove a manga from the library (unfavorite).
pub async fn remove_favorite(pool: &SqlitePool, manga_id: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM manga_library WHERE manga_id = ?")
        .bind(manga_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Whether a manga is currently favorited.
pub async fn is_favorite(pool: &SqlitePool, manga_id: &str) -> Result<bool, String> {
    let row: Option<(i32,)> =
        sqlx::query_as("SELECT is_favorite FROM manga_library WHERE manga_id = ?")
            .bind(manga_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?;
    Ok(row.map(|r| r.0 != 0).unwrap_or(false))
}

/// List all library entries (favorites first, then by added_at desc).
pub async fn list_favorites(pool: &SqlitePool) -> Result<Vec<LibraryEntry>, String> {
    let rows = sqlx::query(
        "SELECT manga_id, added_at, is_favorite, title, cover_url, content_rating
         FROM manga_library
         ORDER BY is_favorite DESC, added_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let entries = rows
        .into_iter()
        .map(|r| LibraryEntry {
            manga_id: r.get("manga_id"),
            added_at: r.get("added_at"),
            is_favorite: r.get::<i32, _>("is_favorite") != 0,
            title: r.get("title"),
            cover_url: r.get("cover_url"),
            content_rating: r.get("content_rating"),
        })
        .collect();
    Ok(entries)
}

// ---------------------------------------------------------------------------
// Reading progress + history
// ---------------------------------------------------------------------------

/// Save (upsert) reading progress for a chapter.
pub async fn save_reading_progress(
    pool: &SqlitePool,
    chapter_id: &str,
    manga_id: &str,
    chapter_number: Option<&str>,
    progress: f64,
) -> Result<(), String> {
    // Ensure a library row exists so the FK isn't violated. The row will be a
    // non-favorite placeholder; if the user later favorites the manga the
    // `add_favorite` upsert will flip the flag.
    sqlx::query(
        "INSERT OR IGNORE INTO manga_library (manga_id, added_at, is_favorite)
         VALUES (?, ?, 0)",
    )
    .bind(manga_id)
    .bind(chrono::Utc::now().timestamp())
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO manga_reading_history
            (chapter_id, manga_id, chapter_number, read_at, progress)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(chapter_id) DO UPDATE SET
            progress       = excluded.progress,
            read_at        = excluded.read_at",
    )
    .bind(chapter_id)
    .bind(manga_id)
    .bind(chapter_number)
    .bind(chrono::Utc::now().timestamp())
    .bind(progress)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Get the most recent reading-progress row for a manga (across all its
/// chapters), or `None` if the manga has never been read.
pub async fn get_reading_progress(
    pool: &SqlitePool,
    manga_id: &str,
) -> Result<Option<ProgressRow>, String> {
    let row = sqlx::query(
        "SELECT chapter_id, manga_id, chapter_number, read_at, progress
         FROM manga_reading_history
         WHERE manga_id = ?
         ORDER BY read_at DESC
         LIMIT 1",
    )
    .bind(manga_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(row.map(|r| ProgressRow {
        chapter_id: r.get("chapter_id"),
        manga_id: r.get("manga_id"),
        chapter_number: r.get("chapter_number"),
        read_at: r.get("read_at"),
        progress: r.get("progress"),
    }))
}

/// List recent reading-history rows joined with library metadata for display.
pub async fn list_history(
    pool: &SqlitePool,
    limit: u32,
) -> Result<Vec<HistoryRow>, String> {
    let rows = sqlx::query(
        "SELECT h.chapter_id, h.manga_id, h.chapter_number, h.read_at, h.progress,
                l.title, l.cover_url
         FROM manga_reading_history h
         LEFT JOIN manga_library l ON l.manga_id = h.manga_id
         ORDER BY h.read_at DESC
         LIMIT ?",
    )
    .bind(limit as i64)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let entries = rows
        .into_iter()
        .map(|r| HistoryRow {
            chapter_id: r.get("chapter_id"),
            manga_id: r.get("manga_id"),
            chapter_number: r.get("chapter_number"),
            read_at: r.get("read_at"),
            progress: r.get("progress"),
            title: r.get("title"),
            cover_url: r.get("cover_url"),
        })
        .collect();
    Ok(entries)
}

/// Clear all reading history.
pub async fn clear_history(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query("DELETE FROM manga_reading_history")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}