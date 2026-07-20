// Shared store types: per-slice interfaces + the combined LibraryState.
import type { AniListMedia, StoredEntry, UserData } from "../lib/types";

export type Status =
  | "idle"
  | "loading"
  | "scanning"
  | "matching"
  | "ready"
  | "error";

/// Search progress for a single series, emitted from the backend.
export interface SearchProgress {
  current: number;
  total: number;
  title: string;
  status:
    | "searching"
    | "matched"
    | "not_found"
    | "low_confidence"
    | "error"
    | "cancelled"
    | "cached";
  message: string | null;
}

export interface ThemeSlice {
  themeColor: string;
  customBackgroundColor: string;
  themeAccent: string;
  customAccentColor: string;
  appBackgroundImage: string;
  appBackgroundImageOpacity: number;
  appBackgroundImageBlur: number;
  showAnimatedShader: boolean;

  setThemeColor: (color: string) => Promise<void>;
  setCustomBackgroundColor: (color: string) => Promise<void>;
  setThemeAccent: (accent: string) => Promise<void>;
  setCustomAccentColor: (color: string) => Promise<void>;
  setAppBackgroundImage: (image: string) => Promise<void>;
  setAppBackgroundImageOpacity: (opacity: number) => Promise<void>;
  setAppBackgroundImageBlur: (blur: number) => Promise<void>;
  setShowAnimatedShader: (show: boolean) => Promise<void>;
}

export interface BackdropSlice {
  /** Ordered background artwork for the current detail page. The first entry is
   *  the instant AniList banner; the rest are higher-res TMDB backdrops that
   *  crossfade as a slideshow. Empty means "no artwork — show shader only". */
  activeBackdrops: string[];
  /** When false (default), the app always shows the live animated shader and
   *  never swaps in the anime image backdrop on detail pages. */
  imageBackdropEnabled: boolean;
  setImageBackdropEnabled: (enabled: boolean) => Promise<void>;
  cardSize: number;
  setCardSize: (size: number) => Promise<void>;
  /** Set a single backdrop (or clear with null) — convenience wrapper. */
  setActiveBackdrop: (url: string | null) => void;
  /** Set the full ordered backdrop list for the slideshow. */
  setActiveBackdrops: (urls: string[]) => void;
}

export interface AnilistSlice {
  anilistUser: { name: string; avatarUrl: string } | null;
  loginAnilist: (token: string) => Promise<void>;
  logoutAnilist: () => Promise<void>;
  /** `localStatus` is the app-side status to mirror to AniList when the
   *  episode doesn't complete the series (falls back to CURRENT). */
  syncProgressToAnilist: (
    mediaId: number,
    progress: number,
    isCompleted: boolean,
    localStatus?: string | null,
  ) => Promise<void>;
}

export interface SyncSlice {
  folder: string | null;
  folders: string[];
  /** Individual video file paths added via "Add Video Files". Persisted
   *  separately from `folders` so they don't get re-scanned as folder roots
   *  on the next sync. */
  filePaths: string[];
  entries: StoredEntry[];
  status: Status;
  progress: string;
  error: string | null;

  // Search progress tracking (for the right-side panel)
  searchProgress: SearchProgress | null;
  searchHistory: SearchProgress[];
  isSearching: boolean;
  isPaused: boolean;

  // Toast notification
  toastMsg: string | null;
  setToastMsg: (msg: string | null) => void;

  // Internal path join/split helpers (non-printable delimiter \u001E)
  privateJoinPaths: (paths: string[]) => string;
  privateSplitPaths: (joined: string) => string[];

  /** Load persisted library instantly; only scan if the store is empty. */
  init: () => Promise<void>;
  chooseFolder: () => Promise<void>;
  addPaths: (paths: string[]) => Promise<void>;
  addFilePaths: (paths: string[]) => Promise<void>;
  removePath: (path: string) => Promise<void>;
  removeFilePath: (path: string) => Promise<void>;
  rescan: () => Promise<void>;

