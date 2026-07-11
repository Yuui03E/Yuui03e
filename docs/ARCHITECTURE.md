# Architecture Reference

> **Last Updated:** 2026-07-11  
> This document provides a deep-dive into the Yuui architecture for developers continuing the project.

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Tauri 2 Window                      │
│  ┌─────────────────────────────────────────────────┐  │
│  │              React 19 Frontend                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │  │
│  │  │ Zustand  │  │ React    │  │ Tanstack     │  │  │
│  │  │ Store    │  │ Router 7 │  │ Query 5      │  │  │
│  │  └────┬─────┘  └──────────┘  └──────────────┘  │  │
│  │       │                                        │  │
│  │  ┌────▼─────────────────────────────────────┐  │  │
│  │  │       src/lib/api.ts (invoke bridge)     │  │  │
│  │  └────┬─────────────────────────────────────┘  │  │
│  └───────┼────────────────────────────────────────┘  │
│          │  Tauri IPC (invoke / events)              │
│  ┌───────▼────────────────────────────────────────┐  │
│  │              Rust Backend (11 modules)         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │  │
│  │  │commands │→ │   db     │  │  metadata    │  │  │
│  │  │  .rs    │  │  .rs     │  │   .rs        │  │  │
│  │  └──────────┘  └──────────┘  └──────────────┘  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │  │
│  │  │scanner  │  │ parser   │  │  anidb       │  │  │
│  │  │  .rs    │  │  .rs     │  │   .rs        │  │  │
│  │  └──────────┘  └──────────┘  └──────────────┘  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │  │
│  │  │hashing  │  │  media   │  │library_      │  │  │
│  │  │  .rs    │  │  .rs     │  │analysis.rs   │  │  │
│  │  └──────────┘  └──────────┘  └──────────────┘  │  │
│  └────────────────────────────────────────────────┘  │
│         │                                             │
│  ┌──────▼──────┐  ┌──────────┐  ┌────────────────┐    │
│  │  SQLite     │  │ FFmpeg   │  │ AniList API    │    │
│  │  yuui.db    │  │ (clips)  │  │ (GraphQL)      │    │
│  └─────────────┘  └──────────┘  └────────────────┘    │
│                   ┌──────────┐                        │
│                   │ AniDB UDP│                        │
│                   │ (ed2k)   │                        │
│                   └──────────┘                        │
└─────────────────────────────────────────────────────┘
```

---

## 2. Module Responsibilities

### `lib.rs` — Application Entry Point

The `run()` function is the single entry point. It:

1. Registers Tauri plugins (opener, dialog, fs)
2. Resolves `app_data_dir` and creates `cache/sprites/` and `cache/clips/` directories
3. Opens the SQLite pool via `db::init(db_path)`
4. Spawns the background preview worker (`media::start_preview_worker`)
5. Manages `Db(pool, cache_dir)` as Tauri state
6. Registers all 19 commands in `generate_handler![]`

### `commands.rs` — IPC Command Layer

Every function decorated with `#[tauri::command]` is an IPC endpoint callable from the frontend via `invoke("command_name", { args })`.

**Key patterns:**

- Commands that need DB access take `db: State<'_, Db>` — Tauri injects the managed state
- `sync_library` emits progress events via `app.emit("sync:progress", message)` — the frontend listens via `listen("sync:progress", callback)`
- AniDB operations use `tokio::task::spawn_blocking` to avoid blocking the async runtime
- The `sync_library` command is the **full pipeline**: scan → hash → AniDB → AniList → persist → return

### `db.rs` — SQLite Persistence Layer

**Struct:** `Db(pub SqlitePool, pub std::path::PathBuf)` — the second field is `cache_dir`

**Schema initialization** (`init()`):

1. Open SQLite pool (max 5 connections, WAL mode)
2. Execute `CREATE TABLE IF NOT EXISTS` for all 7 tables
3. Run manual migrations via `pragma_table_info` checks:
   - Add `ed2k TEXT` to `files` if missing
   - Add `analysis_json TEXT` to `series` if missing

**Write path** (`upsert_entry()`):

- Runs in a transaction
- Checks if existing match is manual (`manual = 1`) — if so, preserves media_id/confidence/matched
- Caches media JSON in `media_cache` table (with conditional update if detail=1)
- Replaces all files for the series (DELETE + INSERT)
- Ensures a `user_data` row exists

**Read path** (`all_entries()`):

- **4-query batch strategy** (Phase 3 optimization):
  1. `SELECT * FROM series ORDER BY title` → all series rows
  2. `SELECT media_id, payload FROM media_cache WHERE media_id IN (...)` → all needed media
  3. `SELECT * FROM user_data` → all user data
  4. `SELECT * FROM files ORDER BY episode` → all files
- Assembles `StoredEntry` objects in-memory using `HashMap` lookups
- Calls `library_analysis::analyze()` for each entry (pure function)

