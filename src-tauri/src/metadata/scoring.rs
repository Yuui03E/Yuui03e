//! Title scoring heuristics for matching scanned series to AniList candidates.

use crate::parser;
use super::anilist_client::AniListMedia;

/// Score a candidate title against the query using normalized similarity.
/// Checks romaji, english, native titles AND synonyms.
/// Applies a substring bonus when the query is an exact substring of a
/// candidate (or vice versa) after normalization.
pub fn score(query: &str, media: &AniListMedia) -> f64 {
    let q = parser::normalize_title(query);
    if q.is_empty() {
        return 0.0;
    }

    // Collect all candidate titles: romaji, english, native + synonyms
    let mut candidates: Vec<&str> = Vec::new();
    if let Some(ref r) = media.title.romaji {
        candidates.push(r);
    }
    if let Some(ref e) = media.title.english {
        candidates.push(e);
    }
    if let Some(ref n) = media.title.native {
        candidates.push(n);
    }
    for syn in &media.synonyms {
        candidates.push(syn);
    }

    let mut best = 0.0_f64;

    for t in &candidates {
        let nt = parser::normalize_title(t);
        if nt.is_empty() {
            continue;
        }

        // Base Jaro-Winkler score
        let jw = strsim::jaro_winkler(&q, &nt);

        // Substring bonus: if one is an exact substring of the other,
        // boost the score (helps with titles like "Eiken" matching "Eiken")
        let substring_bonus = if q == nt {
            0.10 // Exact match bonus
        } else if nt.contains(&q) || q.contains(&*nt) {
            0.05 // Substring match bonus
        } else {
            0.0
        };

        let final_score = (jw + substring_bonus).min(1.0);
        best = best.max(final_score);
    }

    best
}

/// Adaptive confidence threshold for matching.
/// Slightly lowered to work with the multi-query retry strategy.
pub fn adaptive_threshold(normalized_title: &str) -> f64 {
    if normalized_title.len() <= 12 {
        0.88
    } else {
        0.82
    }
}
