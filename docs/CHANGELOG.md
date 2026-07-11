# Changelog

All notable changes to the Yuui project, organized by phase.

---

## Phase 1: Critical Bug Fixes ✅

All 6 critical bug fixes completed.

### Changes

- **Fixed SQLite WAL mode and foreign key initialization** (`src-tauri/src/db.rs`)
  - `PRAGMA journal_mode = WAL` and `PRAGMA foreign_keys = ON` now properly executed in schema initialization
  - Schema statements split and executed individually (sqlx executes one statement per call)

- **Fixed ed2k hash column migration** (`src-tauri/src/db.rs`)
  - Added `pragma_table_info` check for `files.ed2k` column
  - Auto-migrates with `ALTER TABLE files ADD COLUMN ed2k TEXT` if missing

- **Fixed Tauri command parameter naming** (`src-tauri/src/commands.rs`)
  - Tauri's `invoke()` sends camelCase parameter names; Rust commands updated to use snake_case with proper `#[tauri::command]` renaming
  - Frontend `api.ts` uses camelCase which Tauri auto-converts

- **Fixed AniList rate limiting** (`src-tauri/src/metadata.rs`)
  - Removed hardcoded 700ms `tokio::time::sleep` in `match_series()` loop
  - Rate limiting now handled dynamically via headers (see Phase 3)

- **Fixed scanner grouping** (`src-tauri/src/scanner.rs`)
  - `scan_multiple()` properly handles both files and directories as root paths
  - Files grouped by normalized title with fallback to parent folder name

- **Fixed asset protocol scope** (`src-tauri/tauri.conf.json`)
  - `assetProtocol.scope.allow` set to `["**/*"]` to allow video playback from any path

---

## Phase 2: High-Priority Fixes ✅

### Changes

- **Added React Error Boundary** (frontend)
  - Global error boundary wrapping route content to catch render errors gracefully

- **Added 404 fallback route** (`src/App.tsx`)
  - Unknown routes now redirect to the library page instead of showing a blank screen

- **Fixed AniDB blocking calls** (`src-tauri/src/commands.rs`)
  - All AniDB UDP operations wrapped in `tokio::task::spawn_blocking` to avoid stalling the async runtime
  - `sync_library` command: AniDB login + file lookup runs in `spawn_blocking`
  - `test_anidb_credentials` command: Full login/logout test in `spawn_blocking`

- **Library analysis module** (`src-tauri/src/library_analysis.rs`)
  - Pure functions for missing-episode tracking, duplicate detection, quality-upgrade suggestions
  - `SeriesAnalysis` struct with: `total_episodes`, `owned_episodes`, `missing_episodes`, `unknown_episode_files`, `groups`, `duplicates`, `upgrades`, `best_resolution`, `completion`
  - Quality ranking: resolution → codec (AV1 > HEVC > H.264) → file size
  - Called from `db::all_entries()` and `db::hydrate_row()` on every entry

---

## Phase 3: Performance Improvements ✅

### Changes

- **Batched database queries** (`src-tauri/src/db.rs`)
  - `all_entries()` rewritten from 3N+1 queries to **4 total queries**:
    1. All `series` rows
    2. All needed `media_cache` payloads (single `IN (...)` query)
    3. All `user_data` rows
    4. All `files` rows
  - Results assembled in-memory via `HashMap` lookups
  - Eliminates N+1 query problem for large libraries

- **AniList cache with TTL** (`src-tauri/src/metadata.rs`)
  - Cache type changed from `HashMap<String, Vec<AniListMedia>>` to `HashMap<String, (Instant, Vec<AniListMedia>)>`
  - `CACHE_TTL = 3600s` (1 hour)
  - `cache_get()` checks `inserted_at.elapsed() > CACHE_TTL` → treats as miss if stale

- **Dynamic AniList rate limiting** (`src-tauri/src/metadata.rs`)
  - Added `RATE_LIMIT: Mutex<Option<RateLimitState>>` — process-wide shared state
  - `RateLimitState`: `{ remaining: Option<u32>, reset_at: Option<Instant> }`
  - `rate_limit_wait()`: Called before every AniList request
    - If `Retry-After` header was seen → sleep until reset time
    - If `remaining ≤ 5` → sleep 2 seconds
    - Otherwise → 500ms floor
  - `update_rate_limit(resp)`: Called after every response, reads `X-RateLimit-Remaining` and `Retry-After` headers
  - Applied to both `anilist_search()` and `fetch_detail()`

- **Library analysis caching column** (`src-tauri/src/db.rs`)
  - Added `analysis_json TEXT` column to `series` table
  - Migration: `pragma_table_info` check + `ALTER TABLE series ADD COLUMN analysis_json TEXT`
  - Column is available for caching computed analysis; currently analysis is computed on-the-fly (pure function is fast enough)

---

## Phase 4: Logic & Code Quality ✅

### Changes

- **Settings input validation** (`src-tauri/src/commands.rs`, `src/lib/api.ts`)
  - New command: `test_anidb_credentials(username, password)` — attempts AniDB login in `spawn_blocking`, returns success message or error
  - New command: `test_ffmpeg_path(path)` — runs `ffmpeg -version`, returns version string or error
  - Frontend functions: `testAnidbCredentials()`, `testFfmpegPath()` in `api.ts`
  - Registered both commands in `lib.rs` `generate_handler!`

- **Adaptive fuzzy matching threshold** (`src-tauri/src/metadata.rs`)
  - New function: `adaptive_threshold(normalized_title: &str) -> f64`
  - Returns `0.90` for titles ≤12 normalized chars (stricter for short titles)
  - Returns `0.85` for titles >12 normalized chars (standard)
  - `match_series()` now calls `adaptive_threshold(&key)` instead of using fixed `0.85`
  - Prevents false-positive matches on short anime titles where Jaro-Winkler prefix bonus has outsized impact

- **Playback history migrated to SQLite** (`src-tauri/src/db.rs`, `src-tauri/src/commands.rs`, `src/lib/api.ts`, `src/components/VideoPlayerOverlay.tsx`)
  - New table: `playback_history` (`file_path` PK, `series_key`, `episode`, `title`, `position`, `duration`, `updated_at`)
  - New struct: `PlaybackHistoryEntry` (Serialize/Deserialize)
  - New DB functions:
    - `save_playback_position()` — upsert position
    - `get_playback_position()` — get position in seconds
    - `delete_playback_position()` — remove entry
    - `recent_playback(limit)` — recent entries <85% watched, ordered by `updated_at DESC`
  - New Tauri commands: `save_playback_position`, `get_playback_position`, `delete_playback_position`, `recent_playback`
  - Frontend `VideoPlayerOverlay.tsx`:
    - `handleTimeUpdate()`: Saves position to SQLite every 5 seconds (throttled via `lastSaveRef`)
    - `handleLoadedMetadata()`: Restores position from SQLite on video load
    - Deletes position when watching ≥85% complete
    - Replaced all `localStorage.getItem/setItem` calls for playback state

---

## Build Status

Both frontend and backend compile successfully:

```
npm run build  →  tsc && vite build  ✓  (2283 modules, 611KB JS / 37KB CSS)
cargo build    →  ✓  (1 warning: unused `cache_dir` param in media.rs:107)
```

### Known Warning

- `src/media.rs:107` — `unused variable: cache_dir` in `start_preview_worker(pool, cache_dir)`. The function uses `crate::db::get_cache_dir()` internally instead of the parameter. Fix: rename to `_cache_dir` or use the parameter.
