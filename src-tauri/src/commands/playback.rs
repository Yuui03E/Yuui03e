//! Playback history Tauri commands.

use tauri::State;
use crate::db::{self, Db, PlaybackHistoryEntry};

/// Save or update the playback position for a file.
#[tauri::command]
pub async fn save_playback_position(
    entry: PlaybackHistoryEntry,
    db: State<'_, Db>,
) -> Result<(), String> {
    db::save_playback_position(&db.0, &entry).await
}

/// Get the saved playback position (in seconds) for a file.
#[tauri::command]
pub async fn get_playback_position(
    file_path: String,
    db: State<'_, Db>,
) -> Result<Option<f64>, String> {
    db::get_playback_position(&db.0, &file_path).await
}

/// Delete the playback history entry for a file.
#[tauri::command]
pub async fn delete_playback_position(
    file_path: String,
    db: State<'_, Db>,
) -> Result<(), String> {
    db::delete_playback_position(&db.0, &file_path).await
}

/// Get recent playback entries for "Continue Watching" UI.
#[tauri::command]
pub async fn recent_playback(
    db: State<'_, Db>,
) -> Result<Vec<PlaybackHistoryEntry>, String> {
    db::recent_playback(&db.0, 20).await
}
