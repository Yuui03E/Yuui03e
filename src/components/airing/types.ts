// Card-local shape for an airing episode. Intentionally NOT reconciled with
// lib/types — this is only what AiringCard and its variants consume.
export interface AiringEpisode {
  id: number;
  airingAt: number;
  episode: number;
  media: {
    id: number;
    title: { romaji: string | null; english: string | null; native: string | null };
    coverImage: {
      extraLarge: string | null;
      large: string | null;
      color: string | null;
    };
    bannerImage: string | null;
    format: string | null;
    season: string | null;
    seasonYear: number | null;
    favourites: number | null;
    genres: string[];
    averageScore: number | null;
    description: string | null;
    episodes: number | null;
    studios: {
      nodes: { id: number; name: string }[];
    } | null;
  };
}
