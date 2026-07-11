# Yuui — Product Requirements Document

> **Version:** 0.1.0  
> **Status:** Active Development (Phases 1–4 complete, Phase 5 pending)  
> **Last Updated:** 2026-07-11

---

## 1. Product Vision

Yuui is a local-first desktop anime library manager that automatically scans your video files, identifies series via AniList and AniDB, and provides rich metadata, library analysis (missing episodes, duplicates, quality upgrades), playback tracking, and a beautiful animated UI.

**Target user:** Anime collectors who maintain local video libraries and want a self-hosted, metadata-enriched manager — no cloud dependency, no streaming, purely local files.

**Key differentiators:**

- **Local-first**: All data persisted in SQLite; instant startup with no network calls
- **Hybrid matching**: AniList fuzzy title matching + AniDB ed2k hash file lookup
- **Library intelligence**: Missing-episode tracking, duplicate detection, quality-upgrade suggestions
- **In-app playback**: HTML5 video player with seek-preview, position resume, and AniList progress sync

---

## 2. Tech Stack

### Frontend

| Dependency           | Version | Purpose                                 |
| -------------------- | ------- | --------------------------------------- |
| React                | 19.1    | UI framework                            |
| React Router DOM     | 7.18    | Client-side routing                     |
| Zustand              | 5.0     | State management                        |
| Tanstack React Query | 5.101   | Async data fetching (discover/calendar) |
| Tailwind CSS         | 3.4     | Styling                                 |
| Framer Motion        | 12.42   | Page transitions / animations           |
| Lucide React         | 1.23    | Icon set                                |
| Radix UI Tooltip     | 1.2     | Accessible tooltips                     |
| Tauri APIs           | 2.x     | IPC bridge, dialog, fs, opener plugins  |
| Vite                 | 8.0     | Build tool / dev server                 |
| TypeScript           | 6.0     | Type safety                             |

### Backend (Rust)

| Crate               | Version | Purpose                        |
| ------------------- | ------- | ------------------------------ |
| tauri               | 2       | Desktop app framework          |
| tauri-plugin-opener | 2       | OS file/URL opening            |
| tauri-plugin-dialog | 2       | Native file/folder dialogs     |
| tauri-plugin-fs     | 2       | File system access             |
| sqlx                | 0.8     | SQLite (async, Tokio + rustls) |
| tokio               | 1       | Async runtime                  |
| reqwest             | 0.12    | HTTP client (AniList GraphQL)  |
| walkdir             | 2       | Recursive directory scanner    |
| regex               | 1       | Filename parsing               |
| strsim              | 0.11    | Jaro-Winkler fuzzy matching    |
| md4                 | 0.10    | ed2k hash computation          |
| serde / serde_json  | 1       | Serialization                  |
| chrono              | 0.4     | Timestamp formatting           |
| once_cell           | 1       | Lazy statics                   |

### Build

- **Frontend build:** `tsc && vite build` → `dist/`
- **Backend build:** `cargo build` (Tauri bundles frontend automatically)
- **Dev:** `npm run tauri dev` (starts Vite at `:1420` + Tauri window)
- **Production:** `npm run tauri build` (bundled `.exe` / `.msi`)

---

## 3. Architecture Overview

### Frontend Structure

```
src/
├── App.tsx                    # Routes (8 pages with AnimatePresence transitions)
├── main.tsx                   # React entry point + BrowserRouter
├── components/                # Shared UI components
│   ├── AnimeCard.tsx          # Library grid card with hover preview
│   ├── AiringCard.tsx         # Schedule/airing card
│   ├── DiscoverCard.tsx       # Discover page card
│   ├── ShaderBackground.tsx   # Animated WebGL shader background
│   ├── Sidebar.tsx            # Navigation sidebar
│   ├── TitleBar.tsx           # Custom borderless title bar
│   ├── TitleBarControls.tsx   # Window min/max/close buttons
│   └── VideoPlayerOverlay.tsx # Full-screen HTML5 video player
├── features/                  # Page-level views
│   ├── library/LibraryPage.tsx
│   ├── library/ProfilePage.tsx
│   ├── library/StatsPage.tsx
│   ├── detail/DetailPage.tsx
│   ├── review/ReviewPage.tsx
│   ├── settings/SettingsPage.tsx
│   ├── calendar/CalendarPage.tsx
│   └── discover/DiscoverPage.tsx
├── lib/
│   ├── api.ts                 # Tauri invoke bridge (19 functions)
│   ├── types.ts               # Shared TS types (StoredEntry, AniListMedia, etc.)
│   └── format.ts              # Formatting utilities
├── store/
│   └── library.ts             # Zustand store (state, sync, AniList auth)
└── styles/
    └── globals.css            # Tailwind + custom CSS
```

