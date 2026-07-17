import type { StateCreator } from "zustand";
import { getSetting, setSetting, fetchViewer, saveMediaListEntry } from "../../lib/api";
import type { AnilistSlice, LibraryState } from "../types";

export const createAnilistSlice: StateCreator<
  LibraryState,
  [],
  [],
  AnilistSlice
> = (set) => ({
  anilistUser: null,
  loginAnilist: async (token) => {
    const oldToken = await getSetting("anilist_token");
    try {
      await setSetting("anilist_token", token);
      const user = await fetchViewer();
      if (user) {
        set({ anilistUser: { name: user.name, avatarUrl: user.avatarUrl } });
      } else {
        throw new Error("Token rejected by AniList");
      }
    } catch (e) {
      await setSetting("anilist_token", oldToken || "");
      throw e;
    }
  },
  logoutAnilist: async () => {
    await setSetting("anilist_token", "");
    set({ anilistUser: null });
  },
  syncProgressToAnilist: async (
    mediaId,
    progress,
    isCompleted,
    localStatus,
  ) => {
    try {
      // Respect the user's actual local status (Paused/Dropped/…) instead of
      // force-flipping every watched episode to CURRENT on AniList.
      const status = isCompleted
        ? "Completed"
        : localStatus
          ? localStatus
          : "Watching";
      await saveMediaListEntry({ mediaId, progress, status });
    } catch (e) {
      console.error("Failed to sync progress to AniList", e);
    }
  },
});
