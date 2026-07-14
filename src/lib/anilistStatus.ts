// Canonical mapping between the app's display statuses ("Watching", …) and
// AniList's MediaListStatus enum (CURRENT, …). Single source of truth — do not
// re-implement this mapping inline.

/** The app-side track statuses, in canonical display order. */
export const TRACK_STATUSES = [
  "Watching",
  "Completed",
  "Planning",
  "Paused",
  "Dropped",
] as const;

export type TrackStatus = (typeof TRACK_STATUSES)[number];

/** App display status → AniList MediaListStatus enum value. */
export function toAniListStatus(status: string): string {
  switch (status) {
    case "Completed":
      return "COMPLETED";
    case "Planning":
      return "PLANNING";
    case "Paused":
      return "PAUSED";
    case "Dropped":
      return "DROPPED";
    default:
      // "Watching" and anything unrecognized tracks as currently watching.
      return "CURRENT";
  }
}

/** AniList MediaListStatus enum value → app display status. */
export function fromAniListStatus(status: string): string {
  if (status === "CURRENT") return "Watching";
  return status.charAt(0) + status.slice(1).toLowerCase();
}
