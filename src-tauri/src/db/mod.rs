//! SQLite persistence layer (Rust-native, via `sqlx`).
//!
//! Multi-module directory split from the original monolithic `db.rs`.
//! All public items are re-exported so `db::*` paths keep working.

use sqlx::SqlitePool;

mod schema;
mod entries;
mod user_data;
mod caches;
mod playback;

pub use schema::init;
pub use entries::{UserData, StoredEntry, upsert_entry, all_entries, entry_by_key};
pub use user_data::{set_user_data, set_manual_match};
pub use caches::{get_detail, put_detail, placeholders, refresh_series_aggregates,
                 get_setting, set_setting,
                 get_tmdb_id, put_tmdb_id, get_backdrops, put_backdrops};
pub use playback::{PlaybackHistoryEntry, save_playback_position, get_playback_position,
                   delete_playback_position, recent_playback};

/// Wrapper so we can `app.manage(Db(pool, cache_dir))` and pull it out of Tauri state.
pub struct Db(pub SqlitePool, pub std::path::PathBuf);
