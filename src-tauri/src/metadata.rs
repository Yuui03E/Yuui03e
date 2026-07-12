//! Metadata resolver.
//!
//! AniList GraphQL with token-auth (90 req/min), exponential backoff retry,
//! incremental progress events, and cancel/pause support.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use once_cell::sync::Lazy;
use tauri::Emitter;

use crate::parser;
use crate::scanner::ScannedSeries;

const ANILIST_URL: &str = "https://graphql.anilist.co";

/// How long an in-memory search cache entry is considered fresh (1 hour).
const CACHE_TTL: Duration = Duration::from_secs(3600);

/// Max retry attempts on 429 or 5xx.
const MAX_RETRIES: u32 = 3;

/// Base delay for exponential backoff.
const BACKOFF_BASE: Duration = Duration::from_secs(2);

static CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .user_agent("Yuui/0.1 (+https://github.com/yuui)")
        .build()
        .expect("failed to build global reqwest client")
});

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AniListTitle {
    pub romaji: Option<String>,
    pub english: Option<String>,
    pub native: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AniListCoverImage {
    #[serde(rename = "extraLarge")]
    pub extra_large: Option<String>,
    pub large: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AniListMedia {
    pub id: i64,
    pub title: AniListTitle,
    pub description: Option<String>,
    pub format: Option<String>,
    pub status: Option<String>,
    pub season: Option<String>,
    #[serde(rename = "seasonYear")]
    pub season_year: Option<i64>,
    pub episodes: Option<i64>,
    #[serde(rename = "averageScore")]
    pub average_score: Option<i64>,
    #[serde(default)]
    pub genres: Vec<String>,
    #[serde(rename = "coverImage", default)]
    pub cover_image: AniListCoverImage,
    #[serde(rename = "bannerImage")]
    pub banner_image: Option<String>,
}

// Re-serialize with the camelCase field names the frontend expects.
impl AniListMedia {
    fn to_frontend(&self) -> serde_json::Value {
        serde_json::json!({
            "id": self.id,
            "title": {
                "romaji": self.title.romaji,
                "english": self.title.english,
                "native": self.title.native,
            },
            "description": self.description,
            "format": self.format,
            "status": self.status,
            "season": self.season,
            "seasonYear": self.season_year,
            "episodes": self.episodes,
            "averageScore": self.average_score,
            "genres": self.genres,
            "coverImage": {
                "extraLarge": self.cover_image.extra_large,
                "large": self.cover_image.large,
                "color": self.cover_image.color,
            },
            "bannerImage": self.banner_image,
        })
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct LibraryEntry {
    pub key: String,
    pub scanned: ScannedSeries,
    pub media: Option<serde_json::Value>,
    pub confidence: f64,
    pub matched: bool,
}

const SEARCH_QUERY: &str = r#"
query ($search: String) {
  Page(perPage: 5) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      id
      title { romaji english native }
      description(asHtml: false)
      format
      status
      season
      seasonYear
      episodes
      averageScore
      genres
      coverImage { extraLarge large color }
      bannerImage
    }
  }
}
"#;

// Process-wide cache with TTL so re-scans don't re-hit the API.
static CACHE: Mutex<Option<HashMap<String, (Instant, Vec<AniListMedia>)>>> =
    Mutex::new(None);

fn cache_get(key: &str) -> Option<Vec<AniListMedia>> {
    let guard = CACHE.lock().ok()?;
    let map = guard.as_ref()?;
    let (inserted_at, val) = map.get(key)?;
    if inserted_at.elapsed() > CACHE_TTL {
        return None; // stale — treat as miss
    }
    Some(val.clone())
}

fn cache_put(key: String, val: Vec<AniListMedia>) {
    if let Ok(mut guard) = CACHE.lock() {
        guard
            .get_or_insert_with(HashMap::new)
            .insert(key, (Instant::now(), val));
    }
}

// ---------------------------------------------------------------------------
// Dynamic rate limiting
// ---------------------------------------------------------------------------

/// Dynamic rate-limit state shared across all AniList requests.
static RATE_LIMIT: Mutex<Option<RateLimitState>> = Mutex::new(None);

#[derive(Clone, Copy)]
struct RateLimitState {
    remaining: Option<u32>,
    reset_at: Option<Instant>,
}

/// Sleep just enough to respect AniList's rate limit.
/// With a token (90 req/min), the floor is 700ms. Without (30 req/min), 2s.
async fn rate_limit_wait(has_token: bool) {
    let wait_until = {
        let guard = RATE_LIMIT.lock().ok();
        guard
            .as_ref()
            .and_then(|opt| opt.as_ref())
            .and_then(|s| s.reset_at)
    };

    if let Some(reset) = wait_until {
        let now = Instant::now();
        if reset > now {
            tokio::time::sleep(reset - now).await;
        }
        return;
    }

    // No rate-limit info yet — use floor based on auth status.
    let remaining = RATE_LIMIT
        .lock()
        .ok()
        .and_then(|g| g.as_ref().and_then(|s| s.remaining));

    match remaining {
        Some(r) if r <= 5 => tokio::time::sleep(Duration::from_secs(2)).await,
        _ => {
            // With token: 90 req/min ~ 667ms. Without: 30 req/min ~ 2s.
            let floor = if has_token {
                Duration::from_millis(700)
            } else {
                Duration::from_millis(2000)
            };
            tokio::time::sleep(floor).await;
        }
    }
}

/// Update the shared rate-limit state from response headers.
fn update_rate_limit(resp: &reqwest::Response) {
    let remaining = resp
        .headers()
        .get("X-RateLimit-Remaining")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.trim().parse::<u32>().ok());

    let retry_after = resp
        .headers()
        .get("Retry-After")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.trim().parse::<u64>().ok());

    let reset_at = retry_after.map(|secs| Instant::now() + Duration::from_secs(secs));

    if let Ok(mut guard) = RATE_LIMIT.lock() {
        *guard = Some(RateLimitState { remaining, reset_at });
    }
}

