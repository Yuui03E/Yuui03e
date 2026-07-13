import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { applyThemeStyles } from "../lib/theme";
import type { AniListMedia, StoredEntry, UserData } from "../lib/types";
import {
  getEntry,
  getLibrary,
  pickFolder,
  searchAnilist as apiSearchAnilist,
  setManualMatch as apiSetManualMatch,
  setUserData as apiSetUserData,
  syncLibrary,
  getSetting,
  setSetting,
  graphqlAnilist,
  cancelSync as apiCancelSync,
  pauseSync as apiPauseSync,
  resumeSync as apiResumeSync,
  removeFolderEntries,
} from "../lib/api";

type Status = "idle" | "loading" | "scanning" | "matching" | "ready" | "error";

/// Search progress for a single series, emitted from the backend.
interface SearchProgress {
  current: number;
  total: number;
  title: string;
  status: "searching" | "matched" | "not_found" | "low_confidence" | "error" | "cancelled";
  message: string | null;
}

interface LibraryState {
  folder: string | null;
  folders: string[];
  entries: StoredEntry[];
  status: Status;
  progress: string;
  error: string | null;
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

  // Search progress tracking (for the right-side panel)
  searchProgress: SearchProgress | null;
  searchHistory: SearchProgress[];
  isSearching: boolean;
  isPaused: boolean;

  anilistUser: { name: string; avatarUrl: string } | null;
  loginAnilist: (token: string) => Promise<void>;
  logoutAnilist: () => Promise<void>;
  syncProgressToAnilist: (mediaId: number, progress: number, isCompleted: boolean) => Promise<void>;

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

