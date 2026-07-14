import type { StateCreator } from "zustand";
import { applyThemeStyles } from "../../lib/theme";
import {
  getLibrary,
  pickFolder,
  getSetting,
  setSetting,
  graphqlAnilist,
  cancelSync as apiCancelSync,
  pauseSync as apiPauseSync,
  resumeSync as apiResumeSync,
  removeFolderEntries,
} from "../../lib/api";
import type { LibraryState, SyncSlice } from "../types";
import { runSync } from "./runSync";

export const createSyncSlice: StateCreator<LibraryState, [], [], SyncSlice> = (set, get) => ({
  folder: null,
  folders: [],
  entries: [],
  status: "idle",
  progress: "",
  error: null,

  // Search progress tracking
  searchProgress: null,
  searchHistory: [],
  isSearching: false,
  isPaused: false,

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
});
