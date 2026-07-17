//! TMDB backdrop resolver.
//!
//! AniList exposes only a single `bannerImage` per anime, and it is frequently
//! null (in which case the UI falls back to a portrait cover stretched across a
//! landscape background — the \"poor quality\" case). TMDB, by contrast, exposes
//! *multiple* true landscape backdrops per title, usually at 1920×1080 or
//! higher. This module matches an AniList title → TMDB id and returns the list
//! of full-resolution backdrop URLs, sorted best-first.
//!
//! Requires a free TMDB API key stored in settings under `tmdb_api_key`. When
//! no key is configured the caller gracefully returns an empty list and the UI
//! keeps using the AniList banner.

use crate::parser;

const TMDB_URL: &str = "https://api.themoviedb.org/3";
/// `original` is TMDB's un-resized source image — the highest quality available.
const IMAGE_BASE: &str = "https://image.tmdb.org/t/p/original";

/// Shortcut to the global reqwest client.
fn client() -> &'static reqwest::Client {
    crate::http_client()
}

/// Validate a TMDB v3 API key by calling the lightweight `/configuration`
/// endpoint. Returns `Ok(())` if the key is accepted, or a human-readable error
/// (invalid key, network failure, etc.).
pub async fn validate_key(api_key: &str) -> Result<(), String> {
    if api_key.trim().is_empty() {
        return Err("API key is empty".to_string());
    }
    let resp = client()
        .get(format!("{TMDB_URL}/configuration"))
        .query(&[("api_key", api_key)])
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    if resp.status().is_success() {
        return Ok(());
    }
    if resp.status().as_u16() == 401 {
        return Err("Invalid API key — TMDB rejected it (401).".to_string());
    }
    Err(format!("TMDB returned HTTP {}", resp.status()))
}

/// Whether to search TMDB's `tv` or `movie` endpoint, derived from AniList format.
#[derive(Clone, Copy, PartialEq)]
pub enum TmdbKind {
    Tv,
    Movie,
}

impl TmdbKind {
    /// Map an AniList `format` string to the appropriate TMDB media kind.
    /// MOVIE → movie; everything else (TV, TV_SHORT, OVA, ONA, SPECIAL, MUSIC)
    /// is a serialized work best represented on TMDB's `tv` endpoint.
    pub fn from_format(format: Option<&str>) -> Self {
        match format {
            Some("MOVIE") => TmdbKind::Movie,
            _ => TmdbKind::Tv,
        }
    }

    fn path(self) -> &'static str {
        match self {
            TmdbKind::Tv => "tv",
            TmdbKind::Movie => "movie",
        }
    }

    /// TMDB dates the two media kinds under different query params.
    fn year_param(self) -> &'static str {
        match self {
            TmdbKind::Tv => "first_air_date_year",
            TmdbKind::Movie => "year",
        }
    }
}

/// Similarity score in [0,1] between two titles.
fn title_score(a: &str, b: &str) -> f64 {
    strsim::jaro_winkler(&parser::normalize_title(a), &parser::normalize_title(b))
}

/// Search TMDB for the best-matching id given a set of candidate titles
/// (romaji / english / native) and an optional release year.
///
/// Returns `None` when the API key is missing/invalid, no result is returned,
/// or the best candidate scores below a confidence floor (so we never attach
/// the wrong show's artwork).
pub async fn find_tmdb_id(
    api_key: &str,
    titles: &[&str],
    year: Option<i64>,
    kind: TmdbKind,
) -> Option<i64> {
    // Query TMDB with each candidate title until one yields a confident hit.
    for title in titles.iter().filter(|t| !t.trim().is_empty()) {
        let mut req = client()
            .get(format!("{TMDB_URL}/search/{}", kind.path()))
            .query(&[("api_key", api_key), ("query", title), ("include_adult", "true")]);
        if let Some(y) = year {
            req = req.query(&[(kind.year_param(), y.to_string())]);
        }

        let resp = match req.send().await {
            Ok(r) if r.status().is_success() => r,
            _ => continue,
        };
        let json: serde_json::Value = match resp.json().await {
            Ok(j) => j,
            Err(_) => continue,
        };
        let results = match json.get("results").and_then(|r| r.as_array()) {
            Some(r) if !r.is_empty() => r,
            _ => continue,
        };

        // Score every result against ALL candidate titles; keep the best.
        let mut best: Option<(f64, i64)> = None;
        for r in results {
            let id = match r.get("id").and_then(|v| v.as_i64()) {
                Some(id) => id,
                None => continue,
            };
            // TMDB uses `name` for tv and `title` for movie; check both plus originals.
            let names = [
                r.get("name").and_then(|v| v.as_str()),
                r.get("original_name").and_then(|v| v.as_str()),
                r.get("title").and_then(|v| v.as_str()),
                r.get("original_title").and_then(|v| v.as_str()),
            ];
            let score = titles
                .iter()
                .flat_map(|t| names.iter().flatten().map(move |n| title_score(t, n)))
                .fold(0.0_f64, f64::max);
            if best.map_or(true, |(bs, _)| score > bs) {
                best = Some((score, id));
            }
        }

        if let Some((score, id)) = best {
            // Confidence floor — below this we'd risk mismatched artwork.
            if score >= 0.82 {
                return Some(id);
            }
        }
    }
    None
}

/// Fetch all backdrop image URLs for a TMDB id, sorted highest-rated first and
/// built into full-resolution URLs. Language-agnostic backdrops (no embedded
/// text, `iso_639_1 == null`) are preferred as cleaner background art, followed
/// by the rest — both groups internally sorted by vote average.
pub async fn fetch_backdrops(api_key: &str, tmdb_id: i64, kind: TmdbKind) -> Result<Vec<String>, String> {
    let resp = client()
        .get(format!("{TMDB_URL}/{}/{tmdb_id}/images", kind.path()))
        // include_image_language=null,en surfaces textless art plus english.
        .query(&[("api_key", api_key), ("include_image_language", "null,en")])
        .send()
        .await
        .map_err(|e| format!("network request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("received error status from TMDB: {}", resp.status()));
    }

    let json: serde_json::Value = resp.json()
        .await
        .map_err(|e| format!("failed to parse JSON response: {e}"))?;

    let mut backdrops: Vec<&serde_json::Value> = json
        .get("backdrops")
        .and_then(|b| b.as_array())
        .map(|a| a.iter().collect())
        .unwrap_or_default();

    // Sort: textless (null language) first, then by vote average descending.
    backdrops.sort_by(|a, b| {
        let lang = |v: &serde_json::Value| v.get("iso_639_1").and_then(|l| l.as_str()).is_some();
        let vote = |v: &serde_json::Value| v.get("vote_average").and_then(|x| x.as_f64()).unwrap_or(0.0);
        // false (textless) sorts before true.
        lang(a)
            .cmp(&lang(b))
            .then(vote(b).partial_cmp(&vote(a)).unwrap_or(std::cmp::Ordering::Equal))
    });

    let urls = backdrops
        .iter()
        .filter_map(|b| b.get("file_path").and_then(|p| p.as_str()))
        .map(|p| format!("{IMAGE_BASE}{p}"))
        .collect();

    Ok(urls)
}
