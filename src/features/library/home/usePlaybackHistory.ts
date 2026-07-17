import { useState } from "react";
import { recentPlayback } from "../../../lib/api";
import type { PlaybackHistoryEntry } from "../../../lib/types";

/** Owns the recent-playback history state + its loader. */
export function usePlaybackHistory() {
  const [playbackHistory, setPlaybackHistory] = useState<PlaybackHistoryEntry[]>([]);

  const loadHistory = async () => {
    try {
      const history = await recentPlayback();
      setPlaybackHistory(history);
    } catch (err) {
      console.error("Failed to load playback history:", err);
    }
  };

  return { playbackHistory, loadHistory };
}