### Backend Structure

```
src-tauri/src/
├── main.rs              # Entry point (calls lib::run())
├── lib.rs               # Tauri Builder setup, plugin registration, command handler list
├── commands.rs          # 19 Tauri commands (the IPC API surface)
├── db.rs                # SQLite layer: schema, migrations, CRUD, playback history
├── scanner.rs           # Recursive file scanner → grouped ScannedSeries
├── parser.rs            # Filename parser (anitomy-style regex)
├── metadata.rs          # AniList GraphQL client: search, detail, rate limiting, caching
├── anidb.rs             # AniDB UDP client: login, ed2k file lookup
├── hashing.rs           # ed2k hash (MD4 chunked)
├── media.rs             # FFmpeg preview generation worker (sprite sheets + clips)
└── library_analysis.rs  # Pure analysis: missing eps, duplicates, upgrades
```

### Pages & Routes

| Route         | Component      | Purpose                                                                |
| ------------- | -------------- | ---------------------------------------------------------------------- |
| `/`           | `LibraryPage`  | Grid of all scanned series with search/sort/filter                     |
| `/anime/:key` | `DetailPage`   | Series detail: characters, staff, relations, episodes, files, analysis |
| `/review`     | `ReviewPage`   | Unmatched/low-confidence series → manual AniList search & pin          |
| `/discover`   | `DiscoverPage` | Trending/seasonal anime from AniList (GraphQL)                         |
| `/calendar`   | `CalendarPage` | Airing schedule from AniList                                           |
| `/stats`      | `ProfilePage`  | Library statistics (tab: stats)                                        |
| `/profile`    | `ProfilePage`  | User profile + AniList login                                           |
| `/settings`   | `SettingsPage` | Library folders, AniDB creds, FFmpeg paths, AniList token              |

---

## 4. Tauri Command API

All commands are registered in `lib.rs` via `generate_handler![]`.

| Command                    | Signature                                          | Description                                                         |
| -------------------------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| `default_anime_path`       | `() → String`                                      | Default library path (`Documents/anime` or empty)                   |
| `scan_library`             | `(path: String) → Vec<ScannedSeries>`              | Scan folder, parse files, group into series                         |
| `match_series`             | `(series: Vec<ScannedSeries>) → Vec<LibraryEntry>` | Match series against AniList                                        |
| `sync_library`             | `(path: String) → Vec<StoredEntry>`                | **Full pipeline**: scan → hash → AniDB → AniList → persist → return |
| `get_library`              | `() → Vec<StoredEntry>`                            | Read entire persisted library from SQLite (instant, no network)     |
| `get_entry`                | `(key: String) → Option<StoredEntry>`              | Read single entry with rich AniList detail enrichment               |
| `set_user_data`            | `(key: String, data: UserData) → ()`               | Persist watch status/score/notes/favorite                           |
| `set_manual_match`         | `(key: String, media: Value) → ()`                 | Pin a manual AniList match for a series                             |
| `search_anilist`           | `(query: String) → Vec<Value>`                     | Free-text AniList search (for Review page)                          |
| `get_setting`              | `(key: String) → Option<String>`                   | Read a setting from SQLite                                          |
| `set_setting`              | `(key: String, value: String) → ()`                | Write a setting to SQLite                                           |
| `play_video`               | `(path: String) → ()`                              | Open video in OS default player                                     |
| `graphql_anilist`          | `(query: String, variables: Value) → Value`        | Generic AniList GraphQL proxy (bypasses CORS)                       |
| `save_playback_position`   | `(entry: PlaybackHistoryEntry) → ()`               | Save/update playback position (SQLite)                              |
| `get_playback_position`    | `(file_path: String) → Option<f64>`                | Get saved position in seconds                                       |
| `delete_playback_position` | `(file_path: String) → ()`                         | Delete playback history entry                                       |
| `recent_playback`          | `() → Vec<PlaybackHistoryEntry>`                   | Recent playback entries (limit 20, <85% watched)                    |
| `test_anidb_credentials`   | `(username: String, password: String) → String`    | Test AniDB login (spawn_blocking)                                   |
| `test_ffmpeg_path`         | `(path: String) → String`                          | Test FFmpeg binary (runs `ffmpeg -version`)                         |

