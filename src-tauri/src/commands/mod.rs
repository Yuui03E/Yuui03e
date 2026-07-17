//! Tauri commands exposed to the React frontend.
//!
//! Split into sub-modules by domain. All `#[tauri::command]` functions are
//! re-exported so `commands::fn_name` paths in `generate_handler![]` keep
//! working.

mod misc;
mod playback;
mod settings;
mod sync;

pub use misc::*;
pub use playback::*;
pub use settings::*;
pub use sync::*;
