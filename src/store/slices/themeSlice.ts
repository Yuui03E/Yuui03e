import type { StateCreator } from "zustand";
import { applyThemeStyles } from "../../lib/theme";
import { setSetting } from "../../lib/api";
import { DEFAULT_THEME_SETTINGS } from "../../lib/theme/loadThemeSettings";
import type { LibraryState, ThemeSlice } from "../types";

export const createThemeSlice: StateCreator<LibraryState, [], [], ThemeSlice> = (set, get) => ({
  ...DEFAULT_THEME_SETTINGS,

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
});