### Settings Keys (SQLite `settings` table)

| Key              | Type                   | Description                                              |
| ---------------- | ---------------------- | -------------------------------------------------------- |
| `library_folder` | String (`;`-separated) | One or more library root paths                           |
| `anidb_username` | String                 | AniDB UDP API username                                   |
| `anidb_password` | String                 | AniDB UDP API password                                   |
| `anilist_token`  | String                 | AniList OAuth token (for Viewer queries + progress sync) |
| `ffmpeg_path`    | String                 | Path to ffmpeg binary (or empty for PATH)                |
| `ffprobe_path`   | String                 | Path to ffprobe binary (or empty for PATH)               |
| `hash_matching`  | `"true"` / `"false"`   | Enable/disable ed2k hashing + AniDB lookup               |

---

## 5. SQLite Schema

Database file: `{app_data_dir}/yuui.db` (WAL mode, foreign keys ON)

### Tables

**`series`** — One row per grouped series
| Column | Type | Notes |
|---|---|---|
| `key` | TEXT PK | Normalized title |
| `title` | TEXT | Display title |
| `folder` | TEXT | Parent folder path |
| `release_groups` | TEXT | JSON array |
| `episode_count` | INTEGER | File count |
| `media_id` | INTEGER | AniList ID (nullable) |
| `confidence` | REAL | Match confidence 0..1 |
| `matched` | INTEGER | Boolean |
| `manual` | INTEGER | Boolean (user pinned) |
| `analysis_json` | TEXT | Cached analysis JSON (Phase 3, column added via migration) |
| `remote_id` | TEXT | Sync-ready (future cloud) |
| `created_at` / `updated_at` | TEXT | Timestamps |

**`files`** — One row per scanned file
| Column | Type | Notes |
|---|---|---|
| `path` | TEXT PK | Full file path |
| `series_key` | TEXT FK → series | |
| `file_name` | TEXT | |
| `title` | TEXT | Parsed title |
| `episode` | INTEGER | Parsed episode number |
| `season` | INTEGER | |
| `release_group` | TEXT | |
| `resolution` | TEXT | e.g. "1080p" |
| `codec` | TEXT | e.g. "x265" |
| `crc` | TEXT | 8-hex CRC |
| `ed2k` | TEXT | ed2k hash |
| `extension` | TEXT | |
| `size_bytes` | INTEGER | |
| `updated_at` | TEXT | |

**`user_data`** — Watch status/score/notes/favorite per series
| Column | Type | Notes |
|---|---|---|
| `series_key` | TEXT PK FK → series | |
| `status` | TEXT | e.g. "Watching", "Completed" |
| `score` | REAL | |
| `progress` | INTEGER | Episodes watched |
| `notes` | TEXT | |
| `favorite` | INTEGER | Boolean |
| `remote_id` | TEXT | Sync-ready |
| `updated_at` | TEXT | |

**`media_cache`** — Cached AniList JSON
| Column | Type | Notes |
|---|---|---|
| `media_id` | INTEGER PK | AniList ID |
| `payload` | TEXT | Full JSON blob |
| `detail` | INTEGER | 0 = search result, 1 = rich detail |
| `updated_at` | TEXT | |

**`id_mappings`** — Cross-source ID links
| Column | Type | Notes |
|---|---|---|
| `anilist_id` | INTEGER PK | |
| `anidb_id` | INTEGER | |
| `mal_id` | INTEGER | |
| `tmdb_id` | INTEGER | |
| `kitsu_id` | INTEGER | |
| `updated_at` | TEXT | |

**`settings`** — Key-value config
| Column | Type | Notes |
|---|---|---|
| `key` | TEXT PK | |
| `value` | TEXT | |
| `updated_at` | TEXT | |

