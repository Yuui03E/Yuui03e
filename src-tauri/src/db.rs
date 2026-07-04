//! SQLite persistence layer (Rust-native, via `sqlx`).
//!
//! Design goals (from the plan):
//! - Local-first, **sync-ready** schema: every user-facing row carries
//!   `updated_at` and a nullable `remote_id` so a future cloud-sync layer can
//!   reconcile without a migration.
//! - Persist scan results + AniList matches + user corrections so re-scans are
//!   stable and idempotent.
//! - Cache AniList metadata JSON keyed by media id, so detail pages and
//!   re-matches don't re-hit the API.
//!
//! Tables
//! - `series`          one row per grouped series (keyed by normalized `key`)
//! - `files`           one row per scanned file, FK → series
//! - `user_data`       watch status / score / notes / favorite, FK → series
//! - `media_cache`     cached AniList media JSON keyed by AniList id
//! - `id_mappings`     cross-source id links (AniList ↔ AniDB ↔ MAL ↔ TMDB)

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Row, SqlitePool};

/// Wrapper so we can `app.manage(Db(pool))` and pull it out of Tauri state.
pub struct Db(pub SqlitePool);

const SCHEMA: &str = r#"
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS series (
    key             TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    folder          TEXT NOT NULL,
    release_groups  TEXT NOT NULL DEFAULT '[]',   -- JSON array
    episode_count   INTEGER NOT NULL DEFAULT 0,
    media_id        INTEGER,                       -- AniList id (nullable)
    confidence      REAL NOT NULL DEFAULT 0,
    matched         INTEGER NOT NULL DEFAULT 0,    -- bool
    manual          INTEGER NOT NULL DEFAULT 0,    -- user pinned the match
    remote_id       TEXT,                          -- sync-ready
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS files (
    path            TEXT PRIMARY KEY,
    series_key      TEXT NOT NULL REFERENCES series(key) ON DELETE CASCADE,
    file_name       TEXT NOT NULL,
    title           TEXT,
    episode         INTEGER,
    season          INTEGER,
    release_group   TEXT,
    resolution      TEXT,
    codec           TEXT,
    crc             TEXT,
    ed2k            TEXT,
    extension       TEXT NOT NULL DEFAULT '',
    size_bytes      INTEGER NOT NULL DEFAULT 0,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_files_series ON files(series_key);

CREATE TABLE IF NOT EXISTS user_data (
    series_key      TEXT PRIMARY KEY REFERENCES series(key) ON DELETE CASCADE,
    status          TEXT,                          -- Watching/Completed/...
    score           REAL,
    progress        INTEGER NOT NULL DEFAULT 0,
    notes           TEXT,
    favorite        INTEGER NOT NULL DEFAULT 0,    -- bool
    remote_id       TEXT,                          -- sync-ready
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media_cache (
    media_id        INTEGER PRIMARY KEY,           -- AniList id
    payload         TEXT NOT NULL,                 -- full JSON blob
    detail          INTEGER NOT NULL DEFAULT 0,    -- 1 = rich detail fetched
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS id_mappings (
    anilist_id      INTEGER PRIMARY KEY,
    anidb_id        INTEGER,
    mal_id          INTEGER,
    tmdb_id         INTEGER,
    kitsu_id        INTEGER,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
"#;

/// Open (creating if needed) the SQLite pool and run migrations.
pub async fn init(path: PathBuf) -> Result<SqlitePool, String> {
    let opts = SqliteConnectOptions::new()
        .filename(&path)
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(opts)
        .await
        .map_err(|e| format!("open sqlite failed: {e}"))?;

    // Run schema statements one by one (sqlx executes a single statement per call).
    for stmt in SCHEMA.split(';') {
        let s = stmt.trim();
        if s.is_empty() {
            continue;
        }
        sqlx::query(s)
            .execute(&pool)
            .await
            .map_err(|e| format!("migration failed ({s}): {e}"))?;
    }

    // Run custom migration to add ed2k to files if not present.
    let needs_migration: bool = sqlx::query("SELECT COUNT(*) FROM pragma_table_info('files') WHERE name = 'ed2k'")
        .fetch_one(&pool)
        .await
        .map(|r| r.get::<i64, _>(0) == 0)
        .unwrap_or(true);

    if needs_migration {
        sqlx::query("ALTER TABLE files ADD COLUMN ed2k TEXT")
            .execute(&pool)
            .await
            .map_err(|e| format!("migration files ed2k failed: {e}"))?;
    }

    Ok(pool)
}

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
                 release_group, resolution, codec, crc, ed2k, extension, size_bytes, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Read path
// ---------------------------------------------------------------------------

fn get_cache_dir() -> std::path::PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        std::path::Path::new(&appdata).join("com.yuui.app").join("cache")
    } else {
        std::path::PathBuf::from("cache")
    }
}

async fn hydrate_row(pool: &SqlitePool, row: &sqlx::sqlite::SqliteRow) -> StoredEntry {
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

    let cache_dir = get_cache_dir();
    let sprite_dir = cache_dir.join("sprites");
    let clip_dir = cache_dir.join("clips");

    // files
    let files: Vec<serde_json::Value> = sqlx::query(
        "SELECT path, file_name, title, episode, season, release_group,
                resolution, codec, crc, ed2k, extension, size_bytes
         FROM files WHERE series_key = ? ORDER BY episode",
    )
    .bind(&key)
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|r| {
        let ed2k_str: Option<String> = r.get("ed2k");
        let mut video_preview: Option<String> = None;
        let mut sprite_preview: Option<String> = None;

        if let Some(ref ed2k) = ed2k_str {
            let sprite_path = sprite_dir.join(format!("{ed2k}.jpg"));
            let clip_path = clip_dir.join(format!("{ed2k}.mp4"));
            if sprite_path.exists() {
                sprite_preview = Some(sprite_path.to_string_lossy().to_string());
            }
            if clip_path.exists() {
                video_preview = Some(clip_path.to_string_lossy().to_string());
            }
        }

        serde_json::json!({
            "path": r.get::<String, _>("path"),
            "file_name": r.get::<String, _>("file_name"),
            "title": r.get::<Option<String>, _>("title"),
            "episode": r.get::<Option<i64>, _>("episode"),
            "season": r.get::<Option<i64>, _>("season"),
            "release_group": r.get::<Option<String>, _>("release_group"),
            "resolution": r.get::<Option<String>, _>("resolution"),
            "codec": r.get::<Option<String>, _>("codec"),
            "crc": r.get::<Option<String>, _>("crc"),
            "ed2k": ed2k_str,
            "video_preview": video_preview,
            "sprite_preview": sprite_preview,
            "extension": r.get::<String, _>("extension"),
            "size_bytes": r.get::<i64, _>("size_bytes"),
        })
    })
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

/// Read all stored entries, sorted by title.
pub async fn all_entries(pool: &SqlitePool) -> Result<Vec<StoredEntry>, String> {
    let rows = sqlx::query(
        "SELECT key, title, folder, release_groups, episode_count,
                media_id, confidence, matched, manual
         FROM series ORDER BY title COLLATE NOCASE",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut out = Vec::with_capacity(rows.len());
    for row in &rows {
        out.push(hydrate_row(pool, row).await);
    }
    Ok(out)
}

/// Read a single stored entry by key.
pub async fn entry_by_key(
    pool: &SqlitePool,
    key: &str,
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
        Some(r) => Ok(Some(hydrate_row(pool, &r).await)),
        None => Ok(None),
    }
}

// ---------------------------------------------------------------------------
// User data + manual match writes
// ---------------------------------------------------------------------------

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
