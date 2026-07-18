// MangaDex API response types (only what we need)

export interface MangaDexManga {
  id: string;
  type: "manga";
  attributes: {
    title: Record<string, string>;
    altTitles: Record<string, string>[];
    description: Record<string, string>;
    status: string;
    year: number | null;
    contentRating: string;
    originalLanguage: string;
    publicationDemographic: string | null;
    availableTranslatedLanguages: string[];
    tags: MangaDexTag[];
    latestUploadedChapter: string | null;
    lastChapter: string | null;
    links?: Record<string, string> | null;
    createdAt?: string;
  };
  relationships: MangaDexRelationship[];
}

export interface MangaDexTag {
  id: string;
  type: "tag";
  attributes: {
    name: Record<string, string>;
    group: string;
  };
}

export interface MangaDexRelationship {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
}

export interface MangaDexChapter {
  id: string;
  type: "chapter";
  attributes: {
    title: string | null;
    volume: string | null;
    chapter: string | null;
    pages: number;
    publishAt: string;
    readableAt: string;
    translatedLanguage: string;
    externalUrl?: string | null;
  };
  relationships: MangaDexRelationship[];
}

export interface MangaDexPage {
  url: string;
  filename: string;
}

export interface SearchResult {
  manga: MangaDexManga[];
  total: number;
}

export interface CoverImage {
  url: string;
  filename: string;
}

export interface MangaDetailResult {
  manga: MangaDexManga;
  coverUrl: string;
}
