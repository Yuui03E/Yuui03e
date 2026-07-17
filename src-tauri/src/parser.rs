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
static RE_CRC: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(?:\[([0-9A-F]{8})\]|\b([0-9A-F]{8})\b)").unwrap()
});
static RE_RES: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\b(\d{3,4}p|\d{3,4}x\d{3,4})\b").unwrap());
static RE_CODEC: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\b(x264|x265|h\.?264|h\.?265|hevc|avc|av1|vp9)\b").unwrap());
static RE_SEASON: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\bS(?:eason)?\s*0*(\d{1,2})\b").unwrap());
// Episode patterns: "- 12", "E12", "Ep 12", " 12 " (loose)
static RE_EP: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)(?:\bE|\bEp\.?\s*|\-\s*|\s)0*(\d{1,3})(?:v\d)?\b").unwrap());

/// Known Japanese honorific suffixes that appear after a dash in titles.
/// These should NOT be treated as episode separators.
static RE_HONORIFIC: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)^(san|kun|chan|sama|sensei|senpai|tan|dono|nee|nii|onee|onii)\b").unwrap()
});

/// Common suffixes appended to anime titles that AniList may not include.
static RE_SUFFIX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\s+(The\s+Animation|The\s+Anime|The\s+Motion\s+Picture|The\s+Movie)\s*$")
        .unwrap()
});

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

/// Strip common distribution suffixes like "The Animation", "The Anime".
/// Returns the title without the suffix and whether a suffix was stripped.
pub fn strip_common_suffixes(title: &str) -> (String, bool) {
    if let Some(m) = RE_SUFFIX.find(title) {
        (title[..m.start()].trim().to_string(), true)
    } else {
        (title.to_string(), false)
    }
}

/// Collapse single-character words that are likely a spaced-out title.
/// e.g. "Ko Ko Ro" → "Kokoro", "D N Angel" → "DN Angel"
/// Only collapses runs of 2+ consecutive single-char words.
pub fn collapse_spaced_chars(title: &str) -> Option<String> {
    let words: Vec<&str> = title.split_whitespace().collect();
    if words.len() < 2 {
        return None;
    }

    // Check if there's at least one run of 2+ consecutive single-char words
    let mut has_run = false;
    let mut run_len = 0;
    for w in &words {
        if w.chars().count() == 1 && w.chars().next().map_or(false, |c| c.is_alphabetic()) {
            run_len += 1;
            if run_len >= 2 {
                has_run = true;
                break;
            }
        } else {
            run_len = 0;
        }
    }

    if !has_run {
        return None;
    }

    // Collapse: merge consecutive single-char words
    let mut result = Vec::new();
    let mut i = 0;
    while i < words.len() {
        if words[i].chars().count() == 1
            && words[i].chars().next().map_or(false, |c| c.is_alphabetic())
        {
            // Start of a potential single-char run
            let mut merged = String::new();
            while i < words.len()
                && words[i].chars().count() == 1
                && words[i].chars().next().map_or(false, |c| c.is_alphabetic())
            {
                merged.push_str(words[i]);
                i += 1;
            }
            result.push(merged);
        } else {
            result.push(words[i].to_string());
            i += 1;
        }
    }

    let collapsed = result.join(" ");
    if collapsed != title {
        Some(collapsed)
    } else {
        None
    }
}

/// Aggressively normalize a title for AniList search.
/// Strips suffixes, collapses spaced chars, removes problematic punctuation.
pub fn normalize_for_search(title: &str) -> String {
    let mut t = title.to_string();

    // Strip common suffixes
    let (stripped, _) = strip_common_suffixes(&t);
    t = stripped;

    // Collapse spaced-out single chars
    if let Some(collapsed) = collapse_spaced_chars(&t) {
        t = collapsed;
    }

    // Clean up: collapse whitespace, trim
    t.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Extract the file extension (lowercased) from a filename, or an empty string
/// when there is no extension.
pub fn file_ext(path: &str) -> String {
    path.rsplit('.').next().map(|s| s.to_lowercase()).unwrap_or_default()
}

pub fn parse(path: &str, file_name: &str, size_bytes: u64) -> ParsedFile {
    let extension = file_ext(file_name);

    let stem = match file_name.rfind('.') {
        Some(i) => &file_name[..i],
        None => file_name,
    };

    let release_group = RE_GROUP
        .captures(stem)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().trim().to_string());

    let crc = RE_CRC.captures(stem).and_then(|c| {
        if let Some(m) = c.get(1) {
            Some(m.as_str().to_uppercase())
        } else if let Some(m) = c.get(2) {
            let s = m.as_str();
            if s.chars().any(|ch| ch.is_ascii_alphabetic()) {
                Some(s.to_uppercase())
            } else {
                None
            }
        } else {
            None
        }
    });

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

    let mut bracket_ep = None;
    static RE_BRACKET_EP: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?:\[|\()0*(\d{1,3})(?:\]|\))").unwrap());
    if let Some(c) = RE_BRACKET_EP.captures(stem) {
        let m = c.get(0).unwrap();
        if m.start() > 0 {
            bracket_ep = c.get(1).and_then(|m| m.as_str().parse::<u32>().ok());
        }
    }

    // Work on the bracket-stripped remainder for title + episode.
    let core = strip_brackets(stem);
    let core = core.trim();

    // Episode: prefer a match after a dash if present.
    let mut episode = extract_episode(core);
    if episode.is_none() {
        episode = bracket_ep;
    }
    if episode.is_none() {
        let numeric_only: String = core.chars().filter(|c| c.is_ascii_digit()).collect();
        if !numeric_only.is_empty() && numeric_only.len() == core.trim().len() {
            episode = numeric_only.parse::<u32>().ok();
        }
    }

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

