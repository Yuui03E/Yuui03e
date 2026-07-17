import { graphqlAnilist } from "../../lib/api";

export interface AiringEpisode {
  id: number;
  airingAt: number;
  episode: number;
  media: {
    id: number;
    title: { romaji: string | null; english: string | null; native: string | null };
    coverImage: { extraLarge: string | null; large: string | null; color: string | null };
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

const FIELDS_FRAGMENT = `
  fragment Fields on AiringSchedule {
    id
    airingAt
    episode
    media {
      id
      title { romaji english native }
      coverImage { extraLarge large color }
      bannerImage
      format
      season
      seasonYear
      favourites
      genres
      averageScore
      description
      episodes
      studios(isMain: true) {
        nodes {
          id
          name
        }
      }
    }
  }
`;

export async function fetchAiringSchedule(start: number): Promise<AiringEpisode[]> {
  const query = `
    query (
      $start0: Int, $end0: Int,
      $start1: Int, $end1: Int,
      $start2: Int, $end2: Int,
      $start3: Int, $end3: Int,
      $start4: Int, $end4: Int,
      $start5: Int, $end5: Int,
      $start6: Int, $end6: Int
    ) {
      day0: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start0, airingAt_lesser: $end0, sort: TIME) {
          ...Fields
        }
      }
      day1: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start1, airingAt_lesser: $end1, sort: TIME) {
          ...Fields
        }
      }
      day2: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start2, airingAt_lesser: $end2, sort: TIME) {
          ...Fields
        }
      }
      day3: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start3, airingAt_lesser: $end3, sort: TIME) {
          ...Fields
        }
      }
      day4: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start4, airingAt_lesser: $end4, sort: TIME) {
          ...Fields
        }
      }
      day5: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start5, airingAt_lesser: $end5, sort: TIME) {
          ...Fields
        }
      }
      day6: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start6, airingAt_lesser: $end6, sort: TIME) {
          ...Fields
        }
      }
    }
    ${FIELDS_FRAGMENT}
  `;

  const variables: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    variables[`start${i}`] = start + i * 24 * 60 * 60;
    variables[`end${i}`] = start + (i + 1) * 24 * 60 * 60;
  }

  const data = await graphqlAnilist(query, variables);

  const list: AiringEpisode[] = [];
  if (data?.data) {
    for (let i = 0; i < 7; i++) {
      const dayEps = data.data[`day${i}`]?.airingSchedules ?? [];
      list.push(...dayEps);
    }
  }
  return list;
}
