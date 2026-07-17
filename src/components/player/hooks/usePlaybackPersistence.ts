import { useRef } from "react";
import {
  savePlaybackPosition,
  getPlaybackPosition,
  deletePlaybackPosition,
} from "../../../lib/api";

export function usePlaybackPersistence({
  filePath,
  episodeNumber,
  title,
  seriesKey,
  videoRef,
  onWatched,
  setCurrentTime,
  setDuration,
  syncTriggered,
  setSyncTriggered,
}: any) {
  // Throttle playback position saves to avoid hammering SQLite on every
  // `timeupdate` event (which fires ~4×/second).
  const lastSaveRef = useRef(0);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    setCurrentTime(curr);

    const dur = videoRef.current.duration || 0;
    if (dur > 0 && curr > 0) {
      // Throttle: save at most once every 5 seconds
      const now = Date.now();
      if (now - lastSaveRef.current >= 5000) {
        lastSaveRef.current = now;
        savePlaybackPosition({
          file_path: filePath,
          series_key: seriesKey ?? null,
          episode: episodeNumber,
          title,
          position: curr,
          duration: dur,
        }).catch((err) =>
          console.error("Failed to save playback position:", err),
        );
      }
    }

    if (dur > 0 && curr / dur >= 0.85 && !syncTriggered) {
      setSyncTriggered(true);
      onWatched();
      // Remove the playback position entry since the episode is watched
      deletePlaybackPosition(filePath).catch((err) =>
        console.error("Failed to delete playback position:", err),
      );
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration || 0;
    setDuration(dur);

    // Restore saved position from SQLite
    getPlaybackPosition(filePath)
      .then((savedTime) => {
        if (savedTime !== null && savedTime > 0 && savedTime < dur - 10) {
          if (videoRef.current) {
            videoRef.current.currentTime = savedTime;
            setCurrentTime(savedTime);
          }
        }
      })
      .catch((err) => console.error("Failed to load playback position:", err));
  };

  return { handleTimeUpdate, handleLoadedMetadata };
}
