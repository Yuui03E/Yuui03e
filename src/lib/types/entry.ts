// User-persisted data + the fully-hydrated stored entry.
import type { AniListMediaDetail } from "./anilistDetail";
import type { ParsedFile } from "./scan";
import type { SeriesAnalysis } from "./analysis";

/** Persisted user data for a series (watch status, score, notes, favorite). */
export interface UserData {
  status: string | null;
  score: number | null;
  progress: number;
  notes: string | null;
  favorite: boolean;
}

/**
 * A fully-hydrated entry read back from the SQLite store. `media` is either the
 * cached AniList search result or, on a detail page, the rich detail payload
 * (superset of AniListMedia — extra fields are accessed loosely).
 */
export interface StoredEntry {
  key: string;
  title: string;
  folder: string;
  release_groups: string[];
  episode_count: number;
  confidence: number;
  matched: boolean;
  manual: boolean;
  media: AniListMediaDetail | null;
  user: UserData;
  files: ParsedFile[];
  analysis: SeriesAnalysis;
}
