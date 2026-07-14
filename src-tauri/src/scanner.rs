//! Recursive library scanner.
//!
//! Walks a folder, parses every video file, and groups files into series by
//! their normalized title (falling back to the parent folder name).

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use walkdir::WalkDir;

use crate::parser::{self, ParsedFile};

const VIDEO_EXTS: &[&str] = &[
    "mkv", "mp4", "avi", "m4v", "mov", "wmv", "flv", "webm", "ts", "m2ts",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannedSeries {
    pub title: String,
    pub folder: String,
    pub release_groups: Vec<String>,
    pub files: Vec<ParsedFile>,
    pub episode_count: u32,
}

fn is_video(ext: &str) -> bool {
    VIDEO_EXTS.contains(&ext)
}

fn parent_folder_name(path: &str) -> String {
    std::path::Path::new(path)
        .parent()
        .and_then(|p| p.file_name())
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default()
}

/// Check if a folder name is generic/meaningless and should be skipped
/// when looking for the anime title from the directory structure.
fn is_generic_folder(name: &str) -> bool {
    let lower = name.to_lowercase().trim().to_string();

    // Empty or whitespace-only
    if lower.is_empty() {
        return true;
    }

    // Single character folders (e.g., "m", "a", "x")
    if lower.chars().count() <= 1 {
        return true;
    }

    // Common generic folder patterns
    let generic_patterns = [
        "new folder",
        "temp",
        "tmp",
        "downloads",
        "download",
        "encode",
        "encodes",
        "encoding",
        "output",
        "source",
        "sources",
        "raw",
        "raws",
        "tools",
        "scripts",
        "misc",
        "other",
        "unsorted",
        "to sort",
        "wip",
        "work",
        "batch",
        "completed",
        "complety fine",
        "comparison",
        "cover",
        "covers",
        "bd menu",
        "specials",
        "images",
        "screenlists",
        "official subtitle",
        "official subtitles",
        "official subtitles untouched",
        "bdmv",
        "stream",
        "playlist",
        "clipinf",
        "backup",
    ];

    for pattern in &generic_patterns {
        if lower == *pattern || lower.starts_with(pattern) {
            return true;
        }
    }

    // Patterns like "(F)", "(A)", "(anything)" — single-word in parens
    if lower.starts_with('(') && lower.ends_with(')') && lower.len() <= 5 {
        return true;
    }

    // "New folder (2)", "New folder (3)", etc.
    if lower.starts_with("new folder") {
        return true;
    }

    // Known tool/encoder folder names
    let tool_folders = [
        "hybrid encoder",
        "handbrake",
        "ffmpeg",
        "vapoursynth",
        "avisynth",
        "megui",
        "staxrip",
    ];
    for tool in &tool_folders {
        if lower == *tool {
            return true;
        }
    }

    // Language code folders (2-3 uppercase letters like ENG, RUS, CHI, etc.)
    if lower.len() <= 3 && lower.chars().all(|c| c.is_alphabetic()) {
        return true;
    }

    false
}

/// Walk up the directory tree from a file path to find the best anime title
/// from the folder structure. Skips generic folders and stops at the scan root.
///
/// Returns the best folder name found, or None if all folders are generic
/// or we hit the scan root.
fn find_best_folder_title(file_path: &str, scan_roots: &[String]) -> Option<String> {
    let path = std::path::Path::new(file_path);
    let mut current = path.parent();

    while let Some(dir) = current {
        let dir_str = dir.to_string_lossy().to_string();

        // Stop if we've reached a scan root
        let is_root = scan_roots.iter().any(|root| {
            let root_path = std::path::Path::new(root);
            // Compare canonical-ish paths (case-insensitive on Windows)
            dir_str.eq_ignore_ascii_case(&root_path.to_string_lossy())
        });

        if is_root {
            break;
        }

        if let Some(folder_name) = dir.file_name() {
            let name = folder_name.to_string_lossy().to_string();
            if !is_generic_folder(&name) {
                // Found a meaningful folder name — clean it up
                return Some(clean_folder_title(&name));
            }
        }

        current = dir.parent();
    }

    None
}

/// Clean up a folder name to extract a usable anime title.
/// Strips metadata tags like [year], [cen], (year), source info, etc.
fn clean_folder_title(folder: &str) -> String {
    let mut title = folder.to_string();

    // Remove bracket groups that look like metadata (year, source, censorship)
    // but preserve the core title. We strip ALL [...] and (...) that contain
    // known metadata-like content.
    let metadata_bracket_re = once_cell::sync::Lazy::new(|| {
        regex::Regex::new(
            r"(?i)\s*[\[\(](?:cen|uncen|uncut|raw|bdrip|dvdrip|webdl|bdmv|bd-mv|galan[_\s]?rus[_\s]?raw|\d{3,4}[x-]\d{3,4}|\d{4}(?:\s*-\s*\d{4})?|\d+\s*(?:of|/)\s*\d+(?:\s*\+\s*\d+sp)?|PinkPineapple|complete|batch)[\]\)]\s*",
        ).unwrap()
    });

    // Remove metadata brackets
    title = metadata_bracket_re.replace_all(&title, " ").to_string();

    // Remove leading release group brackets like [Galan], [IDK], [QTS], [Shinkiro]
    let leading_group_re = once_cell::sync::Lazy::new(|| {
        regex::Regex::new(r"^\s*\[[^\]]{1,20}\]\s*").unwrap()
    });
    title = leading_group_re.replace(&title, "").to_string();

    // Replace underscores with spaces
    title = title.replace('_', " ");

    // Collapse whitespace and trim
    title = title.split_whitespace().collect::<Vec<_>>().join(" ");
    title = title
        .trim()
        .trim_matches(|c: char| c == '-' || c == '_' || c == '.')
        .trim()
        .to_string();

    title
}

/// Check if a parsed filename title is generic (e.g., just numeric digits
/// or generic words like "episode 1", "movie 1", "00001").
fn is_generic_title(title: &str) -> bool {
    let t = title.trim().to_lowercase();
    if t.is_empty() {
        return true;
    }

    // Purely numeric (e.g. "00001", "12")
    if t.chars().all(|c| c.is_numeric() || c.is_whitespace() || c == '0' || c == '-') {
        return true;
    }

    // Generic single words
    if t == "episode" || t == "special" || t == "ova" || t == "ona" || t == "movie" {
        return true;
    }

    // Patterns like "episode 01", "ep 01", "part 1"
    let generic_prefixes = ["episode ", "ep ", "part ", "vol ", "volume "];
    for prefix in &generic_prefixes {
        if t.starts_with(prefix) {
            let remainder = &t[prefix.len()..];
            if remainder.chars().all(|c| c.is_numeric() || c.is_whitespace() || c == '0' || c == '-') {
                return true;
            }
        }
    }

    false
}

/// Determine the best title for a scanned file, using both the parsed filename
/// title and the folder structure.
fn best_title_for_file(
    parsed_title: &Option<String>,
    file_path: &str,
    scan_roots: &[String],
) -> String {
    let folder = parent_folder_name(file_path);
    let folder_title = find_best_folder_title(file_path, scan_roots);

    // If we have a parsed title from the filename and it's not generic, use it
    if let Some(ref pt) = parsed_title {
        if !pt.trim().is_empty() && !is_generic_title(pt) {
            return pt.clone();
        }
    }

    // Fall back to the best folder title from the directory tree
    if let Some(ft) = folder_title {
        if !ft.trim().is_empty() {
            return ft;
        }
    }

    // Last resort: direct parent folder
    if !folder.trim().is_empty() && !is_generic_folder(&folder) {
        return folder;
    }

    // Absolute last resort: use the filename itself
    std::path::Path::new(file_path)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default()
}

/// Scan `root` recursively and return grouped series.
pub fn scan_multiple(roots: &[String]) -> Result<Vec<ScannedSeries>, String> {
    let mut groups: BTreeMap<String, ScannedSeries> = BTreeMap::new();

    for root in roots {
        let root_path = std::path::Path::new(root);
        if !root_path.exists() {
            continue;
        }

        if root_path.is_file() {
            let file_name = match root_path.file_name() {
                Some(n) => n.to_string_lossy().to_string(),
                None => continue,
            };
            let ext = file_name
                .rsplit('.')
                .next()
                .map(|s| s.to_lowercase())
                .unwrap_or_default();
            if !is_video(&ext) {
                continue;
            }

            let size = root_path.metadata().map(|m| m.len()).unwrap_or(0);
            let path_str = root_path.to_string_lossy().to_string();
            let parsed = parser::parse(&path_str, &file_name, size);

            let folder = parent_folder_name(&path_str);
            let raw_title = best_title_for_file(&parsed.title, &path_str, roots);
            let key = parser::normalize_title(&raw_title);
            let key = if key.is_empty() {
                parser::normalize_title(&folder)
            } else {
                key
            };

            let series = groups.entry(key).or_insert_with(|| ScannedSeries {
                title: raw_title.clone(),
                folder: folder.clone(),
                release_groups: Vec::new(),
                files: Vec::new(),
                episode_count: 0,
            });

            if let Some(g) = &parsed.release_group {
                if !series.release_groups.contains(g) {
                    series.release_groups.push(g.clone());
                }
            }
            series.files.push(parsed);
        } else {
            for entry in WalkDir::new(root)
                .follow_links(false)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                if !entry.file_type().is_file() {
                    continue;
                }
                let path = entry.path();
                let file_name = match path.file_name() {
                    Some(n) => n.to_string_lossy().to_string(),
                    None => continue,
                };
                let ext = file_name
                    .rsplit('.')
                    .next()
                    .map(|s| s.to_lowercase())
                    .unwrap_or_default();
                if !is_video(&ext) {
                    continue;
                }

                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                let path_str = path.to_string_lossy().to_string();
                let parsed = parser::parse(&path_str, &file_name, size);

                let folder = parent_folder_name(&path_str);
                let raw_title = best_title_for_file(&parsed.title, &path_str, roots);
                let key = parser::normalize_title(&raw_title);
                let key = if key.is_empty() {
                    parser::normalize_title(&folder)
                } else {
                    key
                };

                let series = groups.entry(key).or_insert_with(|| ScannedSeries {
                    title: raw_title.clone(),
                    folder: folder.clone(),
                    release_groups: Vec::new(),
                    files: Vec::new(),
                    episode_count: 0,
                });

                if let Some(g) = &parsed.release_group {
                    if !series.release_groups.contains(g) {
                        series.release_groups.push(g.clone());
                    }
                }
                series.files.push(parsed);
            }
        }
    }

    let mut out: Vec<ScannedSeries> = groups
        .into_values()
        .map(|mut s| {
            s.episode_count = s.files.len() as u32;
            s.files.sort_by_key(|f| f.episode.unwrap_or(u32::MAX));
            s
        })
        .collect();

    out.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    Ok(out)
}

pub fn scan(root: &str) -> Result<Vec<ScannedSeries>, String> {
    scan_multiple(&[root.to_string()])
}