//! Phase 2 — library depth analysis.
//!
//! Pure functions that derive higher-level facts from the persisted data:
//! - **Missing-episode tracker** ("what to buy"): owned vs. expected episodes,
//!   per series and per release group.
//! - **Duplicate detection**: multiple owned files for the same episode.
//! - **Quality-upgrade suggestions**: pick the "best" file per episode by
//!   resolution, prefer newer codecs, and flag lower-quality duplicates.
//!
//! These operate on the `StoredEntry` shape (media JSON + files) so they work
//! entirely from the SQLite store with no extra network calls.

use serde::Serialize;
use serde_json::Value;

/// Parsed view of one owned file (subset used for analysis).
#[derive(Debug, Clone)]
struct FileView {
    path: String,
    episode: Option<i64>,
    release_group: Option<String>,
    resolution: Option<String>,
    codec: Option<String>,
    size_bytes: i64,
}

fn files_from_json(files: &[Value]) -> Vec<FileView> {
    files
        .iter()
        .map(|f| FileView {
            path: f.get("path").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            episode: f.get("episode").and_then(|v| v.as_i64()),
            release_group: f
                .get("release_group")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            resolution: f
                .get("resolution")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            codec: f.get("codec").and_then(|v| v.as_str()).map(|s| s.to_string()),
            size_bytes: f.get("size_bytes").and_then(|v| v.as_i64()).unwrap_or(0),
        })
        .collect()
}

/// Rank a resolution string ("1080p", "720p", "1920x1080"…) to a comparable
/// height in pixels. Unknown → 0.
fn resolution_rank(res: &Option<String>) -> u32 {
    let r = match res {
        Some(r) => r.to_lowercase(),
        None => return 0,
    };
    // "1920x1080" style → take the smaller dimension as height proxy.
    if let Some((a, b)) = r.split_once('x') {
        let a: u32 = a.chars().filter(|c| c.is_ascii_digit()).collect::<String>().parse().unwrap_or(0);
        let b: u32 = b.chars().filter(|c| c.is_ascii_digit()).collect::<String>().parse().unwrap_or(0);
        return a.min(b) / 10 * 10; // normalize a touch
    }
    // "1080p" / "720p" style.
    let digits: String = r.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse().unwrap_or(0)
}

/// Rank a codec: prefer more modern/efficient codecs when resolutions tie.
fn codec_rank(codec: &Option<String>) -> u32 {
    match codec.as_deref().map(|c| c.to_lowercase()) {
        Some(ref c) if c.contains("av1") => 4,
        Some(ref c) if c.contains("265") || c.contains("hevc") => 3,
        Some(ref c) if c.contains("264") || c.contains("avc") => 2,
        Some(ref c) if c.contains("vp9") => 2,
        Some(_) => 1,
        None => 0,
    }
}

/// Compare two files for "which is the better copy of the same episode".
/// Higher resolution wins; then codec; then larger size.
fn better(a: &FileView, b: &FileView) -> std::cmp::Ordering {
    resolution_rank(&a.resolution)
        .cmp(&resolution_rank(&b.resolution))
        .then(codec_rank(&a.codec).cmp(&codec_rank(&b.codec)))
        .then(a.size_bytes.cmp(&b.size_bytes))
}

