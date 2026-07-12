mod anidb;
mod commands;
mod db;
mod hashing;
mod library_analysis;
mod media;
mod metadata;
mod parser;
mod scanner;
mod tmdb;

use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::Manager;

/// Shared sync control flags — managed by Tauri state.
/// These let the frontend cancel or pause an ongoing sync.
#[derive(Clone)]
pub struct SyncControl {
    pub cancel: Arc<AtomicBool>,
    pub pause: Arc<AtomicBool>,
}

impl Default for SyncControl {
    fn default() -> Self {
        Self {
            cancel: Arc::new(AtomicBool::new(false)),
            pause: Arc::new(AtomicBool::new(false)),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Resolve a stable app-data path for the SQLite file and open the pool.
            let dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&dir).ok();

            // Setup cache directories — this is the single source of truth for the
            // cache path, shared between the preview worker (media.rs) and the
            // hydration layer (db.rs) so they always agree on the same directory.
            let cache_dir = dir.join("cache");
            std::fs::create_dir_all(cache_dir.join("sprites")).ok();
            std::fs::create_dir_all(cache_dir.join("clips")).ok();

            let db_path = dir.join("yuui.db");

            let pool = tauri::async_runtime::block_on(db::init(db_path))
                .expect("failed to initialize database");
            // Start background preview generation queue worker
            crate::media::start_preview_worker(pool.clone(), cache_dir.clone());

            app.manage(db::Db(pool, cache_dir));
            app.manage(SyncControl::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::default_anime_path,
            commands::scan_library,
            commands::match_series,
            commands::sync_library,
            commands::get_library,
            commands::get_entry,
            commands::set_user_data,
            commands::set_manual_match,
            commands::search_anilist,
            commands::get_setting,
            commands::set_setting,
            commands::get_backdrops,
            commands::test_tmdb_key,
            commands::play_video,
            commands::graphql_anilist,
            // Playback history (SQLite-backed)
            commands::save_playback_position,
            commands::get_playback_position,
            commands::delete_playback_position,
            commands::recent_playback,
            // Settings validation
            commands::test_anidb_credentials,
            commands::test_ffmpeg_path,
            // Sync control
            commands::cancel_sync,
            commands::pause_sync,
            commands::resume_sync,
            commands::remove_folder_entries,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
