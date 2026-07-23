import type { StateCreator } from "zustand";
import { setSetting } from "../../lib/api";
import type { LibraryState, YandereSlice } from "../types";
import type { YandePost } from "../../lib/yandereApi";

const FAV_KEY = "yuui_yandere_favorites";
const RATINGS_KEY = "yuui_yandere_ratings";
const SORT_KEY = "yuui_yandere_sort";
const ASPECT_KEY = "yuui_yandere_aspect_filter";
const BLUR_KEY = "yuui_yandere_blur_nsfw";
const CARD_SIZE_KEY = "yuui_yandere_card_size";
const DOWNLOAD_DIR_KEY = "yuui_yandere_download_dir";

const loadFavs = (): YandePost[] => {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const loadRatings = (): ("s" | "q" | "e")[] => {
  try {
    const raw = localStorage.getItem(RATINGS_KEY);
    return raw ? JSON.parse(raw) : ["s", "q"];
  } catch {
    return ["s", "q"];
  }
};

export const createYandereSlice: StateCreator<LibraryState, [], [], YandereSlice> = (set, get) => ({
  yandereEnabled: true,
  yandereRatings: loadRatings(),
  yandereAspectFilter: (localStorage.getItem(ASPECT_KEY) as "all" | "desktop" | "mobile") || "all",
  yandereSort: "recent",
  yandereBlurNSFW: localStorage.getItem(BLUR_KEY) !== "false",

  yandereCardSize: Number(localStorage.getItem(CARD_SIZE_KEY)) || 220,
  yandereDownloadDir: localStorage.getItem(DOWNLOAD_DIR_KEY) || null,
  yandereFavorites: loadFavs(),

  setYandereEnabled: async (enabled) => {
    set({ yandereEnabled: enabled });
    await setSetting("yandere_enabled", enabled ? "true" : "false");
  },

  setYandereRatings: async (ratings) => {
    set({ yandereRatings: ratings });
    localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
    await setSetting("yandere_ratings", JSON.stringify(ratings));
  },

  setYandereAspectFilter: async (filter) => {
    set({ yandereAspectFilter: filter });
    localStorage.setItem(ASPECT_KEY, filter);
    await setSetting("yandere_aspect_filter", filter);
  },

  setYandereSort: async (sort) => {
    set({ yandereSort: sort });
    localStorage.setItem(SORT_KEY, sort);
    await setSetting("yandere_sort", sort);
  },

  setYandereBlurNSFW: async (blur) => {
    set({ yandereBlurNSFW: blur });
    localStorage.setItem(BLUR_KEY, blur ? "true" : "false");
    await setSetting("yandere_blur_nsfw", blur ? "true" : "false");
  },

  setYandereCardSize: (size) => {
    set({ yandereCardSize: size });
    localStorage.setItem(CARD_SIZE_KEY, String(size));
  },

  setYandereDownloadDir: async (dir) => {
    set({ yandereDownloadDir: dir });
    if (dir) {
      localStorage.setItem(DOWNLOAD_DIR_KEY, dir);
      await setSetting("yandere_download_dir", dir);
    } else {
      localStorage.removeItem(DOWNLOAD_DIR_KEY);
      await setSetting("yandere_download_dir", "");
    }
  },

  toggleYandereFavorite: (post) => {
    const current = get().yandereFavorites;
    const exists = current.some((item) => item.id === post.id);
    const updated = exists
      ? current.filter((item) => item.id !== post.id)
      : [post, ...current];
    set({ yandereFavorites: updated });
    localStorage.setItem(FAV_KEY, JSON.stringify(updated));
  },
});