  /** Cancel, pause, resume an ongoing sync. */
  cancelSync: () => Promise<void>;
  pauseSync: () => Promise<void>;
  resumeSync: () => Promise<void>;
}

export interface EntrySlice {
  /** Fetch a single hydrated + rich-detail entry (for detail pages). */
  fetchEntry: (key: string) => Promise<StoredEntry | null>;
  /** Persist watch status / score / notes / favorite and update local state. */
  saveUserData: (key: string, data: UserData) => Promise<void>;
  /** Pin a manual match, then refresh that entry from the DB. */
  pinMatch: (key: string, media: unknown) => Promise<void>;
  /** Search AniList for manual match-fix candidates. */
  searchAnilist: (query: string) => Promise<AniListMedia[]>;
}

export type MangadexReaderMode = "paged" | "scroll";
export type MangadexReaderFit = "width" | "height" | "original";
/** Resize (scaling) algorithm applied to page images.
 *  best = browser smooth scaling, medium = crisp-edges, fast = nearest-neighbor. */
export type MangadexReaderQuality = "best" | "medium" | "fast";
export type MangadexReaderDirection = "ltr" | "rtl";
export type MangadexReaderBackground = "black" | "gray" | "white";
/** Source image quality from the at-home CDN. */
export type MangadexImageQuality = "data" | "data-saver";

/** Rebindable reader actions. Values are `KeyboardEvent.key` names,
 *  lowercased for letters (e.g. "m", "arrowleft", "pageup"). */
export type MangadexReaderAction =
  | "prevPage"
  | "nextPage"
  | "scrollUp"
  | "scrollDown"
  | "toggleMode"
  | "cycleFit"
  | "prevChapter"
  | "nextChapter"
  | "toggleControls";

/** Extended reader preferences persisted as one JSON blob. */
export interface MangadexReaderPrefs {
  direction: MangadexReaderDirection; // page-turn direction (manga = rtl)
  quality: MangadexReaderQuality; // resize algorithm
  imageQuality: MangadexImageQuality; // CDN source quality
  background: MangadexReaderBackground;
  pageGap: number; // px between pages in scroll mode
  zoom: number; // percent, 100 = fit
  brightness: number; // percent, 100 = normal
  doublePage: boolean; // two-page spread in paged mode
  menuAutoHideMs: number; // context-menu auto-hide delay
  menuPinned: boolean; // pinned = docked right-side panel, never auto-hides
  keys: Record<MangadexReaderAction, string>; // editable keybindings
}

export interface MangadexSlice {
  mangadexEnabled: boolean;
  // Persisted MangaDex default-filters + reader prefs (Phase D.2).
  mangadexContentRating: string[]; // default ["safe","suggestive"]
  mangadexTranslatedLanguage: string; // default "en"
  mangadexOriginalLanguageFilter: string | null; // default null (any)
  mangadexReaderMode: MangadexReaderMode; // default "paged"
  mangadexReaderFit: MangadexReaderFit; // default "width"
  mangadexReaderPrefs: MangadexReaderPrefs;

  setMangadexEnabled: (enabled: boolean) => Promise<void>;
  setMangadexContentRating: (ratings: string[]) => Promise<void>;
  setMangadexTranslatedLanguage: (lang: string) => Promise<void>;
  setMangadexOriginalLanguageFilter: (lang: string | null) => Promise<void>;
  setMangadexReaderMode: (mode: MangadexReaderMode) => Promise<void>;
  setMangadexReaderFit: (fit: MangadexReaderFit) => Promise<void>;
  /** Merge a partial prefs patch and persist the full blob. */
  setMangadexReaderPrefs: (patch: Partial<MangadexReaderPrefs>) => Promise<void>;
}

export interface LibraryState
  extends
    ThemeSlice,
    BackdropSlice,
    AnilistSlice,
    SyncSlice,
    EntrySlice,
    MangadexSlice {}
