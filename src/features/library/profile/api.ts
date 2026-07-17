import { graphqlAnilist, saveMediaListEntry } from "../../../lib/api";

// GraphQL query helper to sync details to AniList list
export const syncAllToAnilist = async (
  mediaId: number,
  progress: number,
  status: string,
  score: number,
) => {
  try {
    await saveMediaListEntry({ mediaId, progress, status, score });
  } catch (e) {
    console.error("Failed to sync media list entry to AniList", e);
  }
};

// Fetch viewer details + online favorites
export const fetchViewer = () =>
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
export const fetchMediaList = (userId: number) =>
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
export const searchGlobalMedia = (search: string) =>
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
  mediaId: number,
  progress: number,
  status: string,
  score: number,
) =>
  saveMediaListEntry({ mediaId, progress, status, score });

export const fetchUserActivities = (userId: number, page: number = 1) =>
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

export const deleteMediaEntry = (id: number) =>
  graphqlAnilist(
    `mutation ($id: Int) {
      DeleteMediaListEntry (id: $id) {
        deleted
      }
    }`,
    { id }
  );
