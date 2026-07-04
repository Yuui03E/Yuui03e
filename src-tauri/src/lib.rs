mod anidb;
mod commands;
mod db;
mod hashing;
mod library_analysis;
mod media;
mod metadata;
mod parser;
mod scanner;

use tauri::Manager;

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

            // Setup cache directories
            let cache_dir = dir.join("cache");
            std::fs::create_dir_all(cache_dir.join("sprites")).ok();
            std::fs::create_dir_all(cache_dir.join("clips")).ok();

            let db_path = dir.join("yuui.db");

            let pool = tauri::async_runtime::block_on(db::init(db_path))
                .expect("failed to initialize database");

            // Start background preview generation queue worker
            crate::media::start_preview_worker(pool.clone());

            app.manage(db::Db(pool));
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
            commands::test_anidb_connection,
            commands::play_video,
            commands::generate_previews_for_all,
            commands::graphql_anilist,
            commands::exchange_anilist_code,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