/// Sleep for `dur`, but wake early (within ~200ms) if the cancel flag is set.
/// Returns `true` if cancellation was observed during the wait.
async fn cancellable_sleep(dur: Duration, cancel_flag: Option<&AtomicBool>) -> bool {
    let flag = match cancel_flag {
        Some(f) => f,
        None => {
            tokio::time::sleep(dur).await;
            return false;
        }
    };

    let deadline = Instant::now() + dur;
    let slice = Duration::from_millis(200);
    loop {
        if flag.load(Ordering::Relaxed) {
            return true;
        }
        let now = Instant::now();
        if now >= deadline {
            return false;
        }
        tokio::time::sleep(slice.min(deadline - now)).await;
    }
}

/// AniList search with token auth, exponential backoff retry on 429/5xx.
/// Returns (results, error_message_if_any).
/// `token` — optional AniList API token for authenticated requests (90 req/min).
/// `cancel_flag` — if set to true, aborts early.
async fn anilist_search_with_retry(
    client: &reqwest::Client,
    search: &str,
    token: Option<&str>,
    cancel_flag: Option<&AtomicBool>,
) -> (Vec<AniListMedia>, Option<String>) {
    let norm = parser::normalize_title(search);
    if let Some(hit) = cache_get(&norm) {
        return (hit, None);
    }

    let has_token = token.map(|t| !t.trim().is_empty()).unwrap_or(false);
    let body = serde_json::json!({
        "query": SEARCH_QUERY,
        "variables": { "search": search },
    });

    let mut last_err = String::new();

    for attempt in 0..MAX_RETRIES {
        // Check cancel before each attempt
        if let Some(flag) = cancel_flag {
            if flag.load(Ordering::Relaxed) {
                return (Vec::new(), Some("Search cancelled".to_string()));
            }
        }

        rate_limit_wait(has_token).await;

        // Check cancel again after the rate-limit wait (could have been long)
        if let Some(flag) = cancel_flag {
            if flag.load(Ordering::Relaxed) {
                return (Vec::new(), Some("Search cancelled".to_string()));
            }
        }

        let mut req = client
            .post(ANILIST_URL)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json");

        if has_token {
            req = req.header("Authorization", format!("Bearer {}", token.unwrap().trim()));
        }

        let resp = match req.json(&body).send().await {
            Ok(r) => r,
            Err(e) => {
                last_err = format!("AniList request failed: {e}");
                let backoff = BACKOFF_BASE * 2u32.pow(attempt);
                if cancellable_sleep(backoff, cancel_flag).await {
                    return (Vec::new(), Some("Search cancelled".to_string()));
                }
                continue;
            }
        };

        let status = resp.status();
        update_rate_limit(&resp);

        // Handle 429 and 5xx with retry
        if status.as_u16() == 429 || status.is_server_error() {
            last_err = format!("AniList returned status {status}");
            let backoff = BACKOFF_BASE * 2u32.pow(attempt);
            eprintln!(
                "AniList search '{}' got {} (attempt {}/{}), backing off for {:?}",
                search, status, attempt + 1, MAX_RETRIES, backoff
            );
            if cancellable_sleep(backoff, cancel_flag).await {
                return (Vec::new(), Some("Search cancelled".to_string()));
            }
            continue;
        }

        if !status.is_success() {
            last_err = format!("AniList returned status {status}");
            return (Vec::new(), Some(last_err));
        }

        let json: serde_json::Value = match resp.json().await {
            Ok(j) => j,
            Err(e) => {
                last_err = format!("AniList parse failed: {e}");
                return (Vec::new(), Some(last_err));
            }
        };

        let media = json
            .get("data")
            .and_then(|d| d.get("Page"))
            .and_then(|p| p.get("media"))
            .cloned()
            .unwrap_or(serde_json::Value::Null);

        let list: Vec<AniListMedia> = serde_json::from_value(media).unwrap_or_default();
        cache_put(norm, list.clone());
        return (list, None);
    }

    (
        Vec::new(),
        Some(format!("AniList search failed after {MAX_RETRIES} retries: {last_err}")),
    )
}

