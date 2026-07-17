import { hexToHsl, hslToHex, hexToRgb } from "../color";
import { THEME_PRESETS, ACCENT_PRESETS, type AccentPreset } from "./presets";

// Apply theme styles to document.documentElement
export function applyThemeStyles(state: {
  themeColor: string;
  customBackgroundColor: string;
  themeAccent: string;
  customAccentColor: string;
}) {
  const root = document.documentElement;

  // Apply base theme colors
  if (state.themeColor === "custom") {
    const customHex = state.customBackgroundColor;
    const { r, g, b } = hexToRgb(customHex);
    root.style.setProperty("--background", `rgb(${r}, ${g}, ${b})`);
    root.style.setProperty(
      "--surface",
      `rgba(${Math.min(255, r + 8)}, ${Math.min(255, g + 8)}, ${Math.min(255, b + 12)}, 0.35)`
    );
    root.style.setProperty(
      "--surface-elevated",
      `rgba(${Math.min(255, r + 15)}, ${Math.min(255, g + 15)}, ${Math.min(255, b + 20)}, 0.55)`
    );
    root.style.setProperty(
      "--border",
      `rgba(${Math.min(255, r + 30)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 38)}, 0.35)`
    );
  } else {
    const theme = THEME_PRESETS.find((t) => t.id === state.themeColor) || THEME_PRESETS[0];
    root.style.setProperty("--background", theme.background);
    root.style.setProperty("--surface", theme.surface);
    root.style.setProperty("--surface-elevated", theme.surfaceElevated);
    root.style.setProperty("--border", theme.border);
  }

  // Apply accent colors
  let acc: Omit<AccentPreset, "id" | "name">;
  if (state.themeAccent === "custom") {
    const customHex = state.customAccentColor;
    const hsl = hexToHsl(customHex);
    // Generate accent2 (slightly hue shifted purple/blue side) and accent3 (slightly hue shifted cyan/green side)
    const acc2Hex = hslToHex((hsl.h + 300) % 360, Math.min(100, hsl.s + 10), Math.max(35, hsl.l - 5));
    const acc3Hex = hslToHex((hsl.h + 40) % 360, Math.min(100, hsl.s + 15), Math.min(85, hsl.l + 10));
    acc = {
      accent: customHex,
      accent2: acc2Hex,
      accent3: acc3Hex,
    };
  } else {
    acc = ACCENT_PRESETS.find((a) => a.id === state.themeAccent) || ACCENT_PRESETS[0];
  }

  root.style.setProperty("--accent", acc.accent);
  root.style.setProperty("--accent2", acc.accent2);
  root.style.setProperty("--accent3", acc.accent3);
}