#[derive(Debug, Clone, Serialize)]
pub struct GroupCoverage {
    pub group: String,
    pub owned_episodes: Vec<i64>,
    pub file_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct DuplicateFile {
    pub episode: i64,
    pub keep: String,       // path of the recommended file
    pub redundant: Vec<String>, // paths of lower-quality duplicates
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct QualityUpgrade {
    pub episode: i64,
    pub current_best_resolution: Option<String>,
    pub note: String,
}

/// Full Phase-2 analysis result for one series.
#[derive(Debug, Clone, Serialize, Default)]
pub struct SeriesAnalysis {
    /// Total episodes expected (from AniList media.episodes), if known.
    pub total_episodes: Option<i64>,
    /// Distinct owned episode numbers, sorted.
    pub owned_episodes: Vec<i64>,
    /// Expected-but-missing episode numbers (1..=total minus owned).
    pub missing_episodes: Vec<i64>,
    /// Files that couldn't be assigned an episode number.
    pub unknown_episode_files: usize,
    /// Per-release-group coverage.
    pub groups: Vec<GroupCoverage>,
    /// Duplicate episodes (more than one owned file for the same ep).
    pub duplicates: Vec<DuplicateFile>,
    /// Episodes whose best owned copy is below the max owned resolution.
    pub upgrades: Vec<QualityUpgrade>,
    /// Highest owned resolution across the series (display convenience).
    pub best_resolution: Option<String>,
    /// Completion 0..=1 (owned distinct eps / total). None if total unknown.
    pub completion: Option<f64>,
}

/// Extract `media.episodes` from the stored media JSON, if present.
fn total_episodes_from_media(media: &Option<Value>) -> Option<i64> {
    media
        .as_ref()
        .and_then(|m| m.get("episodes"))
        .and_then(|v| v.as_i64())
        .filter(|n| *n > 0)
}

/// Analyze one series from its media JSON + owned files JSON.
pub fn analyze(media: &Option<Value>, files_json: &[Value]) -> SeriesAnalysis {
    let files = files_from_json(files_json);
    let total_episodes = total_episodes_from_media(media);

    // Distinct owned episodes.
    let mut owned: Vec<i64> = files.iter().filter_map(|f| f.episode).collect();
    owned.sort_unstable();
    owned.dedup();

    let unknown_episode_files = files.iter().filter(|f| f.episode.is_none()).count();

    // Missing = expected minus owned (only meaningful if total known).
    let missing_episodes = match total_episodes {
        Some(total) => (1..=total).filter(|e| !owned.contains(e)).collect(),
        None => Vec::new(),
    };

    // Per-group coverage.
    let mut group_map: std::collections::BTreeMap<String, (Vec<i64>, usize)> =
        std::collections::BTreeMap::new();
    for f in &files {
        let g = f.release_group.clone().unwrap_or_else(|| "Unknown".to_string());
        let entry = group_map.entry(g).or_insert_with(|| (Vec::new(), 0));
        entry.1 += 1;
        if let Some(ep) = f.episode {
            if !entry.0.contains(&ep) {
                entry.0.push(ep);
            }
        }
    }
    let groups = group_map
        .into_iter()
        .map(|(group, (mut eps, file_count))| {
            eps.sort_unstable();
            GroupCoverage {
                group,
                owned_episodes: eps,
                file_count,
            }
        })
        .collect();

    // Group files by episode to find duplicates + best copy.
    let mut by_ep: std::collections::BTreeMap<i64, Vec<&FileView>> =
        std::collections::BTreeMap::new();
    for f in &files {
        if let Some(ep) = f.episode {
            by_ep.entry(ep).or_default().push(f);
        }
    }

    let mut duplicates = Vec::new();
    let mut best_res_rank = 0u32;
    let mut best_resolution: Option<String> = None;

    // Track the best resolution per episode to compute upgrade suggestions.
    let mut ep_best_rank: std::collections::BTreeMap<i64, u32> =
        std::collections::BTreeMap::new();

    for (ep, group) in &by_ep {
        // Determine the best file in this episode group.
        let mut sorted = group.clone();
        sorted.sort_by(|a, b| better(a, b));
        let best = *sorted.last().unwrap();

        let best_rank = resolution_rank(&best.resolution);
        ep_best_rank.insert(*ep, best_rank);
        if best_rank > best_res_rank {
            best_res_rank = best_rank;
            best_resolution = best.resolution.clone();
        }

        if group.len() > 1 {
            let redundant: Vec<String> = sorted
                .iter()
                .rev()
                .skip(1)
                .map(|f| f.path.clone())
                .collect();
            duplicates.push(DuplicateFile {
                episode: *ep,
                keep: best.path.clone(),
                redundant,
                reason: format!(
                    "{} copies — keeping {}{}",
                    group.len(),
                    best.resolution.clone().unwrap_or_else(|| "best".into()),
                    best.codec
                        .clone()
                        .map(|c| format!(" {c}"))
                        .unwrap_or_default(),
                ),
            });
        }
    }

    // Upgrade suggestions: any episode whose best copy is below series best.
    let upgrades = ep_best_rank
        .iter()
        .filter(|(_, rank)| best_res_rank > 0 && **rank < best_res_rank)
        .map(|(ep, _)| QualityUpgrade {
            episode: *ep,
            current_best_resolution: by_ep
                .get(ep)
                .and_then(|g| {
                    let mut s = g.clone();
                    s.sort_by(|a, b| better(a, b));
                    s.last().and_then(|f| f.resolution.clone())
                }),
            note: format!(
                "Below your best ({}). Consider upgrading.",
                best_resolution.clone().unwrap_or_else(|| "higher res".into())
            ),
        })
        .collect();

    let completion = match total_episodes {
        Some(total) if total > 0 => {
            let owned_in_range = owned.iter().filter(|e| **e >= 1 && **e <= total).count();
            Some(owned_in_range as f64 / total as f64)
        }
        _ => None,
    };

    SeriesAnalysis {
        total_episodes,
        owned_episodes: owned,
        missing_episodes,
        unknown_episode_files,
        groups,
        duplicates,
        upgrades,
        best_resolution,
        completion,
    }
}
