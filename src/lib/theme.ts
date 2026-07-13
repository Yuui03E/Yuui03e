export interface ThemePreset {
  id: string;
  name: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
}

export interface AccentPreset {
  id: string;
  name: string;
  accent: string;
  accent2: string;
  accent3: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "midnight",
    name: "Midnight Slate",
    background: "#12131a",
    surface: "rgba(30, 32, 45, 0.4)",
    surfaceElevated: "rgba(40, 42, 60, 0.6)",
    border: "rgba(50, 52, 75, 0.35)",
  },
  {
    id: "oled",
    name: "OLED Black",
    background: "#000000",
    surface: "rgba(255, 255, 255, 0.04)",
    surfaceElevated: "rgba(255, 255, 255, 0.08)",
    border: "rgba(255, 255, 255, 0.08)",
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk Blue",
    background: "#0a0d24",
    surface: "rgba(20, 25, 60, 0.4)",
    surfaceElevated: "rgba(30, 35, 80, 0.6)",
    border: "rgba(60, 70, 130, 0.35)",
  },
  {
    id: "forest",
    name: "Forest Moss",
    background: "#071a10",
    surface: "rgba(15, 45, 30, 0.4)",
    surfaceElevated: "rgba(20, 60, 40, 0.6)",
    border: "rgba(45, 100, 70, 0.35)",
  },
  {
    id: "coffee",
    name: "Warm Coffee",
    background: "#22110a",
    surface: "rgba(50, 30, 20, 0.4)",
    surfaceElevated: "rgba(65, 40, 25, 0.6)",
    border: "rgba(90, 60, 45, 0.35)",
  },
  {
    id: "amethyst",
    name: "Nebula Purple",
    background: "#150a24",
    surface: "rgba(35, 20, 60, 0.4)",
    surfaceElevated: "rgba(50, 25, 80, 0.6)",
    border: "rgba(80, 50, 130, 0.35)",
  },
];

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: "sakura",
    name: "Sakura Pink",
    accent: "oklch(0.72 0.23 343)", // #ff5fa2
    accent2: "oklch(0.58 0.23 283)", // #7c5cff
    accent3: "oklch(0.82 0.17 200)", // #22d3ee
  },
  {
    id: "sunset",
    name: "Sunset Orange",
    accent: "oklch(0.76 0.20 45)", // #f59e0b
    accent2: "oklch(0.65 0.22 30)", // #ea580c
    accent3: "oklch(0.85 0.15 65)", // #fde047
  },
  {
    id: "emerald",
    name: "Emerald Forest",
    accent: "oklch(0.75 0.18 150)", // #10b981
    accent2: "oklch(0.62 0.18 175)", // #059669
    accent3: "oklch(0.85 0.12 135)", // #6ee7b7
  },
  {
    id: "ocean",
    name: "Ocean Wave",
    accent: "oklch(0.70 0.17 220)", // #06b6d4
    accent2: "oklch(0.55 0.20 250)", // #3b82f6
    accent3: "oklch(0.85 0.12 190)", // #a5f3fc
  },
  {
    id: "nebula",
    name: "Nebula Purple",
    accent: "oklch(0.62 0.22 290)", // #8b5cf6
    accent2: "oklch(0.52 0.25 320)", // #ec4899
    accent3: "oklch(0.80 0.15 270)", // #c084fc
  },
];

// Helper to convert hex to HSL
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Helper to convert HSL to hex
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }
  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Helper to convert hex to RGB
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return { r, g, b };
}

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
