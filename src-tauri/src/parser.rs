//! Filename parser (anitomy-style, simplified).
//!
//! Extracts release group, title, episode, season, resolution, codec, CRC
//! from typical anime release filenames such as:
//!   [Erai-raws] Sousou no Frieren - 12 [1080p][HEVC][AAC][1A2B3C4D].mkv

use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedFile {
    pub path: String,
    pub file_name: String,
    pub title: Option<String>,
    pub episode: Option<u32>,
    pub season: Option<u32>,
    pub release_group: Option<String>,
    pub resolution: Option<String>,
    pub codec: Option<String>,
    pub crc: Option<String>,
    pub ed2k: Option<String>,
    pub extension: String,
    pub size_bytes: u64,
}

static RE_GROUP: Lazy<Regex> = Lazy::new(|| Regex::new(r"^\[([^\]]+)\]").unwrap());
static RE_CRC: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\b([0-9A-F]{8})\b").unwrap());
static RE_RES: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\b(\d{3,4}p|\d{3,4}x\d{3,4})\b").unwrap());
static RE_CODEC: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\b(x264|x265|h\.?264|h\.?265|hevc|avc|av1|vp9)\b").unwrap());
static RE_SEASON: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\bS(?:eason)?\s*0*(\d{1,2})\b").unwrap());
// Episode patterns: "- 12", "E12", "Ep 12", " 12 " (loose)
static RE_EP: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)(?:\bE|\bEp\.?\s*|\-\s*|\s)0*(\d{1,3})(?:v\d)?\b").unwrap());

/// Remove all `[...]` and `(...)` bracket groups from a string.
fn strip_brackets(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut depth = 0i32;
    for ch in s.chars() {
        match ch {
            '[' | '(' => depth += 1,
            ']' | ')' => {
                if depth > 0 {
                    depth -= 1
                }
            }
            _ if depth == 0 => out.push(ch),
            _ => {}
        }
    }
    out
}

/// Normalize a title for grouping / fuzzy matching.
pub fn normalize_title(s: &str) -> String {
    let lower = s.to_lowercase();
    let cleaned: String = lower
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect();
    cleaned.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub fn parse(path: &str, file_name: &str, size_bytes: u64) -> ParsedFile {
    let extension = file_name
        .rsplit('.')
        .next()
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    let stem = match file_name.rfind('.') {
        Some(i) => &file_name[..i],
        None => file_name,
    };

    let release_group = RE_GROUP
        .captures(stem)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().trim().to_string());

    let crc = RE_CRC
        .captures(stem)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_uppercase());

    let resolution = RE_RES
        .captures(stem)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_lowercase());

    let codec = RE_CODEC
        .captures(stem)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_lowercase());

    let season = RE_SEASON
        .captures(stem)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse::<u32>().ok());

    // Work on the bracket-stripped remainder for title + episode.
    let core = strip_brackets(stem);
    let core = core.trim();

    // Episode: prefer a match after a dash if present.
    let episode = extract_episode(core);

    // Title: text before the episode delimiter.
    let title = extract_title(core, &crc);

    ParsedFile {
        path: path.to_string(),
        file_name: file_name.to_string(),
        title,
        episode,
        season,
        release_group,
        resolution,
        codec,
        crc,
        ed2k: None,
        extension,
        size_bytes,
    }
}

fn extract_episode(core: &str) -> Option<u32> {
    // Prefer the "- NN" style which is the most reliable delimiter.
    if let Some(idx) = core.rfind('-') {
        let after = core[idx + 1..].trim();
        let num: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
        if !num.is_empty() {
            if let Ok(n) = num.parse::<u32>() {
                return Some(n);
            }
        }
    }
    RE_EP
        .captures(core)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse::<u32>().ok())
}

fn extract_title(core: &str, crc: &Option<String>) -> Option<String> {
    let mut t = core.to_string();
    if let Some(idx) = t.rfind('-') {
        t = t[..idx].to_string();
    }
    // Drop trailing resolution/codec/crc leftovers.
    if let Some(crc) = crc {
        t = t.replace(crc, "");
    }
    let t = t.trim().trim_matches(|c: char| c == '_' || c == '.').trim();
    if t.is_empty() {
        None
    } else {
        Some(
            t.replace('_', " ")
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" "),
        )
    }
}