### `scanner.rs` — File Scanner

`scan_multiple(roots: &[String])` handles:

- Multiple root paths (directory or file)
- Recursive walk via `walkdir::WalkDir` (follows symlinks: false)
- Filters by video extensions: mkv, mp4, avi, m4v, mov, wmv, flv, webm, ts, m2ts
- Groups files by `normalize_title(parsed.title || parent_folder_name)`
- Returns `Vec<ScannedSeries>` sorted alphabetically by title

### `parser.rs` — Filename Parser

Extracts metadata from typical anime release filenames using regex:

- `[Group]` → release_group
- `NNNp` or `WxH` → resolution
- `x264/x265/HEVC/AV1` → codec
- `[A-F0-9]{8}` → CRC
- `SNN` or `Season NN` → season
- `- NN` or `ENN` → episode number
- Text before episode delimiter → title

`normalize_title()`: lowercase → replace non-alphanumeric with spaces → collapse whitespace. This is the grouping key used across the entire system.

### `metadata.rs` — AniList Client

**In-memory cache:**

- `Mutex<Option<HashMap<String, (Instant, Vec<AniListMedia>)>>>` keyed by normalized title
- TTL: 1 hour
- `cache_get()` returns None if stale; `cache_put()` stores with `Instant::now()`

**Rate limiting:**

- `Mutex<Option<RateLimitState>>` — process-wide
- `rate_limit_wait()` called before each request:
  - If `Retry-After` was seen → sleep until reset
  - If `remaining ≤ 5` → sleep 2s
  - Else → 500ms floor
- `update_rate_limit(resp)` called after each response:
  - Reads `X-RateLimit-Remaining` and `Retry-After` headers
  - Updates shared state

**Matching:**

- `match_series()`: For each scanned series, search AniList → pick best candidate by Jaro-Winkler score → apply adaptive threshold
- `adaptive_threshold()`: 0.90 for titles ≤12 chars, 0.85 for longer
- `fetch_detail()`: Rich detail query (characters, staff, relations, recommendations, trailer, tags, studios)

### `anidb.rs` — AniDB UDP Client

- Binds `0.0.0.0:0` (random port), 4-second read timeout
- Server: `api.anidb.net:9000`
- 2-second rate limit between requests (`wait_rate_limit()`)
- `login(user, pass)`: `AUTH user=...&pass=...&protover=4&client=yuui&clientver=1`
- `lookup_file(size, ed2k)`: `FILE size=...&ed2k=...&s=...&fmask=7f000000&amask=f0000000`
- Parses response: aid, eid, gid, group_name, episode, english/romaji title
- All calls are blocking — must be wrapped in `spawn_blocking` from async context

### `hashing.rs` — ed2k Hash

- MD4-based, chunked at 9,728,000 bytes (9500 KB)
- Single chunk → MD4 of the chunk
- Multiple chunks → MD4 of concatenated chunk hashes
- Returns hex string

### `media.rs` — Preview Generation Worker

Background loop spawned at app startup:

1. Sleep 3 seconds on initial launch
2. Loop: query files with ed2k from DB
3. For each file missing sprite/clip:
   - `ffprobe` → get duration
   - `ffmpeg` → 5×5 sprite sheet (160×90 tiles, 26 frames at `fps=1/interval`)
   - `ffmpeg` → 5s preview clip (320×180, libx264, CRF 28, from 30% of duration)
4. Sleep 500ms between files, 5s after processing, 15s when idle
5. Paths: `{cache_dir}/sprites/{ed2k}.jpg` and `{cache_dir}/clips/{ed2k}.mp4`

