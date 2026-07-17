import type { StateCreator } from "zustand";
import { setSetting } from "../../lib/api";
import type { BackdropSlice, LibraryState } from "../types";

export const createBackdropSlice: StateCreator<LibraryState, [], [], BackdropSlice> = (set) => ({
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
  setCardSize: async (size) => {
    localStorage.setItem("yuui_card_size", String(size));
    set({ cardSize: size });
    await setSetting("card_size", String(size));
  },
});