**`playback_history`** — Playback position tracking (Phase 4)
| Column | Type | Notes |
|---|---|---|
| `file_path` | TEXT PK | |
| `series_key` | TEXT | |
| `episode` | INTEGER | |
| `title` | TEXT | |
| `position` | REAL | Seconds |
| `duration` | REAL | Seconds |
| `updated_at` | TEXT | |

### Migrations

- Schema is created via `CREATE TABLE IF NOT EXISTS` statements in `db::init()`
- Column additions use `pragma_table_info` checks + `ALTER TABLE ADD COLUMN`:
  - `files.ed2k` — ed2k hash column
  - `series.analysis_json` — cached analysis JSON (Phase 3)
- **Phase 5 TODO**: Replace manual migrations with `sqlx::migrate!` for versioned migration files

---

## 6. Data Flow

### Sync Pipeline (`sync_library` command)

```
User clicks "Scan" or "Rescan"
  │
  ├─ 1. Scanner: walkdir → parse filenames → group by normalized title
  │     (scanner.rs → parser.rs)
  │
  ├─ 2. Hashing: compute ed2k for files not yet hashed
  │     (hashing.rs, spawn_blocking, reuses cached hashes from DB)
  │
  ├─ 3. AniDB: if credentials set + hash_matching enabled
  │     Login → lookup_file(size, ed2k) → enrich title/group/episode
  │     (anidb.rs, spawn_blocking for blocking UDP)
  │
  ├─ 4. AniList: fuzzy title match (Jaro-Winkler with adaptive threshold)
  │     metadata::match_series() → anilist_search() → cache + rate limit
  │     (metadata.rs)
  │
  ├─ 5. Persist: upsert each entry to SQLite (preserve manual matches + user_data)
  │     db::upsert_entry() in a transaction
  │
  ├─ 6. Cleanup: DELETE series not in current scan
  │
  └─ 7. Return: db::all_entries() → batch-hydrated StoredEntry[] (4 queries)
        Emits "sync:progress" events throughout
```

### Detail Page Flow

```
User navigates to /anime/:key
  │
  ├─ get_entry(key) command
  │   ├─ If key starts with "anilist:" → fetch detail by ID
  │   └─ Otherwise: entry_by_key() from DB
  │       └─ If media_id exists: enrich with rich detail
  │           ├─ Check media_cache (detail=1)
  │           └─ If missing: metadata::fetch_detail(id) → cache it
  │
  └─ Frontend receives StoredEntry with full AniListMediaDetail
```

### Playback Flow

```
User clicks "Play" on an episode
  │
  ├─ VideoPlayerOverlay opens (HTML5 <video>)
  │   ├─ src = convertFileSrc(filePath) via Tauri asset protocol
  │   ├─ handleLoadedMetadata: getPlaybackPosition(filePath) → seek to saved position
  │   └─ handleTimeUpdate: throttled (5s) savePlaybackPosition() to SQLite
  │       └─ If position/duration ≥ 85%: deletePlaybackPosition()
  │
  └─ On close: final position save
```

### Preview Generation (Background Worker)

```
start_preview_worker() spawns on app launch
  │
  ├─ Loop every 5–15 seconds
  ├─ Query files with ed2k hashes from DB
  ├─ For each file missing sprite sheet or preview clip:
  │   ├─ ffprobe → get duration
  │   ├─ ffmpeg → generate 5x5 sprite sheet (160x90 tiles, 26 frames)
  │   └─ ffmpeg → generate 5s preview clip (320x180, libx264, CRF 28)
  └─ Cache to {app_data_dir}/cache/sprites/{ed2k}.jpg and /clips/{ed2k}.mp4
```

---

## 7. Frontend API Layer (`src/lib/api.ts`)

Every function is a thin wrapper around `invoke()`. Key functions:

```typescript
// Library
syncLibrary(path: string): Promise<StoredEntry[]>
getLibrary(): Promise<StoredEntry[]>
getEntry(key: string): Promise<StoredEntry | null>

// User data
setUserData(key: string, data: UserData): Promise<void>
setManualMatch(key: string, media: unknown): Promise<void>

// Search
searchAnilist(query: string): Promise<AniListMedia[]>
graphqlAnilist(query: string, variables: Record<string, any>): Promise<any>

// Settings
getSetting(key: string): Promise<string | null>
setSetting(key: string, value: string): Promise<void>

// Playback history (Phase 4)
savePlaybackPosition(entry: PlaybackHistoryEntry): Promise<void>
getPlaybackPosition(filePath: string): Promise<number | null>
deletePlaybackPosition(filePath: string): Promise<void>
recentPlayback(): Promise<PlaybackHistoryEntry[]>

// Settings validation (Phase 4)
testAnidbCredentials(username: string, password: string): Promise<string>
testFfmpegPath(path: string): Promise<string>
```

