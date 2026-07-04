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

/// Scan `root` recursively and return grouped series.
pub fn scan(root: &str) -> Result<Vec<ScannedSeries>, String> {
    let root_path = std::path::Path::new(root);
    if !root_path.exists() {
        return Err(format!("Folder does not exist: {root}"));
    }

    // group key -> (display title, folder, files)
    let mut groups: BTreeMap<String, ScannedSeries> = BTreeMap::new();

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

        // Decide the grouping title: parsed title, else parent folder.
        let folder = parent_folder_name(&path_str);
        let raw_title = parsed
            .title
            .clone()
            .filter(|t| !t.trim().is_empty())
            .unwrap_or_else(|| folder.clone());
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
