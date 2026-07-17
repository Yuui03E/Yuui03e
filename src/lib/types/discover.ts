/** AniList anime result used by the Discover feature. */
export interface DiscoverAnime {
  id: number;
  title: { romaji: string | null; english: string | null };
  coverImage: {
    large: string | null;
    extraLarge: string | null;
    color: string | null;
  };
  averageScore: number | null;
  seasonYear: number | null;
  format: string | null;
  description: string | null;
  bannerImage: string | null;
  genres: string[];
  status: string | null;
  episodes: number | null;
  trailer: { id: string | null; site: string | null } | null;
}
