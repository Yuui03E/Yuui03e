# TODO — Remaining Tasks & Future Enhancements

> **Last Updated:** 2026-07-11  
> **Phases 1–4 are complete.** See [CHANGELOG.md](./CHANGELOG.md) for completed work.

---

## Phase 5: Architecture Enhancements (Pending)

### 5.1 Add `tracing` Logging Crate

**Goal:** Replace `eprintln!()` and silent error swallowing with structured logging.

**Files to modify:**

- `src-tauri/Cargo.toml` — Add `tracing` and `tracing-subscriber` dependencies
- `src-tauri/src/lib.rs` — Initialize tracing subscriber in `run()` before Tauri builder
- `src-tauri/src/metadata.rs` — Replace `eprintln!()` on line 242 with `tracing::warn!()`
- `src-tauri/src/commands.rs` — Add `tracing::info!()` for sync progress milestones
- `src-tauri/src/media.rs` — Add `tracing::warn!()` for FFmpeg failures (currently silently ignored with `let _ =`)

**Implementation:**

```toml
# Cargo.toml — add to [dependencies]
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
```

```rust
// lib.rs — in run(), before tauri::Builder::default()
tracing_subscriber::fmt()
    .with_env_filter(tracing_subscriber::EnvFilter::from_default_env()
        .add_directive("yuui_app_lib=debug".parse().unwrap()))
    .init();
```

```rust
// metadata.rs line 242 — replace eprintln!
tracing::warn!("AniList search request failed with status {}. Returning empty.", resp.status());
```

```rust
// media.rs — replace `let _ = generate_sprite_sheet(...)` with
if let Err(e) = generate_sprite_sheet(&ffmpeg, &path, duration, &sprite_path_str) {
    tracing::warn!("Sprite sheet generation failed for {path}: {e}");
}
```

**Risks:** Logging output goes to stderr; consider adding a log file rotation for production builds.

---

### 5.2 `sqlx::migrate!` Migration System

**Goal:** Replace manual `pragma_table_info` + `ALTER TABLE` migrations with versioned SQL migration files.

**Current state:** Migrations in `db.rs` `init()` function (lines 134–161) use runtime column existence checks. This works but doesn't track migration versions and makes schema evolution harder to audit.

**Files to modify:**

- `src-tauri/Cargo.toml` — Add `sqlx` feature `"migrate"`
- Create `src-tauri/migrations/` directory
- `src-tauri/src/db.rs` — Replace manual migrations with `sqlx::migrate!()` macro

**Implementation:**

```toml
# Cargo.toml — update sqlx features
sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "sqlite", "migrate"] }
```

Create migration files:

```
src-tauri/migrations/
├── 20260101000000_initial.sql      # Full schema (all CREATE TABLE)
├── 20260102000000_add_ed2k.sql      # ALTER TABLE files ADD COLUMN ed2k TEXT
└── 20260103000000_add_analysis.sql  # ALTER TABLE series ADD COLUMN analysis_json TEXT
```

```sql
-- 20260101000000_initial.sql
-- (Copy the entire SCHEMA const from db.rs, minus PRAGMA statements)
-- Include all 7 CREATE TABLE statements + indexes

-- 20260102000000_add_ed2k.sql
ALTER TABLE files ADD COLUMN ed2k TEXT;

-- 20260103000000_add_analysis.sql
ALTER TABLE series ADD COLUMN analysis_json TEXT;
```

```rust
// db.rs — in init(), after pool creation, replace manual migrations with:
sqlx::migrate!("./migrations")
    .run(&pool)
    .await
    .map_err(|e| format!("migration failed: {e}"))?;

// Remove the SCHEMA split(';') loop and both pragma_table_info migration blocks
// Keep the PRAGMA statements as a separate query before migrate
```

**Risks:** Existing databases already have the columns; `sqlx::migrate!` tracks applied migrations in a `_sqlx_migrations` table. First run on existing DB will need all migrations marked as applied, or the initial migration should use `CREATE TABLE IF NOT EXISTS` to be idempotent.

---

### 5.3 Shared GraphQL Query Module

**Goal:** Extract GraphQL query strings into a shared module to avoid duplication and make queries easier to maintain.

**Current state:** GraphQL queries are defined as `const` strings in `metadata.rs` (`SEARCH_QUERY`, `DETAIL_QUERY`) and also inline in `store/library.ts` (Viewer query, SaveMediaListEntry mutation).

**Files to modify:**

- Create `src-tauri/src/graphql_queries.rs` (or `graphql_queries.rs` module)
- `src-tauri/src/metadata.rs` — Import from the new module
- `src/lib/graphql.ts` (new) — Frontend GraphQL query constants
- `src/store/library.ts` — Import from the new module instead of inline strings

**Implementation (Rust):**

```rust
// src-tauri/src/graphql_queries.rs
pub const SEARCH_QUERY: &str = r#"
query ($search: String) {
  Page(perPage: 5) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) { ... }
  }
}
"#;

pub const DETAIL_QUERY: &str = r#"
query ($id: Int) {
  Media(id: $id, type: ANIME) { ... }
}
"#;
```

```rust
// lib.rs — add module
mod graphql_queries;
```

```rust
// metadata.rs — replace local consts
use crate::graphql_queries::{SEARCH_QUERY, DETAIL_QUERY};
// Remove the const SEARCH_QUERY and DETAIL_QUERY definitions
```

