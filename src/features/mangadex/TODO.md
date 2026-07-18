# MangaDex Integration — TODO

Progress tracker for the MangaDex integration in Yuui. Update this file after each phase; mark items `- [x]` when complete and add new sub-tasks as they're discovered.

---

## Completed ✓

- [x] **Core browse / search / detail / reader** — manga search, trending grid, manga detail page, paged chapter reader with arrow-key + click-zone navigation, framer-motion page transitions.
- [x] **Rust proxy** — `mangadex_get` command in `src-tauri/src/commands/mangadex.rs` bypasses CORS; frontend calls via `invoke("mangadex_get", { path })`.
- [x] **Array-query-param fix** — `buildQuery()` in `api.ts` emits `key[]=v&key[]=v2` form (MangaDex rejects comma-joined strings with HTTP 400). Verified with curl/node fetch.
- [x] **API research for homepage parity** — confirmed endpoints (see "API Reference" below):
  - Popular: `GET /manga?order[followedCount]=desc`
  - Recently added: `GET /manga?order[createdAt]=desc`
  - Top rated: `GET /manga?order[rating]=desc`
  - Latest chapter updates: `GET /chapter?order[readableAt]=desc&translatedLanguage[]=en&contentRating[]=safe&contentRating[]=suggestive&includes[]=scanlation_group` → then bulk-fetch manga via `/manga?ids[]=...`
  - Tags: `GET /manga/tag` → 77 tags, 4 groups (`format`, `genre`, `theme`, `content`)
  - Filter params on `/manga`: `includedTags[]`, `excludedTags[]`, `contentRating[]`, `originalLanguage[]`, `publicationDemographic[]`, `status[]`

---

## Phase A — Persistence (DB schema + Rust commands)

Goal: store favorites, reading progress, and history locally so they survive restarts.

- [ ] **A.1 DB schema** — Add tables to `src-tauri/src/db.rs` (search for `CREATE TABLE` to find the migration code):
  - `manga_library` — `(manga_id TEXT PK, added_at INTEGER, is_favorite INTEGER DEFAULT 0, title TEXT, cover_url TEXT, content_rating TEXT)`
  - `manga_reading_history` — `(chapter_id TEXT PK, manga_id TEXT, chapter_number TEXT, read_at INTEGER, progress REAL, FOREIGN KEY(manga_id))`
  - (Maybe) `manga_settings` key/value table if not already covered by the existing settings system.
- [ ] **A.2 Rust commands** — Add to `src-tauri/src/commands/mangadex.rs` and register in `lib.rs` `invoke_handler!`:
  - `mangadex_add_favorite(manga_id, payload)`
  - `mangadex_remove_favorite(manga_id)`
  - `mangadex_list_favorites() -> Vec<LibraryEntry>`
  - `mangadex_save_reading_progress(chapter_id, manga_id, chapter_number, progress)`
  - `mangadex_get_reading_progress(manga_id) -> Option<ProgressRow>`
  - `mangadex_list_history(limit) -> Vec<HistoryRow>`
  - `mangadex_clear_history()`
- [ ] **A.3 Frontend API wrappers** — In `api.ts`, add typed wrappers that `invoke()` each new command.
- [ ] **A.4 Build + verify** — `cargo build` succeeds; no compile errors in `lib.rs` registration.

---

## Phase B — Library / History / Continue Reading UI

Goal: surface the Phase A persistence in the app.

- [ ] **B.1 Tabs on MangaDex page** — Add Browse / Library / History tabs to `MangadexPage.tsx` (or a parent route). Library shows favorites grid; History shows recently-read chapters with "Continue Reading" button.
- [ ] **B.2 Favorite button** — Add heart toggle to `MangaCard.tsx` and `MangaDetail.tsx`; calls `mangadex_add_favorite` / `mangadex_remove_favorite`. Reflect favorited state from DB on render.
- [ ] **B.3 Continue Reading** — On `MangaDetail.tsx`, show a "Continue Reading" button when `mangadex_get_reading_progress` returns a row; button opens the next unread chapter. On the landing/homepage, add a "Continue Reading" row showing in-progress manga.
- [ ] **B.4 Reading-progress writes** — In `ChapterReader.tsx`, call `mangadex_save_reading_progress` on chapter open and on page change (debounced).
- [ ] **B.5 Empty states** — Friendly empty-state messages for Library/History when DB is empty.
- [ ] **B.6 Build + verify.**

