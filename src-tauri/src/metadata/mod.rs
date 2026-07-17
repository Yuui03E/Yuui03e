//! Metadata resolver.
//!
//! Orchestrates AniList searches with incremental progress, cancel/pause support,
//! and title-scoring heuristics. Sub-modules handle the HTTP client and scoring.

use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::Emitter;

use crate::parser;
use crate::scanner::ScannedSeries;

mod anilist_client;
mod scoring;

// ─── Library Entry ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct LibraryEntry {
    pub key: String,
    pub scanned: ScannedSeries,
    pub media: Option<serde_json::Value>,
    pub confidence: f64,
    pub matched: bool,
}

// ─── Progress event ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct SearchProgress {
    pub current: usize,
    pub total: usize,
    pub title: String,
    pub status: String, // "searching", "matched", "not_found", "cached", "error"
    pub message: Option<String>,
}

// ─── Search query building ──────────────────────────────────────────────────

/// Build the ordered list of search queries for a scanned series, from most
/// specific to least specific.
fn build_search_queries(series: &ScannedSeries) -> Vec<String> {
    let mut queries: Vec<String> = Vec::new();

    // Attempt 1: Original title as-is
    queries.push(series.title.clone());

    // Attempt 2: Search-normalized title (suffix stripped, chars collapsed)
    let search_norm = parser::normalize_for_search(&series.title);
    if search_norm != series.title && !search_norm.is_empty() {
        queries.push(search_norm);
    }

    // Attempt 3: Title with common suffixes stripped
    let (stripped, was_stripped) = parser::strip_common_suffixes(&series.title);
    if was_stripped && !stripped.is_empty() && !queries.contains(&stripped) {
        queries.push(stripped);
    }

    // Attempt 4: Folder name (if different from parsed title)
    let folder_title = series.folder.clone();
    if !folder_title.is_empty()
        && parser::normalize_title(&folder_title) != parser::normalize_title(&series.title)
        && !queries.iter().any(|q| parser::normalize_title(q) == parser::normalize_title(&folder_title))
    {
        queries.push(folder_title);
    }

    // Attempt 5: Shortened title (first 3 words) for very long titles
    let words: Vec<&str> = series.title.split_whitespace().collect();
    if words.len() > 4 {
        let short = words[..3].join(" ");
        if !queries.contains(&short) {
            queries.push(short);
        }
    }

    // Deduplicate by normalized form
    let mut seen_norms = std::collections::HashSet::new();
    queries.retain(|q| {
        let n = parser::normalize_title(q);
        !n.is_empty() && seen_norms.insert(n)
    });

    queries
}

// ─── Matching orchestration ─────────────────────────────────────────────────

/// Incremental match with progress events, token auth, cancel, and pause support.
pub async fn match_series_with_progress(
    series: Vec<ScannedSeries>,
    app: &tauri::AppHandle,
    token: Option<String>,
    manual_matches: HashMap<String, serde_json::Value>,
    cancel_flag: Arc<AtomicBool>,
    pause_flag: Arc<AtomicBool>,
) -> Result<Vec<LibraryEntry>, String> {
    let total = series.len();
    let mut out = Vec::with_capacity(total);
    let token_ref = token.as_deref();

    for (i, s) in series.into_iter().enumerate() {
        // Check cancel
        if cancel_flag.load(Ordering::Relaxed) {
            let _ = app.emit(
                "sync:searching",
                SearchProgress {
                    current: i + 1,
                    total,
                    title: s.title.clone(),
                    status: "cancelled".to_string(),
                    message: Some("Search cancelled by user".to_string()),
                },
            );
            break;
        }

        // Check pause — spin-wait until unpaused or cancelled
        while pause_flag.load(Ordering::Relaxed) && !cancel_flag.load(Ordering::Relaxed) {
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
        if cancel_flag.load(Ordering::Relaxed) {
            break;
        }

        let key = parser::normalize_title(&s.title);

        // If this series already has a manual match, use the cached media JSON
        if let Some(media_val) = manual_matches.get(&key) {
            let entry = LibraryEntry {
                key: key.clone(),
                scanned: s,
                media: Some(media_val.clone()),
                confidence: 1.0,
                matched: true,
            };

            let _ = app.emit(
                "sync:searching",
                SearchProgress {
                    current: i + 1,
                    total,
                    title: entry.scanned.title.clone(),
                    status: "matched".to_string(),
                    message: None,
                },
            );

            out.push(entry);
            continue;
        }

        // Emit "searching" event
        let _ = app.emit(
            "sync:searching",
            SearchProgress {
                current: i + 1,
                total,
                title: s.title.clone(),
                status: "searching".to_string(),
                message: None,
            },
        );

        // --- Multi-query retry strategy ---
        let search_queries = build_search_queries(&s);

        let threshold = scoring::adaptive_threshold(&key);
        let mut best_confidence = 0.0_f64;
        let mut best_media: Option<anilist_client::AniListMedia> = None;
        let mut last_err: Option<String> = None;

        for query in &search_queries {
            if cancel_flag.load(Ordering::Relaxed) {
                break;
            }

            let (results, err) =
                anilist_client::anilist_search_with_retry(query, token_ref, Some(&cancel_flag)).await;

            if let Some(ref e) = err {
                last_err = Some(e.clone());
            }

            if cancel_flag.load(Ordering::Relaxed) {
                break;
            }

            // Score all results against the ORIGINAL title
            let candidate = results
                .into_iter()
                .map(|m| {
                    let sc = scoring::score(&s.title, &m);
                    (sc, m)
                })
                .max_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

            if let Some((sc, m)) = candidate {
                if sc > best_confidence {
                    best_confidence = sc;
                    best_media = Some(m);
                }
                if best_confidence >= threshold {
                    last_err = None;
                    break;
                }
            }
        }

        if cancel_flag.load(Ordering::Relaxed) {
            break;
        }

        let matched = best_confidence >= threshold;

        let status_str = if last_err.is_some() {
            "error"
        } else if matched {
            "matched"
        } else if best_media.is_some() {
            "low_confidence"
        } else {
            "not_found"
        };

        let entry = LibraryEntry {
            key: key.clone(),
            scanned: s,
            media: best_media.map(|m| m.to_frontend()),
            confidence: best_confidence,
            matched,
        };

        let _ = app.emit(
            "sync:searching",
            SearchProgress {
                current: i + 1,
                total,
                title: entry.scanned.title.clone(),
                status: status_str.to_string(),
                message: last_err.clone(),
            },
        );

        out.push(entry);
    }

    Ok(out)
}

/// Free-text AniList search returning frontend-shaped media objects.
pub async fn search_frontend(query: &str) -> Result<Vec<serde_json::Value>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }
    let list = anilist_client::anilist_search(query).await?;
    Ok(list.iter().map(|m| m.to_frontend()).collect())
}

/// Fetch the full rich detail for one AniList media id.
pub async fn fetch_detail(media_id: i64, token: Option<String>) -> Result<serde_json::Value, String> {
    anilist_client::fetch_detail_raw(media_id, token).await
}

/// Generic proxy to run AniList GraphQL queries from the Rust backend.
pub async fn query_anilist(
    query: String,
    variables: serde_json::Value,
    token: Option<String>,
) -> Result<serde_json::Value, String> {
    let token_ref = token.as_deref();
    anilist_client::anilist_post(&query, variables, token_ref, None).await
}