**Known issue:** Uses `crate::db::get_cache_dir()` instead of the `cache_dir` parameter (see TODO.md #1).

### `library_analysis.rs` — Pure Analysis

`analyze(media, files_json) → SeriesAnalysis`:

1. Extract `total_episodes` from `media.episodes`
2. Collect distinct owned episodes (sorted, deduplicated)
3. Compute missing = `(1..=total) - owned`
4. Group files by release_group → `GroupCoverage` per group
5. For each episode with multiple files → `DuplicateFile` (keep best, flag rest)
6. Track best resolution per episode → `QualityUpgrade` if below series best
7. Compute `completion = owned_distinct / total`

Quality ranking: `resolution_rank` (height pixels) → `codec_rank` (AV1=4, HEVC=3, H.264=2, VP9=2, other=1) → file size

---

## 3. Frontend Architecture

### Routing (`App.tsx`)

```
<BrowserRouter>
  <ShaderBackground />      ← Animated WebGL canvas (fixed, z-0)
  <TitleBar />               ← Custom borderless window controls
  <Sidebar />                ← Navigation links
  <AnimatePresence mode="wait">
    <Routes>
      8 routes, each wrapped in <Page> for motion transitions
    </Routes>
  </AnimatePresence>
</BrowserRouter>
```

### State Management (`store/library.ts`)

Zustand store is the **single source of truth** for library data:

```
init() → getSetting("library_folder") → getLibrary() → if empty: runSync()
                                                         ↓
                                                    syncLibrary(path)
                                                         ↓
                                                    set({ entries, status: "ready" })
```

**Sync flow:**

- `runSync()` sets up event listeners for `sync:progress` and `sync:entry-updated`
- Calls `syncLibrary(folder)` which triggers the full backend pipeline
- Returns `StoredEntry[]` which replaces the store's `entries`

### API Bridge (`lib/api.ts`)

Every function is a one-liner calling `invoke()`. No caching, no retries — the backend handles all of that. The frontend API layer is intentionally thin.

### Video Player (`VideoPlayerOverlay.tsx`)

- Opens as a full-screen overlay
- Uses Tauri's `convertFileSrc()` to load local files via the asset protocol
- Position save/restore via SQLite (throttled 5s)
- Deletes position at 85% watched
- Supports external player fallback via `play_video` command

### Component Tree

```
App
├── ShaderBackground (WebGL canvas)
├── TitleBar
│   └── TitleBarControls (min/max/close)
├── Sidebar (navigation)
└── Main content (routed)
    ├── LibraryPage → AnimeCard[] (grid with hover preview)
    ├── DetailPage → characters, staff, relations, episodes, analysis
    ├── ReviewPage → search + pin manual matches
    ├── DiscoverPage → Tanstack Query for trending anime
    ├── CalendarPage → Tanstack Query for airing schedule
    ├── ProfilePage/StatsPage → library statistics
    └── SettingsPage → folder paths, AniDB creds, FFmpeg paths, AniList token
```

---

## 4. Data Lifecycle

### First Launch

```
1. App starts → lib.rs::run()
2. SQLite pool opened, schema created, migrations run
3. Preview worker spawned (background)
4. Frontend mounts → store.init()
5. getSetting("library_folder") → empty → defaultAnimePath()
6. getLibrary() → empty (no entries yet)
7. User picks folder → chooseFolder() → runSync()
8. sync_library: scan → hash → AniDB (if creds) → AniList → persist → return
9. Store receives entries → UI renders grid
```

### Subsequent Launches

```
1. App starts → same as above
2. getLibrary() → entries from SQLite (instant, no network)
3. UI renders immediately
4. Preview worker runs in background
5. User can rescan to pick up new files
```

### Re-scan (Stable Merge)

```
1. User clicks "Rescan" → runSync()
2. Scanner walks folders, finds files
3. ed2k hashes reused from DB where (path, size) matches
4. AniDB: only queries series NOT already matched (matched=1 in DB)
5. AniList: fuzzy match all series (cache helps avoid re-requests)
6. upsert_entry: preserves manual matches + user_data
7. DELETE series not in current scan (cleanup)
8. Return updated entries
```

---

## 5. Error Handling Patterns

### Backend

- `Result<T, String>` everywhere — errors propagate as strings to the frontend
- AniList API failures: log warning, return empty Vec (graceful degradation)
- AniDB failures: return None for the file, continue processing
- FFmpeg failures: silently ignored (`let _ = ...`) — should use tracing (Phase 5)
- DB errors: return `Err(e.to_string())` — frontend catches and shows in `status: "error"`

### Frontend

- `runSync()` wraps in try/catch → `set({ status: "error", error: String(e) })`
- `fetchEntry()` catches errors and falls back to local state
- `loginAnilist()` throws if profile fetch fails (frontend shows error)
- Tanstack Query handles loading/error states for discover/calendar pages

---

## 6. Security Model

- **CSP:** Disabled (`null` in `tauri.conf.json`) — required for local file access
- **Asset protocol:** Scope allows `**/*` — any file path accessible via `convertFileSrc()`
- **AniList token:** Stored in SQLite `settings` table as plaintext (Phase 5: consider encryption)
- **AniDB credentials:** Stored in SQLite `settings` table as plaintext
- **No network egress restrictions** — backend can make any HTTP/UDP request

---

## 7. Performance Characteristics

| Operation                     | Cost             | Notes                                          |
| ----------------------------- | ---------------- | ---------------------------------------------- |
| App startup                   | <1s              | SQLite read, no network                        |
| `all_entries()`               | 4 SQL queries    | O(N) assembly in Rust, not O(N) queries        |
| AniList search                | 1 HTTP request   | Cached for 1 hour in memory                    |
| AniList detail                | 1 HTTP request   | Cached in `media_cache` table permanently      |
| ed2k hash                     | O(file size)     | Blocked via `spawn_blocking`, cached in DB     |
| AniDB lookup                  | 1 UDP round-trip | 2s rate limit between requests                 |
| Preview generation            | ~5s per file     | Background, sequential, non-blocking           |
| `library_analysis::analyze()` | O(files²)        | Pure function, fast for <1000 files per series |
