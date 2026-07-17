use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};

// ---------------------------------------------------------------------------
// Row DTOs returned to the frontend
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserData {
    pub status: Option<String>,
    pub score: Option<f64>,
    pub progress: i64,
    pub notes: Option<String>,
    pub favorite: bool,
}

impl Default for UserData {
    fn default() -> Self {
        Self {
            status: None,
            score: None,
            progress: 0,
            notes: None,
            favorite: false,
        }
    }
}

/// A fully-hydrated library entry read back out of the DB.
#[derive(Debug, Clone, Serialize)]
pub struct StoredEntry {
    pub key: String,
    pub title: String,
    pub folder: String,
    pub release_groups: Vec<String>,
    pub episode_count: i64,
    pub confidence: f64,
    pub matched: bool,
    pub manual: bool,
    pub media: Option<serde_json::Value>,
    pub user: UserData,
    pub files: Vec<serde_json::Value>,
    /// Phase 2 derived analysis (missing episodes, dupes, upgrades, coverage).
    pub analysis: crate::library_analysis::SeriesAnalysis,
}

// ---------------------------------------------------------------------------
// Write path — persist a scan+match result (idempotent upsert)
// ---------------------------------------------------------------------------

/// Persist one matched series (+ its files + media cache). Preserves any
/// existing **manual** match and existing user_data.
pub async fn upsert_entry(
    pool: &SqlitePool,
    entry: &crate::metadata::LibraryEntry,
) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    // If a manual match already exists, don't clobber it with the auto match.
    let existing: Option<(i64, Option<i64>)> =
        sqlx::query_as("SELECT manual, media_id FROM series WHERE key = ?")
            .bind(&entry.key)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

    let is_manual = matches!(existing, Some((1, _)));

    let media_id: Option<i64> = entry
        .media
        .as_ref()
        .and_then(|m| m.get("id"))
        .and_then(|v| v.as_i64());

    // Cache media JSON if present.
    if let (Some(id), Some(media)) = (media_id, entry.media.as_ref()) {
        let payload = serde_json::to_string(media).unwrap_or_else(|_| "{}".into());
        sqlx::query(
            "INSERT INTO media_cache (media_id, payload, updated_at)
             VALUES (?, ?, datetime('now'))
             ON CONFLICT(media_id) DO UPDATE SET
                payload = CASE WHEN media_cache.detail = 1 THEN media_cache.payload ELSE excluded.payload END,
                updated_at = datetime('now')",
        )
        .bind(id)
        .bind(payload)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    let groups = serde_json::to_string(&entry.scanned.release_groups)
        .unwrap_or_else(|_| "[]".into());

    if is_manual {
        // Keep the pinned media_id/confidence/matched; just refresh scan facts.
        sqlx::query(
            "UPDATE series SET
                title = ?, folder = ?, release_groups = ?, episode_count = ?,
                updated_at = datetime('now')
             WHERE key = ?",
        )
        .bind(&entry.scanned.title)
        .bind(&entry.scanned.folder)
        .bind(&groups)
        .bind(entry.scanned.episode_count as i64)
        .bind(&entry.key)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    } else {
        sqlx::query(
            "INSERT INTO series
                (key, title, folder, release_groups, episode_count,
                 media_id, confidence, matched, manual, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET
                title = excluded.title,
                folder = excluded.folder,
                release_groups = excluded.release_groups,
                episode_count = excluded.episode_count,
                media_id = excluded.media_id,
                confidence = excluded.confidence,
                matched = excluded.matched,
                updated_at = datetime('now')",
        )
        .bind(&entry.key)
        .bind(&entry.scanned.title)
        .bind(&entry.scanned.folder)
        .bind(&groups)
        .bind(entry.scanned.episode_count as i64)
        .bind(media_id)
        .bind(entry.confidence)
        .bind(entry.matched as i64)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    // Ensure a user_data row exists (defaults) without overwriting existing.
    sqlx::query(
        "INSERT INTO user_data (series_key) VALUES (?)
         ON CONFLICT(series_key) DO NOTHING",
    )
    .bind(&entry.key)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // Replace files for this series (scan is the source of truth for files).
    sqlx::query("DELETE FROM files WHERE series_key = ?")
        .bind(&entry.key)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    for f in &entry.scanned.files {
        sqlx::query(
            "INSERT INTO files
                (path, series_key, file_name, title, episode, season,
                 release_group, resolution, codec, crc, ed2k, extension, size_bytes,
                 sprite_preview, video_preview, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
             ON CONFLICT(path) DO UPDATE SET
                series_key = excluded.series_key,
                file_name = excluded.file_name,
                title = excluded.title,
                episode = excluded.episode,
                season = excluded.season,
                release_group = excluded.release_group,
                resolution = excluded.resolution,
                codec = excluded.codec,
                crc = excluded.crc,
                ed2k = excluded.ed2k,
                extension = excluded.extension,
                size_bytes = excluded.size_bytes,
                sprite_preview = excluded.sprite_preview,
                video_preview = excluded.video_preview,
                updated_at = datetime('now')",
        )
        .bind(&f.path)
        .bind(&entry.key)
        .bind(&f.file_name)
        .bind(&f.title)
        .bind(f.episode.map(|v| v as i64))
        .bind(f.season.map(|v| v as i64))
        .bind(&f.release_group)
        .bind(&f.resolution)
        .bind(&f.codec)
        .bind(&f.crc)
        .bind(&f.ed2k)
        .bind(&f.extension)
        .bind(f.size_bytes as i64)
        .bind(None::<String>)
        .bind(None::<String>)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Row→JSON helpers (shared between single- and bulk-read paths)
// ---------------------------------------------------------------------------

/// Convert one SQLite file row into the JSON value expected by the frontend,
/// reading cached preview paths from the database.
fn file_row_to_json(row: &sqlx::sqlite::SqliteRow) -> serde_json::Value {
    let sprite_preview: Option<String> = row.get("sprite_preview");
    let video_preview: Option<String> = row.get("video_preview");

    serde_json::json!({
        "path": row.get::<String, _>("path"),
        "file_name": row.get::<String, _>("file_name"),
        "title": row.get::<Option<String>, _>("title"),
        "episode": row.get::<Option<i64>, _>("episode"),
        "season": row.get::<Option<i64>, _>("season"),
        "release_group": row.get::<Option<String>, _>("release_group"),
        "resolution": row.get::<Option<String>, _>("resolution"),
        "codec": row.get::<Option<String>, _>("codec"),
        "crc": row.get::<Option<String>, _>("crc"),
        "ed2k": row.get::<Option<String>, _>("ed2k"),
        "video_preview": video_preview,
        "sprite_preview": sprite_preview,
        "extension": row.get::<String, _>("extension"),
        "size_bytes": row.get::<i64, _>("size_bytes"),
    })
}

async fn hydrate_row(pool: &SqlitePool, row: &sqlx::sqlite::SqliteRow, _cache_dir: &std::path::Path) -> StoredEntry {
    let key: String = row.get("key");
    let title: String = row.get("title");
    let folder: String = row.get("folder");
    let groups_json: String = row.get("release_groups");
    let episode_count: i64 = row.get("episode_count");
    let media_id: Option<i64> = row.get("media_id");
    let confidence: f64 = row.get("confidence");
    let matched: i64 = row.get("matched");
    let manual: i64 = row.get("manual");

    let release_groups: Vec<String> =
        serde_json::from_str(&groups_json).unwrap_or_default();

    // media JSON from cache
    let media = match media_id {
        Some(id) => sqlx::query("SELECT payload FROM media_cache WHERE media_id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten()
            .and_then(|r| {
                let p: String = r.get("payload");
                serde_json::from_str::<serde_json::Value>(&p).ok()
            }),
        None => None,
    };

    // user data
    let user = sqlx::query(
        "SELECT status, score, progress, notes, favorite FROM user_data WHERE series_key = ?",
    )
    .bind(&key)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|r| UserData {
        status: r.get("status"),
        score: r.get("score"),
        progress: r.get("progress"),
        notes: r.get("notes"),
        favorite: r.get::<i64, _>("favorite") != 0,
    })
    .unwrap_or_default();

    // files
    let files: Vec<serde_json::Value> = sqlx::query(
        "SELECT path, file_name, title, episode, season, release_group,
                resolution, codec, crc, ed2k, extension, size_bytes,
                sprite_preview, video_preview
         FROM files WHERE series_key = ? ORDER BY episode",
    )
    .bind(&key)
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|r| file_row_to_json(&r))
    .collect();

    let analysis = crate::library_analysis::analyze(&media, &files);

    StoredEntry {
        key,
        title,
        folder,
        release_groups,
        episode_count,
        confidence,
        matched: matched != 0,
        manual: manual != 0,
        media,
        user,
        files,
        analysis,
    }
}

// ---------------------------------------------------------------------------
// Read path
// ---------------------------------------------------------------------------

/// Read all stored entries, sorted by title.
///
/// **Phase 3 optimization**: batches what was previously 3N+1 queries into
/// just 4 total queries (series + media_cache + user_data + files), then
/// assembles `StoredEntry` objects in memory.
pub async fn all_entries(pool: &SqlitePool, _cache_dir: &std::path::Path) -> Result<Vec<StoredEntry>, String> {
    // 1. Fetch all series rows (1 query)
    let rows = sqlx::query(
        "SELECT key, title, folder, release_groups, episode_count,
                media_id, confidence, matched, manual
         FROM series ORDER BY title COLLATE NOCASE",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    if rows.is_empty() {
        return Ok(Vec::new());
    }

    // 2. Fetch all needed media_cache payloads in one query
    let media_ids: Vec<i64> = rows
        .iter()
        .filter_map(|r| r.get::<Option<i64>, _>("media_id"))
        .collect();

    let media_map: std::collections::HashMap<i64, serde_json::Value> = if !media_ids.is_empty() {
        let placeholders = crate::db::placeholders(media_ids.len());
        let query_str = format!(
            "SELECT media_id, payload FROM media_cache WHERE media_id IN ({placeholders})"
        );
        let mut q = sqlx::query(&query_str);
        for id in &media_ids {
            q = q.bind(id);
        }
        q.fetch_all(pool)
            .await
            .unwrap_or_default()
            .into_iter()
            .filter_map(|r| {
                let id: i64 = r.get("media_id");
                let payload: String = r.get("payload");
                serde_json::from_str(&payload).ok().map(|v| (id, v))
            })
            .collect()
    } else {
        std::collections::HashMap::new()
    };

    // 3. Fetch all user_data rows in one query
    let user_map: std::collections::HashMap<String, UserData> = sqlx::query(
        "SELECT series_key, status, score, progress, notes, favorite FROM user_data",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|r| {
        let key: String = r.get("series_key");
        let data = UserData {
            status: r.get("status"),
            score: r.get("score"),
            progress: r.get("progress"),
            notes: r.get("notes"),
            favorite: r.get::<i64, _>("favorite") != 0,
        };
        (key, data)
    })
    .collect();

    // 4. Fetch all files rows in one query, grouped by series_key
    let mut files_map: std::collections::HashMap<String, Vec<serde_json::Value>> =
        std::collections::HashMap::new();

    let file_rows = sqlx::query(
        "SELECT path, series_key, file_name, title, episode, season, release_group,
                resolution, codec, crc, ed2k, extension, size_bytes,
                sprite_preview, video_preview
         FROM files ORDER BY episode",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    for r in file_rows {
        let series_key: String = r.get("series_key");
        let file_json = file_row_to_json(&r);
        files_map.entry(series_key).or_default().push(file_json);
    }

    // 5. Assemble StoredEntry objects in memory
    let mut out = Vec::with_capacity(rows.len());
    for row in &rows {
        let key: String = row.get("key");
        let title: String = row.get("title");
        let folder: String = row.get("folder");
        let groups_json: String = row.get("release_groups");
        let episode_count: i64 = row.get("episode_count");
        let media_id: Option<i64> = row.get("media_id");
        let confidence: f64 = row.get("confidence");
        let matched: i64 = row.get("matched");
        let manual: i64 = row.get("manual");

        let release_groups: Vec<String> =
            serde_json::from_str(&groups_json).unwrap_or_default();

        let media = media_id.and_then(|id| media_map.get(&id).cloned());
        let user = user_map.get(&key).cloned().unwrap_or_default();
        let files = files_map.remove(&key).unwrap_or_default();

        let analysis = crate::library_analysis::analyze(&media, &files);

        out.push(StoredEntry {
            key,
            title,
            folder,
            release_groups,
            episode_count,
            confidence,
            matched: matched != 0,
            manual: manual != 0,
            media,
            user,
            files,
            analysis,
        });
    }

    Ok(out)
}

/// Read a single stored entry by key.
pub async fn entry_by_key(
    pool: &SqlitePool,
    key: &str,
    cache_dir: &std::path::Path,
) -> Result<Option<StoredEntry>, String> {
    let row = sqlx::query(
        "SELECT key, title, folder, release_groups, episode_count,
                media_id, confidence, matched, manual
         FROM series WHERE key = ?",
    )
    .bind(key)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    match row {
        Some(r) => Ok(Some(hydrate_row(pool, &r, cache_dir).await)),
        None => Ok(None),
    }
}