**Implementation (Frontend):**

```typescript
// src/lib/graphql.ts
export const VIEWER_QUERY = `query { Viewer { name avatar { large } } }`;

export const SAVE_MEDIA_LIST_MUTATION = `
mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) {
  SaveMediaListEntry (mediaId: $mediaId, progress: $progress, status: $status) {
    id progress status
  }
}`;

// store/library.ts — import and use
import { VIEWER_QUERY, SAVE_MEDIA_LIST_MUTATION } from "../lib/graphql";
```

**Risks:** Low risk — pure refactor, no logic changes.

---

## Known Issues & Technical Debt

### 1. Unused `cache_dir` Parameter in `media.rs`

**File:** `src-tauri/src/media.rs:107`  
**Issue:** `start_preview_worker(pool, cache_dir)` accepts `cache_dir` but uses `crate::db::get_cache_dir()` internally instead.  
**Fix:** Either use the passed `cache_dir` parameter (preferred, since it comes from `app.path().app_data_dir()`) or rename to `_cache_dir`.

```rust
// Fix option A: Use the parameter (recommended)
// Line 123: Replace `let cache_dir = crate::db::get_cache_dir();`
// with: `let cache_dir = &cache_dir;` (use the parameter directly)

// Fix option B: Rename to suppress warning
pub fn start_preview_worker(pool: SqlitePool, _cache_dir: std::path::PathBuf) {
```

### 2. `get_cache_dir()` Fallback Path is Inconsistent

**File:** `src-tauri/src/db.rs:368`  
**Issue:** `get_cache_dir()` uses `APPDATA/com.yuui.app/cache` as a fallback, but the actual app data dir is resolved by Tauri's `app.path().app_data_dir()` in `lib.rs`. The `Db` wrapper stores the real cache path as `Db.1`.  
**Fix:** Remove `get_cache_dir()` entirely and always pass the cache dir from the `Db` wrapper. `media.rs` should use the `cache_dir` parameter (fixes issue #1 too).

### 3. Vite Bundle Size Warning

**Issue:** `npm run build` warns: chunks >500KB. Main bundle is 611KB (180KB gzipped).  
**Fix options:**

- Code-split with `React.lazy()` + dynamic imports for page-level components in `App.tsx`
- Use `build.rolldownOptions.output.codeSplitting` in `vite.config.ts`
- Increase `build.chunkSizeWarningLimit` (quick fix, not ideal)

### 4. `all_entries()` Recomputes Analysis on Every Call

**File:** `src-tauri/src/db.rs:633`  
**Issue:** `library_analysis::analyze()` is called for every entry on every `all_entries()` call. The `analysis_json` column exists but is never read/written.  
**Fix:** Either (a) cache analysis in the `analysis_json` column and only recompute when files change, or (b) leave as-is if performance is acceptable (the function is pure and fast for reasonable library sizes).

### 5. In-Memory Cache Never Explicitly Evicts

**File:** `src-tauri/src/metadata.rs`  
**Issue:** Stale cache entries are returned as misses but never removed from the `HashMap`. Over a very long session with many unique searches, the map grows unbounded.  
**Fix:** Add periodic eviction or use an LRU cache (e.g., `lru` crate) instead of `HashMap`.

---

## Future Enhancements (Not Started)

### A. Continue Watching UI

**Goal:** Add a "Continue Watching" section on the Library page using `recent_playback()`.

**Implementation:**

- `src/features/library/LibraryPage.tsx` — Add a horizontal scroll section at the top showing recent playback entries (thumbnail + progress bar + title + episode)
- Call `recentPlayback()` from `api.ts` on mount
- Click → open the file in `VideoPlayerOverlay` with position restore
- The backend command `recent_playback` already exists and returns entries <85% watched

### B. AniList Progress Auto-Sync

**Goal:** When the user watches an episode in the in-app player, auto-sync progress to their AniList account.

**Implementation:**

- `VideoPlayerOverlay.tsx` — On video end (or 85% threshold), call `syncProgressToAnilist(mediaId, episodeNumber, isCompleted)` from the Zustand store
- Only trigger if `anilistUser` is set (token exists)
- Debounce/throttle to avoid spamming the API

### C. Cloud Sync Layer

**Goal:** Use the `remote_id` columns (already in schema) to sync user data and playback history to a cloud backend.

**Implementation:**

- Backend: Add a sync command that reads all rows with `remote_id IS NULL` or `updated_at > last_sync`, pushes to a cloud API, and records `remote_id` + `last_sync` timestamp
- Frontend: Add a "Sync" button in Settings with status indicator

### D. Multi-Source Metadata (Jikan/MAL, TMDB)

**Goal:** The `id_mappings` table is designed for cross-source linking but only AniList + AniDB are implemented. Add Jikan (MAL) and TMDB resolvers.

**Implementation:**

- Create `src-tauri/src/jikan.rs` and `src-tauri/src/tmdb.rs` modules following the `metadata.rs` pattern
- Use the `id_mappings` table to resolve cross-source IDs
- Enrich detail pages with MAL scores, TMDB backdrops, etc.

### E. Export/Import Library

**Goal:** Export the SQLite database + settings to a portable archive for backup/transfer.

**Implementation:**

- Backend: `export_library()` command that copies `yuui.db` + cache to a zip file
- Backend: `import_library(zip_path)` command that restores from a zip
- Frontend: Settings page buttons for export/import