---

## Phase C — Reader polish

Goal: make the reader feel like a real manga app, not a minimal viewer.

- [ ] **C.1 Scroll mode** — Add vertical-continuous scroll mode alongside the existing paged mode; mode toggle (paged / scroll) persisted to settings.
- [ ] **C.2 Fit mode** — Fit-to-width / fit-to-height / original-size options; persisted.
- [ ] **C.3 Seek bar** — Bottom seek bar showing current page / total pages; click to jump, drag to scrub.
- [ ] **C.4 Next/prev chapter** — On reaching the last page (or pressing a "next" button), load the next chapter from the manga's feed; same for prev. Pre-fetch next chapter's page list while reading.
- [ ] **C.5 Preload** — Preload adjacent page images in paged mode (current ± 1). In scroll mode, lazy-load images as they scroll into view.
- [ ] **C.6 Keyboard shortcuts** — Left/Right = prev/next page, Up/Down = scroll in scroll mode, `M` = toggle mode, `F` = cycle fit, `N`/`P` = next/prev chapter.
- [ ] **C.7 Build + verify.**

---

## Phase D — Discover / Homepage parity with mangadex.net

Goal: replicate the sections visible on the MangaDex homepage, styled to fit Yuui.

- [ ] **D.1 Extend `api.ts`**:
  - Add `getRecentlyAddedManga(limit)`, `getTopRatedManga(limit)`, `getTags()` (cached), `browseManga(filters)` generic builder.
  - Add `getLatestChapterUpdates(limit)` → returns `ChapterUpdateInfo[]` (chapter info + deduped manga map; one extra `/manga?ids[]=...` call).
  - Extend `MangaInfo` with `contentRating`, `availableTranslatedLanguages`, `originalLanguage`, `publicationDemographic`, and tag IDs (not just names).
  - Add `ChapterUpdateInfo` type.
  - Validate `ids[]` bracket-array param works the same as other arrays.
- [ ] **D.2 Settings/state** — In `mangadexSlice.ts` add persisted settings:
  - `mangadexContentRating` (default `["safe","suggestive"]`)
  - `mangadexTranslatedLanguage` (default `"en"`)
  - `mangadexOriginalLanguageFilter` (default none)
  - `mangadexReaderMode` / `mangadexReaderFit` (used by Phase C, but persist keys here)
  - Settings UI in `MangadexSection.tsx`.
- [ ] **D.3 Redesign `MangadexPage.tsx`** into a multi-section homepage:
  - Top: search bar + language + content-rating dropdown filters (bound to persisted settings).
  - **Featured row**: horizontal carousel of top-popular covers with title overlay.
  - **Latest Updates row**: `LatestUpdateCard` (cover thumb + chapter number + scanlation group + relative time).
  - **Popular New Titles row**: horizontal scroll of `MangaCard`.
  - **Top Rated row**: horizontal scroll of `MangaCard`.
  - **Recently Added row**: horizontal scroll of `MangaCard`.
  - **Tag filter panel**: collapsible sidebar/modal with chips grouped by tag group (`format`/`genre`/`theme`/`content`); selecting filters re-queries via `browseManga()`.
  - Skeleton loaders + per-row error states.
  - When search or filters are active, switch to full results grid (current behavior) instead of homepage rows.
- [ ] **D.4 `MangaCard.tsx` variants** — Add compact variant for horizontal rails + a `LatestUpdateCard` component. Add favorite heart button (visual-only; wired to DB in Phase B).
- [ ] **D.5 Build + verify** — `npm run build` (or `cargo build`) succeeds; homepage renders all rows; filters and search work.

---

## Open questions (resolve before/when starting each phase)

- **Content-rating default** — Safe+Suggestive (MangaDex anonymous default) or include everything? Plan: default Safe+Suggestive + expose toggles.
- **Featured carousel source** — No public "featured" endpoint; use top-N by `followedCount`. OK?
- **Latest-chapter extra round-trip** — Dedupe chapter→manga IDs and fetch in one `/manga?ids[]=...` call. Accept slight cold-load latency.
- **Scope of Phase D** — Should persistent favorites/history (Phase A/B) be folded into Phase D's favorite heart UI, or stay separate? Current plan: separate phases.

---

## API Reference (verified via live probe 2026-07-18)

### Manga list feeds

