// Small display helpers shared across pages.

/** Strip AniList HTML from a description and collapse whitespace. */
export function cleanDescription(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Month names (shared; used by fmtDate and stats constants) ──

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

// ── Byte / file-size formatting ──

/** Human-readable file size. Returns "0 B" for zero/negative values. */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

// ── Date / number formatting ──

/** Format an AniList date object (from the startDate/endDate fields) to "Mon D, Y". */
export function fmtDate(
  d?: { year: number | null; month: number | null; day: number | null } | null,
): string {
  if (!d || !d.year) return "—";
  const m = d.month ? MONTHS[d.month - 1] : "";
  return `${m ? m + " " : ""}${d.day ? d.day + ", " : ""}${d.year}`;
}

/** Format a number with locale-aware digit grouping; returns "—" for null/undefined. */
export function fmtNum(n?: number | null): string {
  return n == null ? "—" : n.toLocaleString();
}

/** Format a Unix-timestamp (seconds) into a human "Xm ago" / "Xd ago" string. */
export function timeAgo(timestamp: number): string {
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 0) return "Just now";
  if (diff < 60) return "Just now";
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** Title-case an AniList enum like "TV_SHORT" → "TV Short". */
export function humanizeEnum(v: string | null | undefined): string {
  if (!v) return "";
  return v
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Resolve the best human-readable title from a media-like object that has
 * `title.english` / `title.romaji` (nullable), with an optional fallback.
 */
export function titleOf(
  m:
    | {
        title?: {
          english?: string | null;
          romaji?: string | null;
        } | null;
      }
    | null
    | undefined,
  fallback = "Unknown",
): string {
  return m?.title?.english || m?.title?.romaji || fallback;
}

/** Default episode duration in minutes (used when metadata is missing). */
export const DEFAULT_EPISODE_DURATION = 24;

/** Countdown string from seconds. */
export function countdown(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Hover glow effect used by AiringCard components. */
export function hoverGlow(
  color: string,
  isHovered: boolean,
): React.CSSProperties {
  return {
    borderColor: isHovered ? `${color}40` : "rgba(255,255,255,0.05)",
    boxShadow: isHovered
      ? `0 0 25px ${color}15, inset 0 0 12px ${color}08`
      : "none",
  };
}
