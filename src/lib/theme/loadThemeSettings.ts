// Shared theme defaults + loader — single source of truth for theme settings.
// themeSlice uses the defaults directly; syncSlice.init() calls loadThemeSettings()
// to hydrate from the persisted DB.

export interface ThemeSettings {
  themeColor: string;
  customBackgroundColor: string;
  themeAccent: string;
  customAccentColor: string;
  appBackgroundImage: string;
  appBackgroundImageOpacity: number;
  appBackgroundImageBlur: number;
  showAnimatedShader: boolean;
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  themeColor: "midnight",
  customBackgroundColor: "#141414",
  themeAccent: "sakura",
  customAccentColor: "#ff5fa2",
  appBackgroundImage: "",
  appBackgroundImageOpacity: 0.3,
  appBackgroundImageBlur: 10,
  showAnimatedShader: true,
};

/**
 * Load theme settings from the SQLite-backed setting store, falling back
 * to DEFAULT_THEME_SETTINGS for any key that hasn't been persisted yet.
 */
export async function loadThemeSettings(
  getSetting: (key: string) => Promise<string | null>,
): Promise<ThemeSettings> {
  const themeColor =
    (await getSetting("theme_color")) ?? DEFAULT_THEME_SETTINGS.themeColor;
  const customBackgroundColor =
    (await getSetting("custom_background_color")) ??
    DEFAULT_THEME_SETTINGS.customBackgroundColor;
  const themeAccent =
    (await getSetting("theme_accent")) ?? DEFAULT_THEME_SETTINGS.themeAccent;
  const customAccentColor =
    (await getSetting("custom_accent_color")) ??
    DEFAULT_THEME_SETTINGS.customAccentColor;
  const appBackgroundImage =
    (await getSetting("app_background_image")) ??
    DEFAULT_THEME_SETTINGS.appBackgroundImage;
  const bgOpacityVal = await getSetting("app_background_image_opacity");
  const appBackgroundImageOpacity =
    bgOpacityVal !== null
      ? Number(bgOpacityVal)
      : DEFAULT_THEME_SETTINGS.appBackgroundImageOpacity;
  const bgBlurVal = await getSetting("app_background_image_blur");
  const appBackgroundImageBlur =
    bgBlurVal !== null
      ? Number(bgBlurVal)
      : DEFAULT_THEME_SETTINGS.appBackgroundImageBlur;
  const showAnimatedShader =
    (await getSetting("show_animated_shader")) !== "false";

  return {
    themeColor,
    customBackgroundColor,
    themeAccent,
    customAccentColor,
    appBackgroundImage,
    appBackgroundImageOpacity,
    appBackgroundImageBlur,
    showAnimatedShader,
  };
}
