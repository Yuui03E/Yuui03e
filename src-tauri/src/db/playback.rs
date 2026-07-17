use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};

// ---------------------------------------------------------------------------
// Playback history (Phase 4 — migrate from localStorage to SQLite)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackHistoryEntry {
    pub file_path: String,
    pub series_key: Option<String>,
    pub episode: Option<i64>,
    pub title: Option<String>,
    pub position: f64,
    pub duration: f64,
}

/// Upsert a playback position row. Called frequently as the video plays.
pub async fn save_playback_position(
    pool: &SqlitePool,
    entry: &PlaybackHistoryEntry,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO playback_history
            (file_path, series_key, episode, title, position, duration, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(file_path) DO UPDATE SET
            position = excluded.position,
            duration = excluded.duration,
            updated_at = datetime('now')",
    )
    .bind(&entry.file_path)
    .bind(&entry.series_key)
    .bind(entry.episode)
    .bind(&entry.title)
    .bind(entry.position)
    .bind(entry.duration)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Get the saved position (in seconds) for a file, if any.
pub async fn get_playback_position(
    pool: &SqlitePool,
    file_path: &str,
) -> Result<Option<f64>, String> {
    let row: Option<(f64,)> =
        sqlx::query_as("SELECT position FROM playback_history WHERE file_path = ?")
            .bind(file_path)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?;
    Ok(row.map(|r| r.0))
}

/// Remove a playback history row (e.g. when episode is 85% watched).
pub async fn delete_playback_position(
    pool: &SqlitePool,
    file_path: &str,
) -> Result<(), String> {
    sqlx::query("DELETE FROM playback_history WHERE file_path = ?")
        .bind(file_path)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Get recent playback history (for "Continue Watching" UI).
pub async fn recent_playback(
    pool: &SqlitePool,
    limit: u32,
) -> Result<Vec<PlaybackHistoryEntry>, String> {
    let rows = sqlx::query(
        "SELECT file_path, series_key, episode, title, position, duration
         FROM playback_history
         -- duration <= 0 means unknown length: keep the row (the old bare
         -- division yielded NULL and silently dropped it from the list).
         WHERE duration <= 0 OR position / duration < 0.85
         ORDER BY datetime(updated_at) DESC
         LIMIT ?",
    )
    .bind(limit as i64)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let entries = rows
        .into_iter()
        .map(|r| PlaybackHistoryEntry {
            file_path: r.get("file_path"),
            series_key: r.get("series_key"),
            episode: r.get("episode"),
            title: r.get("title"),
            position: r.get("position"),
            duration: r.get("duration"),
        })
        .collect();

    Ok(entries)
}
