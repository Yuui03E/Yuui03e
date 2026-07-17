use sqlx::{Row, SqlitePool};

// ---------------------------------------------------------------------------
// Media cache helpers (used by detail-page enrichment)
// ---------------------------------------------------------------------------

/// Return cached rich-detail media JSON if we've already fetched it.
pub async fn get_detail(pool: &SqlitePool, media_id: i64) -> Option<serde_json::Value> {
    let row = sqlx::query("SELECT payload, detail FROM media_cache WHERE media_id = ?")
        .bind(media_id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()?;
    let detail: i64 = row.get("detail");
    if detail == 0 {
        return None;
    }
    let payload: String = row.get("payload");
    serde_json::from_str(&payload).ok()
}

/// Store a rich-detail media payload (marks `detail = 1`).
pub async fn put_detail(
    pool: &SqlitePool,
    media_id: i64,
    media: &serde_json::Value,
) -> Result<(), String> {
    let payload = serde_json::to_string(media).unwrap_or_else(|_| "{}".into());
    sqlx::query(
        "INSERT INTO media_cache (media_id, payload, detail, updated_at)
         VALUES (?, ?, 1, datetime('now'))
         ON CONFLICT(media_id) DO UPDATE SET
            payload = excluded.payload, detail = 1, updated_at = datetime('now')",
    )
    .bind(media_id)
    .bind(payload)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Generate a comma-separated list of `?` placeholders for dynamic IN clauses.
/// Example: `placeholders(3)` → `"?,?,?"`
pub fn placeholders(n: usize) -> String {
    (0..n).map(|_| "?").collect::<Vec<_>>().join(",")
}

/// Recompute `episode_count` and `release_groups` for every series row from
/// the current `files` table (source of truth). Call after any bulk file
/// mutation (scan, prune, folder removal).
pub async fn refresh_series_aggregates(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query(
        "UPDATE series SET
            episode_count = (SELECT COUNT(*) FROM files WHERE files.series_key = series.key),
            release_groups = COALESCE(
                (SELECT json_group_array(rg) FROM (
                    SELECT DISTINCT release_group as rg FROM files
                    WHERE files.series_key = series.key AND release_group IS NOT NULL
                )),
                '[]'
            )",
    )
    .execute(pool)
    .await
    .map_err(crate::err_string)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// General settings helpers
// ---------------------------------------------------------------------------

pub async fn get_setting(pool: &SqlitePool, key: &str) -> Result<Option<String>, String> {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(row.map(|r| r.0))
}

pub async fn set_setting(pool: &SqlitePool, key: &str, value: &str) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO settings (key, value, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = datetime('now')",
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// TMDB backdrop cache + id mapping (used by the detail-page background)
// ---------------------------------------------------------------------------

/// Return the cached AniList → TMDB id link, if we've resolved it before.
pub async fn get_tmdb_id(pool: &SqlitePool, anilist_id: i64) -> Option<i64> {
    sqlx::query("SELECT tmdb_id FROM id_mappings WHERE anilist_id = ?")
        .bind(anilist_id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|r| r.get::<Option<i64>, _>("tmdb_id"))
}

/// Persist the resolved AniList → TMDB id link (upsert without clobbering
/// other id columns for the same AniList id).
pub async fn put_tmdb_id(pool: &SqlitePool, anilist_id: i64, tmdb_id: i64) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO id_mappings (anilist_id, tmdb_id, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(anilist_id) DO UPDATE SET
            tmdb_id = excluded.tmdb_id,
            updated_at = datetime('now')",
    )
    .bind(anilist_id)
    .bind(tmdb_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Return the cached backdrop URL list for an AniList id, if present.
pub async fn get_backdrops(pool: &SqlitePool, anilist_id: i64) -> Option<Vec<String>> {
    let row = sqlx::query("SELECT urls FROM backdrop_cache WHERE anilist_id = ?")
        .bind(anilist_id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()?;
    let urls: String = row.get("urls");
    serde_json::from_str(&urls).ok()
}

/// Store the resolved backdrop URL list for an AniList id. An empty list is
/// still cached so we don't re-hit TMDB every visit for titles with no match.
pub async fn put_backdrops(
    pool: &SqlitePool,
    anilist_id: i64,
    urls: &[String],
) -> Result<(), String> {
    let payload = serde_json::to_string(urls).unwrap_or_else(|_| "[]".into());
    sqlx::query(
        "INSERT INTO backdrop_cache (anilist_id, urls, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(anilist_id) DO UPDATE SET
            urls = excluded.urls, updated_at = datetime('now')",
    )
    .bind(anilist_id)
    .bind(payload)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}
