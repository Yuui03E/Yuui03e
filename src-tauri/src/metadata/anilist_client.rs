//! AniList HTTP client with token-auth rate limiting, caching, and retry.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::parser;

const ANILIST_URL: &str = "https://graphql.anilist.co";

/// How long an in-memory search cache entry is considered fresh (1 hour).
const CACHE_TTL: Duration = Duration::from_secs(3600);

/// Max retry attempts on 429 or 5xx.
const MAX_RETRIES: u32 = 3;

/// Base delay for exponential backoff.
const BACKOFF_BASE: Duration = Duration::from_secs(2);

/// Shortcut to the global reqwest client.
fn client() -> &'static reqwest::Client {
    crate::http_client()
}

// ─── AniList response types ─────────────────────────────────────────────────

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
    #[serde(default)]
    pub synonyms: Vec<String>,
    #[serde(rename = "coverImage", default)]
    pub cover_image: AniListCoverImage,
    #[serde(rename = "bannerImage")]
    pub banner_image: Option<String>,
}

// Re-serialize with the camelCase field names the frontend expects.
impl AniListMedia {
    pub fn to_frontend(&self) -> serde_json::Value {
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
            "synonyms": self.synonyms,
            "coverImage": {
                "extraLarge": self.cover_image.extra_large,
                "large": self.cover_image.large,
                "color": self.cover_image.color,
            },
            "bannerImage": self.banner_image,
        })
    }
}

// ─── Search query ───────────────────────────────────────────────────────────

const SEARCH_QUERY: &str = r#"
query ($search: String) {
  Page(perPage: 8) {
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
      synonyms
      coverImage { extraLarge large color }
      bannerImage
    }
  }
}
"#;

// ─── In-memory search cache (TTL 1h) ────────────────────────────────────────

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

// ─── Rate limiting ──────────────────────────────────────────────────────────

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
        // Clear the deadline (whether pending or stale) so it is honored only
        // once — a stale `reset_at` left in place would make every subsequent
        // call skip the floor sleep entirely and trigger 429 storms.
        if let Ok(mut guard) = RATE_LIMIT.lock() {
            if let Some(s) = guard.as_mut() {
                s.reset_at = None;
            }
        }
        if reset > now {
            tokio::time::sleep(reset - now).await;
            return; // Waited the full Retry-After — safe to fire immediately.
        }
        // Deadline already passed — fall through to the normal floor below.
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
        let prev = guard.unwrap_or(RateLimitState {
            remaining: None,
            reset_at: None,
        });
        *guard = Some(RateLimitState {
            remaining: remaining.or(prev.remaining),
            reset_at: reset_at.or(prev.reset_at),
        });
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

// ─── Core POST helper ───────────────────────────────────────────────────────

/// Shared AniList GraphQL POST with token auth, exponential backoff retry on
/// 429/5xx, and optional cancel support. Returns the full JSON response on
/// success.
pub(crate) async fn anilist_post(
    query: &str,
    variables: serde_json::Value,
    token: Option<&str>,
    cancel_flag: Option<&AtomicBool>,
) -> Result<serde_json::Value, String> {
    let has_token = token.map(|t| !t.trim().is_empty()).unwrap_or(false);
    let mut last_err = String::new();

    for attempt in 0..MAX_RETRIES {
        if let Some(flag) = cancel_flag {
            if flag.load(Ordering::Relaxed) {
                return Err("Request cancelled".to_string());
            }
        }

        rate_limit_wait(has_token).await;

        if let Some(flag) = cancel_flag {
            if flag.load(Ordering::Relaxed) {
                return Err("Request cancelled".to_string());
            }
        }

        let mut req = client()
            .post(ANILIST_URL)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json");

        if has_token {
            req = req.header("Authorization", format!("Bearer {}", token.unwrap().trim()));
        }

        let body = serde_json::json!({
            "query": query,
            "variables": variables,
        });

        let resp = match req.json(&body).send().await {
            Ok(r) => r,
            Err(e) => {
                last_err = format!("AniList request failed: {e}");
                let backoff = BACKOFF_BASE * 2u32.pow(attempt);
                if cancellable_sleep(backoff, cancel_flag).await {
                    return Err("Request cancelled".to_string());
                }
                continue;
            }
        };

        let status = resp.status();
        update_rate_limit(&resp);

        if status.as_u16() == 429 || status.is_server_error() {
            last_err = format!("AniList returned status {status}");
            let backoff = BACKOFF_BASE * 2u32.pow(attempt);
            eprintln!(
                "AniList POST got {} (attempt {}/{}), backing off for {:?}",
                status,
                attempt + 1,
                MAX_RETRIES,
                backoff
            );
            if cancellable_sleep(backoff, cancel_flag).await {
                return Err("Request cancelled".to_string());
            }
            continue;
        }

        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("AniList responded with status {}: {}", status, text));
        }

        let json: serde_json::Value = resp.json().await.map_err(|e| {
            format!("AniList parse failed: {e}")
        })?;

        return Ok(json);
    }

    Err(format!("AniList request failed after {MAX_RETRIES} retries: {last_err}"))
}

// ─── Public search API ──────────────────────────────────────────────────────

/// AniList search with token auth, exponential backoff retry on 429/5xx.
/// Returns (results, error_message_if_any).
pub(crate) async fn anilist_search_with_retry(
    search: &str,
    token: Option<&str>,
    cancel_flag: Option<&AtomicBool>,
) -> (Vec<AniListMedia>, Option<String>) {
    let norm = parser::normalize_title(search);
    if let Some(hit) = cache_get(&norm) {
        return (hit, None);
    }

    let variables = serde_json::json!({ "search": search });
    match anilist_post(SEARCH_QUERY, variables, token, cancel_flag).await {
        Ok(json) => {
            let media = json
                .get("data")
                .and_then(|d| d.get("Page"))
                .and_then(|p| p.get("media"))
                .cloned()
                .unwrap_or(serde_json::Value::Null);

            let list: Vec<AniListMedia> = serde_json::from_value(media).unwrap_or_default();
            cache_put(norm, list.clone());
            (list, None)
        }
        Err(e) => (Vec::new(), Some(e)),
    }
}

/// Backwards-compatible wrapper for code that just needs results (no cancel, no token).
pub(crate) async fn anilist_search(
    search: &str,
) -> Result<Vec<AniListMedia>, String> {
    let (list, err) = anilist_search_with_retry(search, None, None).await;
    if let Some(e) = err {
        eprintln!("AniList search warning: {e}");
    }
    Ok(list)
}

// ─── Rich detail query ──────────────────────────────────────────────────────

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

/// Fetch the full rich detail for one AniList media id.
/// Uses token if available for higher rate limits.
pub(crate) async fn fetch_detail_raw(
    media_id: i64,
    token: Option<String>,
) -> Result<serde_json::Value, String> {
    let variables = serde_json::json!({ "id": media_id });
    let token_ref = token.as_deref();
    let json = anilist_post(DETAIL_QUERY, variables, token_ref, None).await?;

    let media = json
        .get("data")
        .and_then(|d| d.get("Media"))
        .cloned()
        .ok_or_else(|| "AniList detail: no Media in response".to_string())?;

    Ok(media)
}
