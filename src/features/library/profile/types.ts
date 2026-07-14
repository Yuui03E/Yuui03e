export interface ViewerProfile {
  id: number;
  name: string;
  avatar: { large: string };
  bannerImage: string | null;
  favourites?: {
    anime: {
      nodes: {
        id: number;
        title: { english: string | null; romaji: string };
        coverImage: { medium: string; large: string };
        format?: string;
        episodes?: number;
      }[];
    };
    characters: {
      nodes: {
        id: number;
        name: { full: string };
        image: { large: string; medium: string };
      }[];
    };
  };
}

export interface OnlineEntry {
  id: number;
  status: string;
  score: number;
  progress: number;
  media: {
    id: number;
    title: { english: string | null; romaji: string };
    coverImage: { medium: string; large: string };
    format: string;
    episodes: number | null;
    duration: number | null;
    genres: string[];
    countryOfOrigin: string;
  };
}
