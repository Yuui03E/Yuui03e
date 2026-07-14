// Core AniList media types (cached search-result shape).

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