| Feed                   | Endpoint                                                                                                                                  | Notes                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Trending / Popular     | `GET /manga?order[followedCount]=desc&includes[]=cover_art`                                                                               | already implemented as `getTrendingManga()`                                |
| Recently added manga   | `GET /manga?order[createdAt]=desc&includes[]=cover_art`                                                                                   |                                                                            |
| Top rated              | `GET /manga?order[rating]=desc&includes[]=cover_art`                                                                                      |                                                                            |
| Latest chapter updates | `GET /chapter?order[readableAt]=desc&translatedLanguage[]=en&contentRating[]=safe&contentRating[]=suggestive&includes[]=scanlation_group` | each chapter has a `manga` relationship; bulk-fetch via `/manga?ids[]=...` |
| Search                 | `GET /manga?title=<q>&order[relevance]=desc`                                                                                              | already implemented                                                        |

### Filtering / browsing

- `GET /manga` params: `includedTags[]`, `excludedTags[]`, `contentRating[]`, `originalLanguage[]`, `publicationDemographic[]`, `status[]`, `translatedLanguage[]`, `order[<field>]`, `includes[]=cover_art`
- Valid manga `order` fields: `createdAt`, `updatedAt`, `followedCount`, `relevance`, `year`, `rating` (NOT `latestChapter` — returns 400 "property latestChapter is not defined").
- Valid chapter `order` fields: `createdAt`, `updatedAt`, `publishAt`, `readableAt`, `chapter`, `volume`.

### Tags

- `GET /manga/tag` → `{ result: "ok", data: [...] }`, 77 tags.
- Each tag: `{ id, type: "tag", attributes: { name: {en,...}, group: "format"|"genre"|"theme"|"content", ... } }`.
- Endpoint `/tag` (without `/manga`) returns **error** — must use `/manga/tag`.

### Covers / images

- `https://uploads.mangadex.org/covers/{mangaId}/{fileName}.512.jpg` (also `.256.jpg`, `.jpg` for full).
- at-home CDN for chapter pages: `https://api.mangadex.org/at-home/server/{chapterId}` → `{ baseUrl, chapter: { hash, data, dataSaver } }` → `{baseUrl}/data/{hash}/{filename}`.

### Manga attributes (key fields used by UI)

- `title` (locale map), `altTitles` (array of locale maps), `description` (locale map)
- `contentRating`: `safe` | `suggestive` | `erotica` | `pornographic`
- `status`: `ongoing` | `completed` | `hiatus` | `cancelled`
- `year`, `originalLanguage`, `publicationDemographic` (`shounen`/`shoujo`/`seinen`/`josei`/null)
- `tags[]` (each with `group` + `name` locale map)
- `availableTranslatedLanguages[]`, `lastChapter`, `latestUploadedChapter`
- `links`: `{ al, ap, kt, mu, mal, raw, ... }`
- `relationships`: `author`, `artist`, `cover_art` (with `attributes.fileName`)

### Gotchas

- MangaDex API has **no CORS headers** → must use the Rust proxy `mangadex_get`.
- Array params MUST use bracket form `key[]=v&key[]=v2` — comma-joined strings give silent HTTP 400.
- `/tag` ≠ `/manga/tag`; only `/manga/tag` works.
- PowerShell mangles `curl` output on this machine — use `node -e "fetch(...).then(...)"` for API probing instead of `curl | python`.

---

## File map (where work happens)

- `src/features/mangadex/api.ts` — API client + types (Phase A.3, D.1)
- `src/features/mangadex/types.ts` — MangaDex raw response TS interfaces (D.1 extends)
- `src/features/mangadex/MangadexPage.tsx` — homepage (Phase B.1, D.3)
- `src/features/mangadex/MangaCard.tsx` — card variants + favorite heart (Phase B.2, D.4)
- `src/features/mangadex/MangaDetail.tsx` — detail page (Phase B.3, C.4 integration)
- `src/features/mangadex/ChapterReader.tsx` — reader (Phase B.4, C.1–C.7)
- `src/store/slices/mangadexSlice.ts` — persisted settings (Phase D.2)
- `src/features/settings/sections/MangadexSection.tsx` — settings UI for defaults (Phase D.2)
- `src-tauri/src/db.rs` — DB schema migrations (Phase A.1)
- `src-tauri/src/commands/mangadex.rs` — Rust commands (A.2)
- `src-tauri/src/lib.rs` — `invoke_handler!` registration (A.2)
- `src-tauri/src/commands/mod.rs` — module exports (A.2)