/// Check if the text after a dash is a Japanese honorific (not an episode number).
fn is_honorific_after_dash(after_dash: &str) -> bool {
    RE_HONORIFIC.is_match(after_dash.trim())
}

/// Check if a dash is part of a title (e.g. "25-sai", "Re-Zero") rather than
/// an episode separator. A dash is a title-dash if the text after it starts
/// with alphabetic characters (not digits).
fn is_title_dash(after_dash: &str) -> bool {
    let trimmed = after_dash.trim();
    if trimmed.is_empty() {
        return false;
    }
    let first = trimmed.chars().next().unwrap();
    // If it starts with a letter, it's part of the title (e.g. "-sai", "-san")
    // If it starts with a digit, it's likely an episode number
    first.is_alphabetic() || is_honorific_after_dash(trimmed)
}

fn extract_episode(core: &str) -> Option<u32> {
    // Prefer the " - NN" style (dash with space before it) which is the most
    // reliable delimiter for standard release filenames.
    // We scan from the RIGHT to find the last suitable episode-dash.
    let bytes = core.as_bytes();
    let mut best_episode: Option<u32> = None;

    // Find all dash positions and check from rightmost
    let dash_positions: Vec<usize> = core
        .char_indices()
        .filter(|(_, c)| *c == '-')
        .map(|(i, _)| i)
        .collect();

    for &idx in dash_positions.iter().rev() {
        let after = &core[idx + 1..];
        let after_trimmed = after.trim();

        // Skip if text after dash is a known honorific or starts with a letter
        if is_title_dash(after) {
            continue;
        }

        // Extract digits after the dash
        let num: String = after_trimmed
            .chars()
            .take_while(|c| c.is_ascii_digit())
            .collect();

        if !num.is_empty() {
            if let Ok(n) = num.parse::<u32>() {
                // Sanity check: episode numbers are typically < 2000
                if n < 2000 {
                    // Prefer " - NN" (with space before dash) over "Title-NN"
                    let has_space_before = idx > 0 && bytes[idx - 1] == b' ';
                    if has_space_before || best_episode.is_none() {
                        best_episode = Some(n);
                        if has_space_before {
                            return best_episode; // Highest confidence
                        }
                    }
                }
            }
        }
    }

    if best_episode.is_some() {
        return best_episode;
    }

    // Fallback to regex patterns (E12, Ep12, etc.)
    RE_EP.captures(core).and_then(|c| {
        let m = c.get(1)?;
        let val = m.as_str().parse::<u32>().ok()?;

        // Reject matches whose digits are a substring of a 4-digit (or larger) number.
        // Scan left and right from the match to find the full contiguous sequence of digits.
        let start = m.start();
        let end = m.end();
        let bytes = core.as_bytes();

        let mut l = start;
        while l > 0 && bytes[l - 1].is_ascii_digit() {
            l -= 1;
        }
        let mut r = end;
        while r < bytes.len() && bytes[r].is_ascii_digit() {
            r += 1;
        }

        if r - l >= 4 {
            return None;
        }

        Some(val)
    })
}

fn extract_title(core: &str, crc: &Option<String>) -> Option<String> {
    let mut t = core.to_string();

    // Find the episode-separator dash (the last dash that leads to digits,
    // skipping dashes that are part of the title like "-sai", "-san").
    let mut split_idx: Option<usize> = None;

    let dash_positions: Vec<usize> = t
        .char_indices()
        .filter(|(_, c)| *c == '-')
        .map(|(i, _)| i)
        .collect();

    for &idx in dash_positions.iter().rev() {
        let after = &t[idx + 1..];
        if is_title_dash(after) {
            continue;
        }
        let after_trimmed = after.trim();
        let num: String = after_trimmed
            .chars()
            .take_while(|c| c.is_ascii_digit())
            .collect();
        if !num.is_empty() {
            if let Ok(n) = num.parse::<u32>() {
                if n < 2000 {
                    split_idx = Some(idx);
                    break;
                }
            }
        }
    }

    if let Some(idx) = split_idx {
        t = t[..idx].to_string();
    }

    // Drop trailing resolution/codec/crc leftovers.
    if let Some(crc) = crc {
        let c_l = crc.to_lowercase();
        let c_u = crc.to_uppercase();
        t = t.replace(&c_l, "").replace(&c_u, "");
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_movie_2020() {
        let parsed = parse("path/to/Movie 2020.mkv", "Movie 2020.mkv", 100);
        assert_eq!(parsed.episode, None);
    }

    #[test]
    fn test_parse_crc() {
        let p1 = parse("path/to/[Group] Title [ABCDEF01].mkv", "[Group] Title [ABCDEF01].mkv", 100);
        assert_eq!(p1.crc, Some("ABCDEF01".to_string()));
        assert_eq!(p1.title, Some("Title".to_string()));

        let p2 = parse("path/to/[Group] Title abcdef01.mkv", "[Group] Title abcdef01.mkv", 100);
        assert_eq!(p2.crc, Some("ABCDEF01".to_string()));
        assert_eq!(p2.title, Some("Title".to_string()));

        let p3 = parse("path/to/[Group] Title 20260715.mkv", "[Group] Title 20260715.mkv", 100);
        assert_eq!(p3.crc, None);
    }

    #[test]
    fn test_parse_bracket_ep() {
        let p1 = parse("path/to/Title [01].mkv", "Title [01].mkv", 100);
        assert_eq!(p1.episode, Some(1));

        let p2 = parse("path/to/Title [12].mkv", "Title [12].mkv", 100);
        assert_eq!(p2.episode, Some(12));

        let p3 = parse("path/to/[123] Title.mkv", "[123] Title.mkv", 100);
        assert_eq!(p3.episode, None);
        assert_eq!(p3.release_group, Some("123".to_string()));
    }
}