/// Backwards-compatible wrapper for code that just needs results (no cancel, no token).
async fn anilist_search(
    client: &reqwest::Client,
    search: &str,
) -> Result<Vec<AniListMedia>, String> {
    let (list, err) = anilist_search_with_retry(client, search, None, None).await;
    if let Some(e) = err {
        eprintln!("AniList search warning: {e}");
    }
    Ok(list)
}

// --- Rich detail query ---

const DETAIL_QUERY: &str = r#"
query ($id: Int) {
  Media(id: $id) {
    id
    idMal
    title { romaji english native }
    description(asHtml: false)
    format
    status
    season
    seasonYear
    episodes
    duration
    averageScore
    meanScore
    popularity
    favourites
    source
    genres
    synonyms
    coverImage { extraLarge large color }
    bannerImage
    trailer { id site thumbnail }
    tags { name rank isMediaSpoiler category }
    studios(isMain: true) { nodes { id name } }
    startDate { year month day }
    endDate { year month day }
    nextAiringEpisode { airingAt timeUntilAiring episode }
    characters(sort: [ROLE, RELEVANCE], perPage: 12) {
      edges {
        role
        node { id name { full } image { large } }
        voiceActors(language: JAPANESE) { id name { full } image { large } }
      }
    }
    staff(perPage: 8) {
      edges { role node { id name { full } image { large } } }
    }
    relations {
      edges {
        relationType
        node {
          id type format
          title { romaji english }
          coverImage { extraLarge large color }
        }
      }
    }
    recommendations(sort: RATING_DESC, perPage: 8) {
      nodes {
        mediaRecommendation {
          id
          title { romaji english }
          coverImage { extraLarge large color }
          averageScore
        }
      }
    }
    streamingEpisodes {
      title
      thumbnail
      url
      site
    }
  }
}
"#;

/// Free-text AniList search returning frontend-shaped media objects.
pub async fn search_frontend(query: &str) -> Result<Vec<serde_json::Value>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }
    let list = anilist_search(&CLIENT, query).await?;
    Ok(list.iter().map(|m| m.to_frontend()).collect())
}

/// Fetch the full rich detail for one AniList media id.
/// Uses token if available for higher rate limits.
pub async fn fetch_detail(media_id: i64, token: Option<String>) -> Result<serde_json::Value, String> {
    let has_token = token.as_ref().map(|t| !t.trim().is_empty()).unwrap_or(false);
    rate_limit_wait(has_token).await;

    let body = serde_json::json!({
        "query": DETAIL_QUERY,
        "variables": { "id": media_id },
    });

    let mut req = CLIENT
        .post(ANILIST_URL)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json");

    if has_token {
        req = req.header("Authorization", format!("Bearer {}", token.unwrap().trim()));
    }

    let resp = req
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("AniList detail request failed: {e}"))?;

    update_rate_limit(&resp);

    if !resp.status().is_success() {
        return Err(format!("AniList detail HTTP {}", resp.status()));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("AniList detail parse failed: {e}"))?;

    let media = json
        .get("data")
        .and_then(|d| d.get("Media"))
        .cloned()
        .ok_or_else(|| "AniList detail: no Media in response".to_string())?;

    Ok(media)
}