---

## 8. State Management (`src/store/library.ts`)

Zustand store with the following state and actions:

**State:** `folder`, `folders`, `entries`, `status` (idle/loading/scanning/matching/ready/error), `progress`, `error`, `activeBackdrop`, `cardSize`, `anilistUser`

**Actions:**

- `init()` — Load from SQLite instantly; only scan if empty
- `chooseFolder()` / `addPaths()` / `removePath()` — Manage library folders
- `rescan()` — Re-run sync pipeline
- `fetchEntry(key)` — Fetch single entry with detail enrichment
- `saveUserData(key, data)` — Persist user data
- `pinMatch(key, media)` — Manual match pin
- `searchAnilist(query)` — Search for manual match
- `loginAnilist(token)` / `logoutAnilist()` — AniList auth
- `syncProgressToAnilist(mediaId, progress, isCompleted)` — Sync watch progress

---

## 9. Matching Strategy

### AniList Fuzzy Matching

- **Algorithm:** Jaro-Winkler similarity (via `strsim` crate)
- **Normalization:** `normalize_title()` — lowercase, replace non-alphanumeric with spaces, collapse whitespace
- **Candidates:** Best score across romaji, english, native titles
- **Adaptive threshold** (Phase 4):
  - Titles ≤12 normalized chars: **0.90** (stricter, avoids false positives on short titles)
  - Titles >12 normalized chars: **0.85** (standard)

### AniDB Hash Matching

- **Hash:** ed2k (MD4 chunked, 9.728MB blocks)
- **Protocol:** UDP API (`api.anidb.net:9000`)
- **Flow:** Login → `FILE size=&ed2k=&fmask=7f000000&amask=f0000000` → parse response
- **Enrichment:** Updates title, release group, episode number from AniDB response
- **Rate limit:** 2-second minimum between UDP requests (enforced in `AniDBClient`)
- **Blocking:** All AniDB calls wrapped in `tokio::task::spawn_blocking`

---

## 10. Rate Limiting & Caching

### AniList Rate Limiting (Phase 3)

- **Dynamic:** Reads `X-RateLimit-Remaining` and `Retry-After` headers from each response
- **State:** `Mutex<Option<RateLimitState>>` — shared across all AniList requests
- **Behavior:**
  - If `Retry-After` header present → sleep until reset time
  - If remaining ≤5 → sleep 2 seconds
  - Otherwise → 500ms floor between requests

### AniList Caching (Phase 3)

- **In-memory:** `HashMap<String, (Instant, Vec<AniListMedia>)>` keyed by normalized title
- **TTL:** 1 hour (`CACHE_TTL = 3600s`)
- **Eviction:** Stale entries treated as cache misses (not explicitly removed)

### SQLite Media Cache

- `media_cache` table stores full AniList JSON payloads
- `detail=1` flag distinguishes rich detail from basic search results
- Detail pages check cache first, fetch from API only on miss

---

## 11. Library Analysis (`library_analysis.rs`)

Pure functions deriving insights from stored data:

- **Missing episodes:** `total_episodes` (from AniList) minus `owned_episodes`
- **Duplicate detection:** Multiple files for same episode → keep best, flag rest
- **Quality ranking:** Resolution rank (height pixels) → codec rank (AV1>HEVC>H.264) → file size
- **Upgrade suggestions:** Episodes where best copy < series-best resolution
- **Group coverage:** Per-release-group owned episodes and file counts
- **Completion:** `owned_distinct / total_episodes` (0..1)

---

## 12. Non-Functional Requirements

- **Startup:** <1s from SQLite (no network calls on load)
- **Scan:** Progress events emitted via Tauri event system (`sync:progress`)
- **Window:** Borderless, transparent, custom title bar, 1280×820 default, 960×640 min
- **Security:** CSP disabled (`null`), asset protocol allows all paths (`**/*`)
- **Platform:** Windows (primary), macOS and Linux supported via Tauri
