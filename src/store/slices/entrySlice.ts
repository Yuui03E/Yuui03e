import type { StateCreator } from "zustand";
import {
  getEntry,
  searchAnilist as apiSearchAnilist,
  setManualMatch as apiSetManualMatch,
  setUserData as apiSetUserData,
} from "../../lib/api";
import type { UserData } from "../../lib/types";
import type { EntrySlice, LibraryState } from "../types";

export const createEntrySlice: StateCreator<LibraryState, [], [], EntrySlice> = (set, get) => ({
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
});
