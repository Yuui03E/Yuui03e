// Barrel: preserves the original `lib/theme` public surface after the split.
export * from "./presets";
export { applyThemeStyles } from "./applyThemeStyles";
// Color helpers were previously exported from this module; re-export for compatibility.
export { hexToHsl, hslToHex, hexToRgb } from "../color";
