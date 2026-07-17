import type { StateCreator } from "zustand";
import { applyThemeStyles } from "../../lib/theme";
import { loadThemeSettings } from "../../lib/theme/loadThemeSettings";
import {
  getLibrary,
  pickFolder,
  getSetting,
  setSetting,
  cancelSync as apiCancelSync,
  pauseSync as apiPauseSync,
  resumeSync as apiResumeSync,
  fetchViewer,
  removeFolderEntries,
  removeFileEntries,
} from "../../lib/api";
import type { LibraryState, SyncSlice } from "../types";
import { runSync } from "./runSync";

export const createSyncSlice: StateCreator<LibraryState, [], [], SyncSlice> = (
  set,
  get,
) => ({
  folder: null,
  folders: [],
  filePaths: [],
  entries: [],
  status: "idle",
  progress: "",
  error: null,

  // Search progress tracking
  searchProgress: null,
  searchHistory: [],
  isSearching: false,
  isPaused: false,

  // Toast notification
  toastMsg: null,
  setToastMsg: (msg: string | null) => set({ toastMsg: msg }),

  // Helper to safely join/split paths using a non-printable delimiter (RS/Unit Separator \u001E)
  // This avoids collisions with semicolons in Windows UNC paths or Unix paths containing semicolons.
  // Also trims paths to match Tauri backend behavior (split('\u{1E}').map(|s| s.trim())).
  privateJoinPaths: (paths: string[]) => {
    const rs = String.fromCharCode(30);
    return paths.map((p) => p.replace(new RegExp(rs, "g"), "").trim()).join(rs);
  },
  privateSplitPaths: (joined: string) =>
    joined
      ? joined
          .split("\u001E")
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
      : [],

  init: async () => {
    if (get().status !== "idle") return;
    try {
      set({ status: "loading", progress: "Loading library…" });

      // Load the theme preferences via the shared loader
      const themeSettings = await loadThemeSettings(getSetting);
      set(themeSettings);
      applyThemeStyles(themeSettings);

      // Load the image-backdrop preference (default off — live animation only).
      const bdPref = await getSetting("image_backdrop_enabled");
      set({ imageBackdropEnabled: bdPref === "true" });

      // Load card_size from settings with localStorage fallback (migration).
      const cardSizeSetting = await getSetting("card_size");
      if (cardSizeSetting !== null) {
        set({ cardSize: Number(cardSizeSetting) });
      } else {
        const legacy = localStorage.getItem("yuui_card_size");
        if (legacy !== null) {
          set({ cardSize: Number(legacy) });
        }
      }

      // Load AniList user profile if token is set
      const token = await getSetting("anilist_token");
      if (token && token.trim().length > 0) {
        try {
          const user = await fetchViewer();
          if (user) {
            set({
              anilistUser: { name: user.name, avatarUrl: user.avatarUrl },
            });
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
      const folders = get().privateSplitPaths(path);
      set({ folder: path, folders });

      // Audit #4: load individual video file paths from a SEPARATE setting
      // so they don't get re-split as folder roots on the next sync.
      let filesStr = await getSetting("library_files");
      if (!filesStr) filesStr = "";
      const filePaths = get().privateSplitPaths(filesStr);
      set({ filePaths });

      // Instant load from the persisted DB first.
      const stored = await getLibrary();
      if (stored.length > 0) {
        set({ entries: stored, status: "ready", progress: "" });
        return;
      }

      // Empty store → do a first scan+match+persist.
      const allPaths = [...folders, ...filePaths];
      if (allPaths.length > 0) {
        await runSync(get().privateJoinPaths(allPaths), set, get);
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
    // Re-check after the dialog — it can stay open for minutes, and a sync
    // started meanwhile would otherwise run concurrently with this one.
    if (get().isSearching) return;
    const folders = [picked];
    const folderStr = get().privateJoinPaths(folders);
    set({ folders, folder: folderStr });
    await setSetting("library_folder", folderStr);
    await runSync(folderStr, set, get);
  },

  addPaths: async (paths: string[]) => {
    if (get().isSearching) return; // Prevent concurrent syncs — fix for "locked" issue
    const current = get().folders;
    const newPaths = paths.filter((p) => !current.includes(p));
    if (newPaths.length === 0) return; // nothing new to add
    const updated = Array.from(new Set([...current, ...newPaths]));
    const folderStr = get().privateJoinPaths(updated);
    set({ folders: updated, folder: folderStr });
    await setSetting("library_folder", folderStr);
    if (get().isSearching) return; // Re-check after the awaited setting write
    // ONLY scan the newly added paths, and do NOT prune existing entries!
    await runSync(get().privateJoinPaths(newPaths), set, get, false);
  },

  /** Audit #4: persist individual video file paths in their OWN setting
   *  ("library_files"), separate from the folder list. The Rust scanner
   *  already handles file-typed roots, so we just feed the joins through
   *  to sync_library like any other path. */
  addFilePaths: async (paths: string[]) => {
    if (get().isSearching) return;
    const current = get().filePaths;
    const newPaths = paths.filter((p) => !current.includes(p));
    if (newPaths.length === 0) return;
    const updated = Array.from(new Set([...current, ...newPaths]));
    const filesStr = get().privateJoinPaths(updated);
    set({ filePaths: updated });
    await setSetting("library_files", filesStr);
    if (get().isSearching) return;
    await runSync(get().privateJoinPaths(newPaths), set, get, false);
  },

  removePath: async (pathToRemove: string) => {
    if (get().isSearching) return; // Prevent concurrent syncs
    const updated = get().folders.filter((p) => p !== pathToRemove);
    const folderStr = get().privateJoinPaths(updated);
    set({ folders: updated, folder: folderStr });
    await setSetting("library_folder", folderStr);
    // Delete DB entries for this folder directly, then reload what's left
    try {
      const entries = await removeFolderEntries(pathToRemove);
      set({ entries, status: "ready", progress: "" });
    } catch (e) {
      // Fallback: rescan if the direct delete fails. Never rescan an empty
      // path — syncing "" with prune on could wipe the whole library.
      if (folderStr.trim().length > 0) {
        await runSync(folderStr, set, get);
      } else {
        set({ status: "ready", progress: "", error: String(e) });
      }
    }
  },

  /** Audit #4: remove an individual file path (NOT a folder) — just delete
   *  the file's records from the DB; no recursive folder LIKE-walk. */
  removeFilePath: async (pathToRemove: string) => {
    if (get().isSearching) return;
    const updated = get().filePaths.filter((p) => p !== pathToRemove);
    const filesStr = get().privateJoinPaths(updated);
    set({ filePaths: updated });
    await setSetting("library_files", filesStr);
    try {
      const entries = await removeFileEntries(pathToRemove);
      set({ entries, status: "ready", progress: "" });
    } catch (e) {
      set({ status: "ready", progress: "", error: String(e) });
    }
  },

  rescan: async () => {
    if (get().isSearching) return;
    const folders = get().folders;
    const filePaths = get().filePaths;
    const allPaths = [...folders, ...filePaths];
    if (allPaths.length === 0) return;
    await runSync(get().privateJoinPaths(allPaths), set, get);
  },

  cancelSync: async () => {
    await apiCancelSync();
    // Belt-and-braces: the backend will emit sync:complete shortly and the
    // listener resets isSearching, but force the local state now in case the
    // listener is slow / dropped due to a navigation race.
    set({ isPaused: false, isSearching: false, status: "ready" });
  },

  pauseSync: async () => {
    await apiPauseSync();
    set({ isPaused: true });
  },

  resumeSync: async () => {
    await apiResumeSync();
    set({ isPaused: false });
  },
});