/// Score a candidate title against the query using normalized similarity.
fn score(query: &str, media: &AniListMedia) -> f64 {
    let q = parser::normalize_title(query);
    let candidates = [
        media.title.romaji.as_deref(),
        media.title.english.as_deref(),
        media.title.native.as_deref(),
    ];
    candidates
        .iter()
        .flatten()
        .map(|t| strsim::jaro_winkler(&q, &parser::normalize_title(t)))
        .fold(0.0, f64::max)
}

/// Adaptive confidence threshold for matching.
fn adaptive_threshold(normalized_title: &str) -> f64 {
    if normalized_title.len() <= 12 {
        0.90
    } else {
        0.85
    }
}

/// Progress event payload sent to the frontend during incremental matching.
#[derive(Debug, Clone, Serialize)]
pub struct SearchProgress {
    pub current: usize,
    pub total: usize,
    pub title: String,
    pub status: String, // "searching", "matched", "not_found", "cached", "error"
    pub message: Option<String>,
}

/// Incremental match with progress events, token auth, cancel, and pause support.
///
/// - `app` — Tauri AppHandle for emitting events
/// - `token` — optional AniList API token for 90 req/min
/// - `cancel_flag` — shared AtomicBool; when set to true, matching stops
/// - `pause_flag` — shared AtomicBool; when set to true, matching pauses
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
                    current: i,
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

        // If this series already has a manual match, use the cached media JSON and skip API search
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

        let (results, err) =
            anilist_search_with_retry(&CLIENT, &s.title, token_ref, Some(&cancel_flag)).await;

        // If cancelled during search, stop
        if cancel_flag.load(Ordering::Relaxed) {
            break;
        }

        let best = results
            .into_iter()
            .map(|m| {
                let sc = score(&s.title, &m);
                (sc, m)
            })
            .max_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

        let (confidence, media) = match best {
            Some((sc, m)) => (sc, Some(m)),
            None => (0.0, None),
        };

        let threshold = adaptive_threshold(&key);
        let matched = confidence >= threshold;

        let status_str = if err.is_some() {
            "error"
        } else if matched {
            "matched"
        } else if media.is_some() {
            "low_confidence"
        } else {
            "not_found"
        };

        let entry = LibraryEntry {
            key: key.clone(),
            scanned: s,
            media: media.map(|m| m.to_frontend()),
            confidence,
            matched,
        };

        // Emit per-entry progress with status
        let _ = app.emit(
            "sync:searching",
            SearchProgress {
                current: i + 1,
                total,
                title: entry.scanned.title.clone(),
                status: status_str.to_string(),
                message: err.clone(),
            },
        );

        out.push(entry);
    }

    Ok(out)
}

/// Backwards-compatible match_series (no progress events, no cancel).
/// Used by the `match_series` Tauri command.
pub async fn match_series(series: Vec<ScannedSeries>) -> Result<Vec<LibraryEntry>, String> {
    let mut out = Vec::with_capacity(series.len());

    for s in series {
        let key = parser::normalize_title(&s.title);
        let results = anilist_search(&CLIENT, &s.title).await.unwrap_or_default();

        let best = results
            .into_iter()
            .map(|m| {
                let sc = score(&s.title, &m);
                (sc, m)
            })
            .max_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

        let (confidence, media) = match best {
            Some((sc, m)) => (sc, Some(m)),
            None => (0.0, None),
        };

        let threshold = adaptive_threshold(&key);
        let matched = confidence >= threshold;
        out.push(LibraryEntry {
            key,
            scanned: s,
            media: media.map(|m| m.to_frontend()),
            confidence,
            matched,
        });
    }

    Ok(out)
}

/// Generic proxy to run AniList GraphQL queries from the Rust backend (bypassing Webview CORS).
pub async fn query_anilist(
    query: String,
    variables: serde_json::Value,
    token: Option<String>,
) -> Result<serde_json::Value, String> {
    let mut req = CLIENT.post(ANILIST_URL);

    if let Some(t) = token {
        if !t.trim().is_empty() {
            req = req.header("Authorization", format!("Bearer {t}"));
        }
    }

    let resp = req
        .json(&serde_json::json!({
            "query": query,
            "variables": variables
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("AniList responded with status {}: {}", status, text));
    }

    let json: serde_json::Value = serde_json::from_str(&text).map_err(|e| format!("Failed to parse JSON: {}. Response: {}", e, text))?;
    Ok(json)
}
