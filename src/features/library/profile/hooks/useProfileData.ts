import { useEffect, useState } from "react";
import { fetchViewer, fetchMediaList } from "../api";
import type { OnlineEntry, ViewerProfile } from "../types";

export function useProfileData(anilistUser: any) {
  const [profile, setProfile] = useState<ViewerProfile | null>(null);
  const [onlineEntries, setOnlineEntries] = useState<OnlineEntry[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const fetchProfileAndList = async (silent?: boolean) => {
    if (!anilistUser) return;
    if (!silent) {
      setLoadingProfile(true);
    }
    try {
      // Fetch viewer details + online favorites
      const profileResp = await fetchViewer();
      const viewer = profileResp?.data?.Viewer;
      if (viewer) {
        setProfile(viewer);

        // Fetch entire media list collection (Anime)
        const listResp = await fetchMediaList(viewer.id);

        const lists = listResp?.data?.MediaListCollection?.lists || [];
        const allEntries: OnlineEntry[] = [];
        lists.forEach((list: any) => {
          if (list?.entries) {
            allEntries.push(...list.entries);
          }
        });
        setOnlineEntries(allEntries);
      }
    } catch (e) {
      console.warn("Failed to fetch online AniList profile statistics", e);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchProfileAndList();
  }, [anilistUser]);

  return { profile, onlineEntries, loadingProfile, refetch: fetchProfileAndList };
}
