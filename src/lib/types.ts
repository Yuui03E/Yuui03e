// Shared types between Rust backend and React frontend.

export interface ParsedFile {
  path: string;
  file_name: string;
  title: string | null;
  episode: number | null;
  season: number | null;
  release_group: string | null;
  resolution: string | null;
  codec: string | null;
  crc: string | null;
  ed2k: string | null;
  video_preview: string | null;
  sprite_preview: string | null;
  extension: string;
  size_bytes: number;
}

export interface ScannedSeries {
  /** Best-guess normalized series title used for grouping + matching. */
  title: string;
  folder: string;
  release_groups: string[];
  files: ParsedFile[];
  episode_count: number;
}

export interface AniListTitle {
  romaji: string | null;
  english: string | null;
  native: string | null;
}

export interface AniListCoverImage {
  extraLarge: string | null;
  large: string | null;
  color: string | null;
}

export interface AniListMedia {
  id: number;
  idMal?: number | null;
  title: AniListTitle;
  description: string | null;
  format: string | null;
  status: string | null;
  season: string | null;
  seasonYear: number | null;
  episodes: number | null;
  averageScore: number | null;
  genres: string[];
  coverImage: AniListCoverImage;
  bannerImage: string | null;
}

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
export interface GroupCoverage {
  group: string;
  owned_episodes: number[];
  file_count: number;
}

export interface DuplicateFile {
  episode: number;
  keep: string;
  redundant: string[];
  reason: string;
}

export interface QualityUpgrade {
  episode: number;
  current_best_resolution: string | null;
  note: string;
}

export interface SeriesAnalysis {
  total_episodes: number | null;
  owned_episodes: number[];
  missing_episodes: number[];
  unknown_episode_files: number;
  groups: GroupCoverage[];
  duplicates: DuplicateFile[];
  upgrades: QualityUpgrade[];
  best_resolution: string | null;
  completion: number | null;
}

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

// --- Rich AniList detail (Phase 3) -----------------------------------------

export interface NamedImage {
  id?: number;
  name?: { full: string | null };
  image?: { large: string | null };
}

export interface CharacterEdge {
  role: string | null;
  node: NamedImage;
  voiceActors: NamedImage[];
}

export interface StaffEdge {
  role: string | null;
  node: NamedImage;
}

export interface RelationNode {
  id: number;
  type: string | null;
  format: string | null;
  title: { romaji: string | null; english: string | null };
  coverImage: { extraLarge?: string | null; large: string | null; color: string | null };
}

export interface RelationEdge {
  relationType: string | null;
  node: RelationNode;
}

export interface Recommendation {
  mediaRecommendation: {
    id: number;
    title: { romaji: string | null; english: string | null };
    coverImage: { extraLarge?: string | null; large: string | null; color: string | null };
    averageScore: number | null;
  } | null;
}

export interface MediaTag {
  name: string;
  rank: number | null;
  isMediaSpoiler: boolean;
  category: string | null;
}

export interface AniListMediaDetail extends AniListMedia {
  duration?: number | null;
  meanScore?: number | null;
  popularity?: number | null;
  favourites?: number | null;
  source?: string | null;
  synonyms?: string[];
  trailer?: {
    id: string | null;
    site: string | null;
    thumbnail: string | null;
  } | null;
  tags?: MediaTag[];
  studios?: { nodes: { id: number; name: string }[] };
  startDate?: { year: number | null; month: number | null; day: number | null };
  endDate?: { year: number | null; month: number | null; day: number | null };
  nextAiringEpisode?: {
    airingAt: number;
    timeUntilAiring: number;
    episode: number;
  } | null;
  characters?: { edges: CharacterEdge[] };
  staff?: { edges: StaffEdge[] };
  relations?: { edges: RelationEdge[] };
  recommendations?: { nodes: Recommendation[] };
}
