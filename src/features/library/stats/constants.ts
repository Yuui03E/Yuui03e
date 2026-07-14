// ─── Constants ─────────────────────────────────────────────────────────────────
export const STATUS_CFG: Record<string, { label: string; hex: string }> = {
  Watching:  { label: "Watching",  hex: "#3db4f2" },
  Completed: { label: "Completed", hex: "#4ade80" },
  Planning:  { label: "Planning",  hex: "#a78bfa" },
  Paused:    { label: "Paused",    hex: "#fbbf24" },
  Dropped:   { label: "Dropped",   hex: "#f87171" },
  Untracked: { label: "Untracked", hex: "#6b7280" },
};
export { TRACK_STATUSES } from "../../../lib/anilistStatus";
export const ACCENT = "#ff5fa2";
export const ACCENT2 = "#7c5cff";
export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
