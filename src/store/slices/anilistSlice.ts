import type { StateCreator } from "zustand";
import { setSetting, graphqlAnilist } from "../../lib/api";
import type { AnilistSlice, LibraryState } from "../types";

export const createAnilistSlice: StateCreator<LibraryState, [], [], AnilistSlice> = (set) => ({
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
});
