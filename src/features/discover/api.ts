import { graphqlAnilist } from "../../lib/api";
import type { DiscoverAnime } from "../../lib/types/discover";

/**
 * Fetch discover data from AniList with pagination.
 * Builds the correct GraphQL query based on the active filter (genre, tag, search, seasonal, or sort).
 */
export async function fetchDiscoverData(
  sortType: string,
  isSeasonal: boolean,
  pageParam: number,
  season: string,
  year: number,
  search?: string,
  genre?: string,
  tag?: string,
): Promise<DiscoverAnime[]> {
  const query = genre
    ? `query ($page: Int, $genre: String) {
        Page(page: $page, perPage: 24) {
          media(type: ANIME, genre: $genre, sort: POPULARITY_DESC) {
            id
            title { romaji english }
            coverImage { large extraLarge color }
            averageScore
            seasonYear
            format
            description(asHtml: false)
            bannerImage
            genres
            status
            episodes
            trailer { id site }
          }
        }
      }`
    : tag
      ? `query ($page: Int, $tag: String) {
        Page(page: $page, perPage: 24) {
          media(type: ANIME, tag: $tag, sort: POPULARITY_DESC) {
            id
            title { romaji english }
            coverImage { large extraLarge color }
            averageScore
            seasonYear
            format
            description(asHtml: false)
            bannerImage
            genres
            status
            episodes
            trailer { id site }
          }
        }
      }`
      : search
        ? `query ($page: Int, $search: String) {
        Page(page: $page, perPage: 24) {
          media(type: ANIME, search: $search) {
            id
            title { romaji english }
            coverImage { large extraLarge color }
            averageScore
            seasonYear
            format
            description(asHtml: false)
            bannerImage
            genres
            status
            episodes
            trailer { id site }
          }
        }
      }`
        : isSeasonal
          ? `query ($page: Int, $season: MediaSeason, $seasonYear: Int) {
        Page(page: $page, perPage: 24) {
          media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC) {
            id
            title { romaji english }
            coverImage { large extraLarge color }
            averageScore
            seasonYear
            format
            description(asHtml: false)
            bannerImage
            genres
            status
            episodes
            trailer { id site }
          }
        }
      }`
          : `query ($page: Int) {
        Page(page: $page, perPage: 24) {
          media(type: ANIME, sort: ${sortType}) {
            id
            title { romaji english }
            coverImage { large extraLarge color }
            averageScore
            seasonYear
            format
            description(asHtml: false)
            bannerImage
            genres
            status
            episodes
            trailer { id site }
          }
        }
      }`;

  const variables: Record<string, unknown> = { page: pageParam };
  if (genre) {
    variables.genre = genre;
  } else if (tag) {
    variables.tag = tag;
  } else if (search) {
    variables.search = search;
  } else if (isSeasonal) {
    variables.season = season;
    variables.seasonYear = year;
  }

  const data = await graphqlAnilist(query, variables);
  return data?.data?.Page?.media ?? [];
}
