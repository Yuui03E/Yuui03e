import { useCallback } from "react";
import type { StoredEntry } from "../../lib/types";

import type { ActiveVideo } from "../../lib/types/video";

interface UsePlayerSessionOptions {
  entry: StoredEntry | undefined;
  activeVideo: ActiveVideo;
  onClose: () => void;
  onSetActiveVideo: (v: ActiveVideo | null) => void;
  onSaveProgress: (episode: number, status: string) => Promise<void>;
}

interface UsePlayerSessionResult {
  hasNextEpisode: boolean;
  onPlayNext: () => void;
  onWatched: () => Promise<void>;
  onClosePlayer: () => void;
}

/**
 * Owns the `hasNextEpisode` / `onPlayNext` / `onWatched` handlers for
 * `VideoPlayerOverlay`. Extracted from the identical player wiring in
 * LibraryPage and DetailPage.
 */
export function usePlayerSession({
  entry,
  activeVideo,
  onClose,
  onSetActiveVideo,
  onSaveProgress,
}: UsePlayerSessionOptions): UsePlayerSessionResult {
  // When no entry is selected (empty library, no active video) we still need
  // a stable return shape so callers don't crash. The callbacks are no-ops in
  // this state — they only ever fire while a video is actually playing.
  const hasEntry = !!entry;
  const maxEpisodes = entry?.media?.episodes ?? entry?.episode_count ?? 0;

  const hasNextEpisode = hasEntry && activeVideo.episode < maxEpisodes;

  const onPlayNext = useCallback(() => {
    if (!entry) return;
    const nextEp = activeVideo.episode + 1;
    const nextFile = entry.files.find((f: any) => f.episode === nextEp);
    if (nextFile) {
      onSetActiveVideo({
        path: nextFile.path,
        episode: nextEp,
        title: nextFile.title || `${entry.title} - Episode ${nextEp}`,
      });
    } else {
      onSetActiveVideo(null);
    }
  }, [activeVideo.episode, entry, onSetActiveVideo]);

  const onWatched = useCallback(async () => {
    if (!entry) return;
    const baseUser = entry.user ?? {
      status: null,
      score: null,
      progress: 0,
      notes: null,
      favorite: false,
    };
    const currentProgress = baseUser.progress ?? 0;
    const isCompleted =
      activeVideo.episode === maxEpisodes &&
      (!entry.media || entry.media.status === "FINISHED");
    const newStatus = isCompleted ? "Completed" : baseUser.status || "Watching";

    if (activeVideo.episode > currentProgress) {
      await onSaveProgress(activeVideo.episode, newStatus);
    }
  }, [activeVideo.episode, entry, maxEpisodes, onSaveProgress]);

  return {
    hasNextEpisode,
    onPlayNext,
    onWatched,
    onClosePlayer: onClose,
  };
}
