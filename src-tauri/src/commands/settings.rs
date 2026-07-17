//! Settings and data-management Tauri commands.

use tauri::State;
use crate::db::{self, Db, UserData};

/// Persist watch status / score / notes / favorite for a series.
#[tauri::command]
pub async fn set_user_data(
    key: String,
    data: UserData,
    db: State<'_, Db>,
) -> Result<(), String> {
    db::set_user_data(&db.0, &key, &data).await
}

/// Pin a manual AniList match (used by the review-fix UI later).
#[tauri::command]
pub async fn set_manual_match(
    key: String,
    media: serde_json::Value,
    db: State<'_, Db>,
) -> Result<(), String> {
    db::set_manual_match(&db.0, &key, &media).await
}

/// Search AniList by free-text query — powers the manual match-fix (Review) UI.
#[tauri::command]
pub async fn search_anilist(query: String) -> Result<Vec<serde_json::Value>, String> {
    crate::metadata::search_frontend(&query).await
}

#[tauri::command]
pub async fn get_setting(
    key: String,
    db: State<'_, Db>,
) -> Result<Option<String>, String> {
    db::get_setting(&db.0, &key).await
}

#[tauri::command]
pub async fn set_setting(
    key: String,
    value: String,
    db: State<'_, Db>,
) -> Result<(), String> {
    db::set_setting(&db.0, &key, &value).await
}

/// Resolve the highest-resolution background artwork for a series.
#[tauri::command]
pub async fn get_backdrops(
    anilist_id: i64,
    titles: Vec<String>,
    year: Option<i64>,
    format: Option<String>,
    db: State<'_, Db>,
) -> Result<Vec<String>, String> {
    if let Some(cached) = db::get_backdrops(&db.0, anilist_id).await {
        return Ok(cached);
    }

    let api_key = db::get_setting(&db.0, "tmdb_api_key")
        .await?
        .unwrap_or_default();
    if api_key.trim().is_empty() {
        return Ok(vec![]);
    }

    let kind = crate::tmdb::TmdbKind::from_format(format.as_deref());
    let title_refs: Vec<&str> = titles.iter().map(|s| s.as_str()).collect();

    let tmdb_id = match db::get_tmdb_id(&db.0, anilist_id).await {
        Some(id) => Some(id),
        None => {
            let found =
                crate::tmdb::find_tmdb_id(&api_key, &title_refs, year, kind).await;
            if let Some(id) = found {
                let _ = db::put_tmdb_id(&db.0, anilist_id, id).await;
            }
            found
        }
    };

    let urls_res = match tmdb_id {
        Some(id) => crate::tmdb::fetch_backdrops(&api_key, id, kind).await,
        None => Ok(vec![]),
    };

    match urls_res {
        Ok(urls) => {
            let _ = db::put_backdrops(&db.0, anilist_id, &urls).await;
            Ok(urls)
        }
        Err(e) => Err(e),
    }
}

/// Validate a TMDB API key against TMDB's `/configuration` endpoint.
#[tauri::command]
pub async fn test_tmdb_key(key: String) -> Result<String, String> {
    crate::tmdb::validate_key(key.trim()).await?;
    Ok("TMDB API key verified successfully".to_string())
}

#[tauri::command]
pub async fn graphql_anilist(
    query: String,
    variables: serde_json::Value,
    db: State<'_, Db>,
) -> Result<serde_json::Value, String> {
    let token = db::get_setting(&db.0, "anilist_token")
        .await
        .unwrap_or(None);
    crate::metadata::query_anilist(query, variables, token).await
}

/// Test AniDB credentials by attempting a login.
#[tauri::command]
pub async fn test_anidb_credentials(
    username: String,
    password: String,
) -> Result<String, String> {
    if username.trim().is_empty() || password.trim().is_empty() {
        return Err("Username and password are required".to_string());
    }

    let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let mut client = crate::anidb::AniDBClient::new()
            .map_err(|e| format!("Failed to create AniDB client: {e}"))?;
        client
            .login(&username, &password)
            .map_err(|e| format!("AniDB login failed: {e}"))?;
        let _ = client.logout();
        Ok("AniDB credentials verified successfully".to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?;

    result
}
