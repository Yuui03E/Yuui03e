// Library analysis layer (episode coverage, duplicates, quality upgrades).

export interface GroupCoverage {
  group: string;
  owned_episodes: number[];
  file_count: number;
}

export interface DuplicateFile {
  episode: number;
  keep: string;
  redundant: string[];
  reason: string;
}

export interface QualityUpgrade {
  episode: number;
  current_best_resolution: string | null;
  note: string;
}

export interface SeriesAnalysis {
  total_episodes: number | null;
  owned_episodes: number[];
  missing_episodes: number[];
  unknown_episode_files: number;
  groups: GroupCoverage[];
  duplicates: DuplicateFile[];
  upgrades: QualityUpgrade[];
  best_resolution: string | null;
  completion: number | null;
}
