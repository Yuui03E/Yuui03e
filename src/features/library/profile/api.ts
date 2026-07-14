import { toAniListStatus } from "../../../lib/anilistStatus";

type GraphqlAnilist = (query: string, variables: Record<string, any>) => Promise<any>;

// GraphQL query helper to sync details to AniList list
export const syncAllToAnilist = async (
  graphqlAnilist: GraphqlAnilist,
  mediaId: number,
  progress: number,
  status: string,
  score: number,
) => {
  try {
    await graphqlAnilist(
      `mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus, $score: Float) {
          SaveMediaListEntry (mediaId: $mediaId, progress: $progress, status: $status, score: $score) {
            id
            progress
            status
            score
          }
        }`,
      { mediaId, progress, status: toAniListStatus(status), score }
    );
  } catch (e) {
    console.error("Failed to sync media list entry to AniList", e);
  }
};

// Fetch viewer details + online favorites
export const fetchViewer = (graphqlAnilist: GraphqlAnilist) =>
  graphqlAnilist(
    `query {
          Viewer {
            id
            name
            avatar { large }
            bannerImage
            favourites {
              anime {
                nodes {
                  id
                  title { english romaji }
                  coverImage { medium large }
                  format
                  episodes
                }
              }
              characters {
                nodes {
                  id
                  name { full }
                  image { large medium }
                }
              }
            }
          }
        }`,
    {}
  );

// Fetch entire media list collection (Anime)
export const fetchMediaList = (graphqlAnilist: GraphqlAnilist, userId: number) =>
  graphqlAnilist(
    `query ($userId: Int) {
            MediaListCollection (userId: $userId, type: ANIME) {
              lists {
                entries {
                  id
                  status
                  score (format: POINT_10)
                  progress
                  media {
                    id
                    title { english romaji }
                    coverImage { medium large }
                    format
                    episodes
                    duration
                    genres
                    countryOfOrigin
                  }
                }
              }
            }
          }`,
    { userId }
  );

// Global search query
export const searchGlobalMedia = (graphqlAnilist: GraphqlAnilist, search: string) =>
  graphqlAnilist(
    `query ($search: String) {
          Page (perPage: 12) {
            media (search: $search, type: ANIME) {
              id
              title { english romaji }
              coverImage { large }
              format
              episodes
              averageScore
            }
          }
        }`,
    { search }
  );

// Add-media mutation
export const addMediaEntry = (
  graphqlAnilist: GraphqlAnilist,
  mediaId: number,
  progress: number,
  status: string,
  score: number,
) =>
  graphqlAnilist(
    `mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus, $score: Float) {
          SaveMediaListEntry (mediaId: $mediaId, progress: $progress, status: $status, score: $score) {
            id
          }
        }`,
    { mediaId, progress, status, score }
  );

export const fetchUserActivities = (graphqlAnilist: GraphqlAnilist, userId: number, page: number = 1) =>
  graphqlAnilist(
    `query ($userId: Int, $page: Int) {
      Page (page: $page, perPage: 15) {
        pageInfo {
          hasNextPage
        }
        activities (userId: $userId, type_in: [ANIME_LIST, TEXT], sort: ID_DESC) {
          __typename
          ... on ListActivity {
            id
            type
            status
            progress
            createdAt
            likeCount
            replyCount
            media {
              id
              title {
                romaji
                english
                userPreferred
              }
              coverImage {
                large
                medium
              }
            }
          }
          ... on TextActivity {
            id
            type
            text
            createdAt
            likeCount
            replyCount
            user {
              id
              name
              avatar {
                medium
              }
            }
          }
        }
      }
    }`,
    { userId, page }
  );

export const deleteMediaEntry = (graphqlAnilist: GraphqlAnilist, id: number) =>
  graphqlAnilist(
    `mutation ($id: Int) {
      DeleteMediaListEntry (id: $id) {
        deleted
      }
    }`,
    { id }
  );