  /** Fetch a single hydrated + rich-detail entry (for detail pages). */
  fetchEntry: (key: string) => Promise<StoredEntry | null>;
  /** Persist watch status / score / notes / favorite and update local state. */
  saveUserData: (key: string, data: UserData) => Promise<void>;
  /** Pin a manual match, then refresh that entry from the DB. */
  pinMatch: (key: string, media: unknown) => Promise<void>;
  /** Search AniList for manual match-fix candidates. */
  searchAnilist: (query: string) => Promise<AniListMedia[]>;
  /** Set a single backdrop (or clear with null) — convenience wrapper. */
  setActiveBackdrop: (url: string | null) => void;
  /** Set the full ordered backdrop list for the slideshow. */
  setActiveBackdrops: (urls: string[]) => void;

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

async function runSync(
  folder: string,
  set: (partial: Partial<LibraryState>) => void,
  get: () => LibraryState,
  prune = true,
) {
  let unlistenProgress: (() => void) | null = null;
  let unlistenEntry: (() => void) | null = null;
  let unlistenSearching: (() => void) | null = null;
  let unlistenComplete: (() => void) | null = null;

  try {
    set({
      status: "scanning",
      progress: "Starting sync...",
      error: null,
      isSearching: true,
      isPaused: false,
      searchProgress: null,
      searchHistory: [],
    });

    unlistenProgress = await listen<string>("sync:progress", (event) => {
      set({ progress: event.payload });
    });

    unlistenSearching = await listen<SearchProgress>("sync:searching", (event) => {
      const p = event.payload;
      set({ searchProgress: p });

      // Accumulate completed searches in history (max 200 entries)
      if (p.status !== "searching") {
        const history = get().searchHistory;
        const updated = [...history, p].slice(-200);
        set({ searchHistory: updated });
      }
    });

    unlistenEntry = await listen<StoredEntry>("sync:entry-updated", (event) => {
      // The backend now sends the FULL hydrated entry (read from the DB, no
      // network). Insert/replace it directly — no per-entry AniList refetch,
      // which was the second request stream causing 429 rate-limit storms.
      const entry = event.payload;
      if (!entry || !entry.key) return;

      const currentEntries = get().entries;
      const exists = currentEntries.some((e) => e.key === entry.key);
      if (exists) {
        set({
          entries: currentEntries.map((e) => (e.key === entry.key ? entry : e)),
        });
      } else {
        const updated = [...currentEntries, entry];
        updated.sort((a, b) => {
          const tA = a.media?.title.english || a.media?.title.romaji || a.title || "";
          const tB = b.media?.title.english || b.media?.title.romaji || b.title || "";
          return tA.localeCompare(tB);
        });
        set({ entries: updated });
      }
    });

    unlistenComplete = await listen("sync:complete", () => {
      set({ isSearching: false, isPaused: false });
    });

    const entries = await syncLibrary(folder, prune);
    set({ entries, status: "ready", progress: "", isSearching: false, isPaused: false, searchProgress: null });
  } catch (e) {
    set({ status: "error", error: String(e), progress: "", isSearching: false, isPaused: false });
  } finally {
    if (unlistenProgress) unlistenProgress();
    if (unlistenEntry) unlistenEntry();
    if (unlistenSearching) unlistenSearching();
    if (unlistenComplete) unlistenComplete();
  }
}

export const useLibrary = create<LibraryState>((set, get) => ({
  folder: null,
  folders: [],
  entries: [],
  status: "idle",
  progress: "",
  error: null,
  activeBackdrops: [],
  setActiveBackdrop: (url) => set({ activeBackdrops: url ? [url] : [] }),
  setActiveBackdrops: (urls) => set({ activeBackdrops: urls }),
  imageBackdropEnabled: false,
  setImageBackdropEnabled: async (enabled) => {
    set({ imageBackdropEnabled: enabled });
    // Clear any current artwork immediately when turning it off.
    if (!enabled) set({ activeBackdrops: [] });
    await setSetting("image_backdrop_enabled", enabled ? "true" : "false");
  },
  cardSize: Number(localStorage.getItem("yuui_card_size")) || 180,
  setCardSize: (size) => {
    localStorage.setItem("yuui_card_size", String(size));
    set({ cardSize: size });
  },

  themeColor: "midnight",
  customBackgroundColor: "#141414",
  themeAccent: "sakura",
  customAccentColor: "#ff5fa2",
  appBackgroundImage: "",
  appBackgroundImageOpacity: 0.3,
  appBackgroundImageBlur: 10,
  showAnimatedShader: true,

  setThemeColor: async (color) => {
    set({ themeColor: color });
    applyThemeStyles(get());
    await setSetting("theme_color", color);
  },
  setCustomBackgroundColor: async (color) => {
    set({ customBackgroundColor: color });
    applyThemeStyles(get());
    await setSetting("custom_background_color", color);
  },
  setThemeAccent: async (accent) => {
    set({ themeAccent: accent });
    applyThemeStyles(get());
    await setSetting("theme_accent", accent);
  },
  setCustomAccentColor: async (color) => {
    set({ customAccentColor: color });
    applyThemeStyles(get());
    await setSetting("custom_accent_color", color);
  },
  setAppBackgroundImage: async (image) => {
    set({ appBackgroundImage: image });
    await setSetting("app_background_image", image);
  },
  setAppBackgroundImageOpacity: async (opacity) => {
    set({ appBackgroundImageOpacity: opacity });
    await setSetting("app_background_image_opacity", String(opacity));
  },
  setAppBackgroundImageBlur: async (blur) => {
    set({ appBackgroundImageBlur: blur });
    await setSetting("app_background_image_blur", String(blur));
  },
  setShowAnimatedShader: async (show) => {
    set({ showAnimatedShader: show });
    await setSetting("show_animated_shader", show ? "true" : "false");
  },

  // Search progress tracking
  searchProgress: null,
  searchHistory: [],
  isSearching: false,
  isPaused: false,

  anilistUser: null,
  loginAnilist: async (token) => {
    await setSetting("anilist_token", token);
    const profile = await graphqlAnilist(
      `query { Viewer { name avatar { large } } }`,
      {}
    );
    const user = profile?.data?.Viewer;
    if (user) {
      set({ anilistUser: { name: user.name, avatarUrl: user.avatar.large } });
    } else {
      await setSetting("anilist_token", "");
      throw new Error("Failed to fetch AniList profile. Is the token valid?");
    }
  },
  logoutAnilist: async () => {
    await setSetting("anilist_token", "");
    set({ anilistUser: null });
  },
  syncProgressToAnilist: async (mediaId, progress, isCompleted) => {
    try {
      const status = isCompleted ? "COMPLETED" : "CURRENT";
      await graphqlAnilist(
        `mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) {
          SaveMediaListEntry (mediaId: $mediaId, progress: $progress, status: $status) {
            id
            progress
            status
          }
        }`,
        { mediaId, progress, status }
      );
    } catch (e) {
      console.error("Failed to sync progress to AniList", e);
    }
  },

  init: async () => {
    if (get().status !== "idle") return;
    try {
      set({ status: "loading", progress: "Loading library…" });

      // Load the theme preferences
      const themeColor = await getSetting("theme_color") || "midnight";
      const customBackgroundColor = await getSetting("custom_background_color") || "#141414";
      const themeAccent = await getSetting("theme_accent") || "sakura";
      const customAccentColor = await getSetting("custom_accent_color") || "#ff5fa2";
      const appBackgroundImage = await getSetting("app_background_image") || "";
      const bgOpacityVal = await getSetting("app_background_image_opacity");
      const appBackgroundImageOpacity = bgOpacityVal !== null ? Number(bgOpacityVal) : 0.3;
      const bgBlurVal = await getSetting("app_background_image_blur");
      const appBackgroundImageBlur = bgBlurVal !== null ? Number(bgBlurVal) : 10;
      const showAnimatedShader = (await getSetting("show_animated_shader")) !== "false";

      set({
        themeColor,
        customBackgroundColor,
        themeAccent,
        customAccentColor,
        appBackgroundImage,
        appBackgroundImageOpacity,
        appBackgroundImageBlur,
        showAnimatedShader,
      });

      // Apply styles to document.documentElement
      applyThemeStyles({ themeColor, customBackgroundColor, themeAccent, customAccentColor });

      // Load the image-backdrop preference (default off — live animation only).
      const bdPref = await getSetting("image_backdrop_enabled");
      set({ imageBackdropEnabled: bdPref === "true" });

      // Load AniList user profile if token is set
      const token = await getSetting("anilist_token");
      if (token && token.trim().length > 0) {
        try {
          const profile = await graphqlAnilist(
            `query { Viewer { name avatar { large } } }`,
            {}
          );
          const user = profile?.data?.Viewer;
          if (user) {
            set({ anilistUser: { name: user.name, avatarUrl: user.avatar.large } });
          }
        } catch (e) {
          console.warn("Failed to load AniList profile on init", e);
        }
      }

      // Load library folder from settings if exists
      let path = await getSetting("library_folder");
      if (!path) {
        path = "";
      }
      const folders = path ? path.split(";").filter((p) => p.trim().length > 0) : [];
      set({ folder: path, folders });

      // Instant load from the persisted DB first.
      const stored = await getLibrary();
      if (stored.length > 0) {
        set({ entries: stored, status: "ready", progress: "" });
        return;
      }

      // Empty store → do a first scan+match+persist.
      if (path && path.trim().length > 0) {
        await runSync(path, set, get);
      } else {
        set({ status: "ready", progress: "" });
      }
    } catch (e) {
      set({ status: "error", error: String(e), progress: "" });
    }
  },

  chooseFolder: async () => {
    if (get().isSearching) return; // Prevent concurrent syncs
    const picked = await pickFolder();
    if (!picked) return;
    const folders = [picked];
    set({ folders, folder: picked });
    await setSetting("library_folder", picked);
    await runSync(picked, set, get);
  },

  addPaths: async (paths: string[]) => {
    if (get().isSearching) return; // Prevent concurrent syncs — fix for "locked" issue
    const current = get().folders;
    const newPaths = paths.filter((p) => !current.includes(p));
    if (newPaths.length === 0) return; // nothing new to add
    const updated = Array.from(new Set([...current, ...newPaths]));
    const folderStr = updated.join(";");
    set({ folders: updated, folder: folderStr });
    await setSetting("library_folder", folderStr);
    // ONLY scan the newly added paths, and do NOT prune existing entries!
    await runSync(newPaths.join(";"), set, get, false);
  },

  removePath: async (pathToRemove: string) => {
    if (get().isSearching) return; // Prevent concurrent syncs
    const updated = get().folders.filter((p) => p !== pathToRemove);
    const folderStr = updated.join(";");
    set({ folders: updated, folder: folderStr });
    await setSetting("library_folder", folderStr);
    // Delete DB entries for this folder directly, then reload what's left
    try {
      const entries = await removeFolderEntries(pathToRemove);
      set({ entries, status: "ready", progress: "" });
    } catch (e) {
      // Fallback: rescan if the direct delete fails
      await runSync(folderStr, set, get);
    }
  },

  rescan: async () => {
    const folder = get().folder;
    if (!folder) return;
    if (get().isSearching) return; // Prevent concurrent syncs
    await runSync(folder, set, get);
  },

  cancelSync: async () => {
    await apiCancelSync();
    set({ isPaused: false });
    // The sync will complete soon and set status to ready/error
  },

  pauseSync: async () => {
    await apiPauseSync();
    set({ isPaused: true });
  },

  resumeSync: async () => {
    await apiResumeSync();
    set({ isPaused: false });
  },

  fetchEntry: async (key: string) => {
    // Serve from local state immediately if present; still refresh in bg.
    const local = get().entries.find((e) => e.key === key) ?? null;
    try {
      const fresh = await getEntry(key);
      if (fresh) {
        set({
          entries: get().entries.map((e) => (e.key === key ? fresh : e)),
        });
        return fresh;
      }
    } catch {
      // fall back to local
    }
    return local;
  },

  saveUserData: async (key: string, data: UserData) => {
    await apiSetUserData(key, data);
    set({
      entries: get().entries.map((e) =>
        e.key === key ? { ...e, user: data } : e,
      ),
    });
  },

  pinMatch: async (key: string, media: unknown) => {
    await apiSetManualMatch(key, media);
    const fresh = await getEntry(key);
    if (fresh) {
      set({
        entries: get().entries.map((e) => (e.key === key ? fresh : e)),
      });
    }
  },

  searchAnilist: (query: string) => apiSearchAnilist(query),
}));
