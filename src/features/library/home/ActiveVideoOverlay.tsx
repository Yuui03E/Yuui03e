import { usePlayerSession } from "../../../components/player/usePlayerSession";
import VideoPlayerOverlay from "../../../components/VideoPlayerOverlay";
import type { ActiveVideo } from "../../../lib/types/video";
import type { StoredEntry } from "../../../lib/types";

interface ActiveVideoOverlayProps {
  activeVideo: ActiveVideo | null;
  playerEntry: StoredEntry | null;
  entries: StoredEntry[];
  onClose: () => void;
  onSetActiveVideo: (v: ActiveVideo | null) => void;
  onSaveProgress: (episode: number, status: string) => Promise<void>;
}

export function ActiveVideoOverlay({
  activeVideo,
  playerEntry,
  entries,
  onClose,
  onSetActiveVideo,
  onSaveProgress,
}: ActiveVideoOverlayProps) {
  const playerSession = usePlayerSession({
    entry: playerEntry ?? entries[0],
    activeVideo: activeVideo ?? { path: "", episode: 0, title: "" },
    onClose,
    onSetActiveVideo,
    onSaveProgress,
  });

  if (!activeVideo || !playerEntry) return null;

  return (
    <VideoPlayerOverlay
      filePath={activeVideo.path}
      episodeNumber={activeVideo.episode}
      title={activeVideo.title}
      seriesKey={playerEntry.key}
      hasNextEpisode={playerSession.hasNextEpisode}
      onPlayNext={playerSession.onPlayNext}
      onWatched={playerSession.onWatched}
      onClose={playerSession.onClosePlayer}
    />
  );
}
