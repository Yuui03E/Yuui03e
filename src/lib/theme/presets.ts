// Theme & accent preset data + their types.

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
