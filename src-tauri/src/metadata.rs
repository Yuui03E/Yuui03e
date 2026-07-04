//! Metadata resolver.
//!
//! Phase-1 implementation: AniList GraphQL (no auth) with a simple in-memory
//! cache and gentle rate limiting. Designed as a modular skeleton so AniDB /
//! Jikan (MAL) / TMDB resolvers can slot in later behind the same interface.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use crate::parser;
use crate::scanner::ScannedSeries;

const ANILIST_URL: &str = "https://graphql.anilist.co";

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

// Very small process-wide cache so re-scans don't re-hit the API.
static CACHE: Mutex<Option<HashMap<String, Vec<AniListMedia>>>> = Mutex::new(None);

fn cache_get(key: &str) -> Option<Vec<AniListMedia>> {
    let guard = CACHE.lock().ok()?;
    guard.as_ref()?.get(key).cloned()
}

fn cache_put(key: String, val: Vec<AniListMedia>) {
    if let Ok(mut guard) = CACHE.lock() {
        guard.get_or_insert_with(HashMap::new).insert(key, val);
    }
}

async fn anilist_search(
    client: &reqwest::Client,
    search: &str,
) -> Result<Vec<AniListMedia>, String> {
    let norm = parser::normalize_title(search);
    if let Some(hit) = cache_get(&norm) {
        return Ok(hit);
    }

    let body = serde_json::json!({
        "query": SEARCH_QUERY,
        "variables": { "search": search },
    });

    let resp = client
        .post(ANILIST_URL)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("AniList request failed: {e}"))?;

    if !resp.status().is_success() {
        // Rate-limited or error: return empty so the series just goes to review.
        return Ok(Vec::new());
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("AniList parse failed: {e}"))?;

    let media = json
        .get("data")
        .and_then(|d| d.get("Page"))
        .and_then(|p| p.get("media"))
        .cloned()
        .unwrap_or(serde_json::Value::Null);

    let list: Vec<AniListMedia> = serde_json::from_value(media).unwrap_or_default();
    cache_put(norm, list.clone());
    Ok(list)
}

// --- Rich detail query (Phase 3) -------------------------------------------

const DETAIL_QUERY: &str = r#"
query ($id: Int) {
  Media(id: $id, type: ANIME) {
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
  }
}
"#;

/// Free-text AniList search returning frontend-shaped media objects. Powers the
/// manual match-fix (Review) UI. Uses the in-memory cache like `match_series`.
pub async fn search_frontend(query: &str) -> Result<Vec<serde_json::Value>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }
    let client = reqwest::Client::builder()
        .user_agent("Yuui/0.1 (+https://github.com/yuui)")
        .build()
        .map_err(|e| e.to_string())?;
    let list = anilist_search(&client, query).await?;
    Ok(list.iter().map(|m| m.to_frontend()).collect())
}

/// Fetch the full rich detail for one AniList media id.
pub async fn fetch_detail(media_id: i64) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .user_agent("Yuui/0.1 (+https://github.com/yuui)")
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "query": DETAIL_QUERY,
        "variables": { "id": media_id },
    });

    let resp = client
        .post(ANILIST_URL)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("AniList detail request failed: {e}"))?;

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

/// Match a list of scanned series against AniList, returning enriched entries.
pub async fn match_series(series: Vec<ScannedSeries>) -> Result<Vec<LibraryEntry>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Yuui/0.1 (+https://github.com/yuui)")
        .build()
        .map_err(|e| e.to_string())?;

    let mut out = Vec::with_capacity(series.len());

    for s in series {
        let key = parser::normalize_title(&s.title);
        let results = anilist_search(&client, &s.title).await.unwrap_or_default();

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

        let matched = confidence >= 0.85;
        out.push(LibraryEntry {
            key,
            scanned: s,
            media: media.map(|m| m.to_frontend()),
            confidence,
            matched,
        });

        // Gentle rate limiting: AniList allows ~90 req/min.
        tokio::time::sleep(Duration::from_millis(700)).await;
    }

    Ok(out)
}

/// Generic proxy to run AniList GraphQL queries from the Rust backend (bypassing Webview CORS).
pub async fn query_anilist(query: String, variables: serde_json::Value) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .user_agent("Yuui/0.1 (+https://github.com/yuui)")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .post(ANILIST_URL)
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
