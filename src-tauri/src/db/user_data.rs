use sqlx::SqlitePool;

use crate::db::entries::UserData;

/// Set user data (status, score, progress, notes, favorite) for a series.
pub async fn set_user_data(
    pool: &SqlitePool,
    key: &str,
    data: &UserData,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO user_data (series_key, status, score, progress, notes, favorite, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(series_key) DO UPDATE SET
            status = excluded.status,
            score = excluded.score,
            progress = excluded.progress,
            notes = excluded.notes,
            favorite = excluded.favorite,
            updated_at = datetime('now')",
    )
    .bind(key)
    .bind(&data.status)
    .bind(data.score)
    .bind(data.progress)
    .bind(&data.notes)
    .bind(data.favorite as i64)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Pin a manual AniList match for a series and cache its media JSON.
pub async fn set_manual_match(
    pool: &SqlitePool,
    key: &str,
    media: &serde_json::Value,
) -> Result<(), String> {
    let media_id = media
        .get("id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "media has no id".to_string())?;

    let payload = serde_json::to_string(media).unwrap_or_else(|_| "{}".into());

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO media_cache (media_id, payload, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(media_id) DO UPDATE SET
            payload = excluded.payload, updated_at = datetime('now')",
    )
    .bind(media_id)
    .bind(payload)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "UPDATE series SET
            media_id = ?, confidence = 1.0, matched = 1, manual = 1,
            updated_at = datetime('now')
         WHERE key = ?",
    )
    .bind(media_id)
    .bind(key)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}
