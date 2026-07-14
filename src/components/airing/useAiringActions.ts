import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLibrary } from "../../store/library";
import { graphqlAnilist } from "../../lib/api";
import { toAniListStatus } from "../../lib/anilistStatus";
import type { AiringEpisode } from "./types";

// handleSetStatus / handleToggleFavorite / handleNavigate + favorite & toast
// state. Reads anilistUser/entries from useLibrary and calls graphqlAnilist.
// ep is passed in so the handlers always read the current episode.
export function useAiringActions(ep: AiringEpisode) {
  const navigate = useNavigate();
  const { anilistUser, entries } = useLibrary();
  const [isFavorited, setIsFavorited] = useState(false);
  const [favCount, setFavCount] = useState(ep.media.favourites ?? 0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleNavigate = () => {
    const local = entries.find((e) => e.media?.id === ep.media.id && e.files && e.files.length > 0);
    const key = local ? local.key : `anilist:${ep.media.id}`;
    navigate(`/anime/${encodeURIComponent(key)}`);
  };

  const handleSetStatus = async (status: string) => {
    if (!anilistUser) {
      triggerToast("Please connect your AniList account first");
      return;
    }
    try {
      await graphqlAnilist(
        `mutation ($mediaId: Int, $status: MediaListStatus) {
          SaveMediaListEntry (mediaId: $mediaId, status: $status) {
            id
            status
          }
        }`,
        { mediaId: ep.media.id, status: toAniListStatus(status) }
      );
      triggerToast(`Added to ${status}`);
    } catch (e) {
      console.error(e);
      triggerToast("Failed to update status on AniList");
    }
  };

  const handleToggleFavorite = async () => {
    if (!anilistUser) {
      triggerToast("Please connect your AniList account first");
      return;
    }
    try {
      await graphqlAnilist(
        `mutation ($mediaId: Int) {
          ToggleFavourite (animeId: $mediaId) {
            anime {
              id
            }
          }
        }`,
        { mediaId: ep.media.id }
      );
      setIsFavorited(!isFavorited);
      setFavCount((c) => (isFavorited ? c - 1 : c + 1));
      triggerToast(isFavorited ? "Removed from Favorites" : "Added to Favorites");
    } catch (e) {
      console.error(e);
      triggerToast("Failed to update favorites");
    }
  };

  return {
    isFavorited,
    favCount,
    toastMsg,
    handleNavigate,
    handleSetStatus,
    handleToggleFavorite,
  };
}
