use std::path::PathBuf;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;

const SCHEMA_VERSION: i64 = 4;

const SCHEMA_BASE: &str = r#"
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
    version         INTEGER PRIMARY KEY,
    applied_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

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

CREATE TABLE IF NOT EXISTS playback_history (
    file_path       TEXT PRIMARY KEY,
    series_key      TEXT,
    episode         INTEGER,
    title           TEXT,
    position        REAL NOT NULL DEFAULT 0,    -- seconds
    duration        REAL NOT NULL DEFAULT 0,    -- seconds
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS backdrop_cache (
    anilist_id      INTEGER PRIMARY KEY,        -- AniList media id
    urls            TEXT NOT NULL,              -- JSON array of full-res backdrop URLs
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
"#;

const MIGRATIONS: &[(&str, &str)] = &[
    ("1_initial_schema", SCHEMA_BASE),
    (
        "2_add_analysis_json_column",
        "ALTER TABLE series ADD COLUMN analysis_json TEXT",
    ),
    (
        "3_add_series_updated_at_trigger",
        "CREATE TRIGGER IF NOT EXISTS update_series_updated_at AFTER UPDATE ON series FOR EACH ROW BEGIN UPDATE series SET updated_at = datetime('now') WHERE key = NEW.key; END;",
    ),
    (
        "4_add_preview_cache_columns",
        "ALTER TABLE files ADD COLUMN sprite_preview TEXT;
         ALTER TABLE files ADD COLUMN video_preview TEXT;",
    ),
];

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

    run_migrations(&pool).await?;

    Ok(pool)
}

/// Run all pending migrations.
async fn run_migrations(pool: &SqlitePool) -> Result<(), String> {
    // Ensure schema_version table exists
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version         INTEGER PRIMARY KEY,
            applied_at      TEXT NOT NULL DEFAULT (datetime('now'))
        )"
    )
    .execute(pool)
    .await
    .map_err(|e| format!("failed to create schema_version table: {e}"))?;

    // Get current version
    let current_version: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(version), 0) FROM schema_version")
        .fetch_one(pool)
        .await
        .map_err(|e| format!("failed to get schema version: {e}"))?;

    // Run pending migrations
    for (version_num, (name, sql)) in MIGRATIONS.iter().enumerate() {
        let version = version_num as i64 + 1;
        if version <= current_version {
            continue; // already applied
        }

        // Execute migration - handle triggers that contain semicolons
        let statements = split_sql_statements(sql);
        for stmt in statements {
            let s = stmt.trim();
            if s.is_empty() {
                continue;
            }
            sqlx::query(s)
                .execute(pool)
                .await
                .map_err(|e| format!("migration {name} (v{version}) failed: {e}"))?;
        }

        // Record migration
        sqlx::query("INSERT INTO schema_version (version) VALUES (?)")
            .bind(version)
            .execute(pool)
            .await
            .map_err(|e| format!("failed to record migration {name} (v{version}): {e}"))?;
    }

    // Verify we're at the expected version
    let final_version: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(version), 0) FROM schema_version")
        .fetch_one(pool)
        .await
        .map_err(|e| format!("failed to verify schema version: {e}"))?;

    if final_version != SCHEMA_VERSION {
        return Err(format!(
            "schema version mismatch: expected {SCHEMA_VERSION}, got {final_version}"
        ));
    }

    Ok(())
}

/// Split SQL statements properly, handling triggers and other compound statements
/// that contain semicolons within their body.
fn split_sql_statements(sql: &str) -> Vec<String> {
    let mut statements = Vec::new();
    let mut current = String::new();
    
    let mut paren_depth: i32 = 0;
    let mut in_trigger = false;
    let mut in_trigger_body = false;
    let mut current_word = String::new();
    
    // Scanner states
    #[derive(Clone, Copy, PartialEq, Eq, Debug)]
    enum ScanState {
        Normal,
        SingleQuote,
        LineComment,
        BlockComment,
    }
    
    let mut state = ScanState::Normal;
    let chars: Vec<char> = sql.chars().collect();
    let mut i = 0;
    
    while i < chars.len() {
        let ch = chars[i];
        
        match state {
            ScanState::Normal => {
                // Check for comment start
                if ch == '-' && i + 1 < chars.len() && chars[i + 1] == '-' {
                    state = ScanState::LineComment;
                    current.push(ch);
                    current.push(chars[i + 1]);
                    i += 2;
                    continue;
                }
                if ch == '/' && i + 1 < chars.len() && chars[i + 1] == '*' {
                    state = ScanState::BlockComment;
                    current.push(ch);
                    current.push(chars[i + 1]);
                    i += 2;
                    continue;
                }
                // Check for string literal start
                if ch == '\'' {
                    state = ScanState::SingleQuote;
                    current.push(ch);
                    i += 1;
                    continue;
                }
                
                // Normal processing
                current.push(ch);
                
                if ch.is_alphanumeric() || ch == '_' {
                    current_word.push(ch);
                } else {
                    if !current_word.is_empty() {
                        let word_upper = current_word.to_uppercase();
                        if word_upper == "TRIGGER" {
                            // Only treat it as trigger if the current statement has CREATE
                            if current.to_uppercase().contains("CREATE") {
                                in_trigger = true;
                            }
                        } else if word_upper == "BEGIN" {
                            if in_trigger {
                                in_trigger_body = true;
                            }
                        } else if word_upper == "END" {
                            if in_trigger_body {
                                in_trigger_body = false;
                                in_trigger = false;
                            }
                        }
                        current_word.clear();
                    }
                    
                    if ch == '(' {
                        paren_depth += 1;
                    } else if ch == ')' {
                        paren_depth = paren_depth.saturating_sub(1);
                    } else if ch == ';' {
                        if paren_depth == 0 && !in_trigger && !in_trigger_body {
                            statements.push(current.trim().to_string());
                            current.clear();
                        }
                    }
                }
            }
            ScanState::SingleQuote => {
                current.push(ch);
                // In SQL, single quotes are escaped by doubling them (e.g. '')
                if ch == '\'' {
                    if i + 1 < chars.len() && chars[i + 1] == '\'' {
                        current.push(chars[i + 1]);
                        i += 2;
                        continue;
                    } else {
                        state = ScanState::Normal;
                    }
                }
            }
            ScanState::LineComment => {
                current.push(ch);
                if ch == '\n' {
                    state = ScanState::Normal;
                }
            }
            ScanState::BlockComment => {
                current.push(ch);
                if ch == '*' && i + 1 < chars.len() && chars[i + 1] == '/' {
                    current.push(chars[i + 1]);
                    state = ScanState::Normal;
                    i += 2;
                    continue;
                }
            }
        }
        
        i += 1;
    }
    
    if !current.trim().is_empty() {
        statements.push(current.trim().to_string());
    }
    
    statements
}

