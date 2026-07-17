// Scan/parse layer types (mirror the Rust scanner output).

export interface ParsedFile {
  path: string;
  file_name: string;
  title: string | null;
  episode: number | null;
  season: number | null;
  release_group: string | null;
  resolution: string | null;
  codec: string | null;
  crc: string | null;
  ed2k: string | null;
  video_preview: string | null;
  sprite_preview: string | null;
  extension: string;
  size_bytes: number;
}

export interface ScannedSeries {
  /** Best-guess normalized series title used for grouping + matching. */
  title: string;
  folder: string;
  release_groups: string[];
  files: ParsedFile[];
  episode_count: number;
}
