// Rich AniList detail (Phase 3) — superset of AniListMedia used on detail pages.
import type { AniListMedia } from "./anilist";

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
