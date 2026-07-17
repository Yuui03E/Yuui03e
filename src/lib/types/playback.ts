// Playback history types — every other DTO lives in src/lib/types/.

export interface PlaybackHistoryEntry {
  file_path: string;
  series_key: string | null;
  episode: number | null;
  title: string | null;
  position: number;
  duration: number;
}
