// Shared store types: per-slice interfaces + the combined LibraryState.
import type { AniListMedia, StoredEntry, UserData } from "../lib/types";

export type Status = "idle" | "loading" | "scanning" | "matching" | "ready" | "error";

/// Search progress for a single series, emitted from the backend.
export interface SearchProgress {
  current: number;
  total: number;
  title: string;
  status: "searching" | "matched" | "not_found" | "low_confidence" | "error" | "cancelled";
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
  setCardSize: (size: number) => void;
  /** Set a single backdrop (or clear with null) — convenience wrapper. */
  setActiveBackdrop: (url: string | null) => void;
  /** Set the full ordered backdrop list for the slideshow. */
  setActiveBackdrops: (urls: string[]) => void;
}

export interface AnilistSlice {
  anilistUser: { name: string; avatarUrl: string } | null;
  loginAnilist: (token: string) => Promise<void>;
  logoutAnilist: () => Promise<void>;
  syncProgressToAnilist: (mediaId: number, progress: number, isCompleted: boolean) => Promise<void>;
}

export interface SyncSlice {
  folder: string | null;
  folders: string[];
  entries: StoredEntry[];
  status: Status;
  progress: string;
  error: string | null;

  // Search progress tracking (for the right-side panel)
  searchProgress: SearchProgress | null;
  searchHistory: SearchProgress[];
  isSearching: boolean;
  isPaused: boolean;

  /** Load persisted library instantly; only scan if the store is empty. */
  init: () => Promise<void>;
  chooseFolder: () => Promise<void>;
  addPaths: (paths: string[]) => Promise<void>;
  removePath: (path: string) => Promise<void>;
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

export interface LibraryState
  extends ThemeSlice,
    BackdropSlice,
    AnilistSlice,
    SyncSlice,
    EntrySlice {}
