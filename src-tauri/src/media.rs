use std::path::Path;
use std::process::Command;
use std::time::Duration;
use sqlx::SqlitePool;

async fn get_ffmpeg_path(pool: &SqlitePool) -> String {
    crate::db::get_setting(pool, "ffmpeg_path")
        .await
        .unwrap_or(None)
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "ffmpeg".to_string())
}

async fn get_ffprobe_path(pool: &SqlitePool) -> String {
    crate::db::get_setting(pool, "ffprobe_path")
        .await
        .unwrap_or(None)
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "ffprobe".to_string())
}

pub fn query_duration(ffprobe_path: &str, video_path: &str) -> Result<f64, String> {
    let output = Command::new(ffprobe_path)
        .args(&[
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            video_path
        ])
        .output()
        .map_err(|e| format!("failed to run ffprobe: {e}"))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffprobe error: {err}"));
    }

    let out_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    out_str.parse::<f64>().map_err(|e| format!("failed to parse duration '{out_str}': {e}"))
}

pub fn generate_sprite_sheet(
    ffmpeg_path: &str,
    video_path: &str,
    duration: f64,
    output_jpg: &str,
) -> Result<(), String> {
    let interval = duration / 26.0;
    let interval = if interval < 1.0 { 1.0 } else { interval };
    let vf_arg = format!("fps=1/{interval},scale=160:90,tile=5x5");
    
    let output = Command::new(ffmpeg_path)
        .args(&[
            "-i", video_path,
            "-vf", &vf_arg,
            "-frames:v", "1",
            "-y",
            output_jpg
        ])
        .output()
        .map_err(|e| format!("failed to run ffmpeg for sprite sheet: {e}"))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffmpeg sprite sheet error: {err}"));
    }

    Ok(())
}

pub fn generate_preview_clip(
    ffmpeg_path: &str,
    video_path: &str,
    duration: f64,
    output_mp4: &str,
) -> Result<(), String> {
    let start_time = if duration > 30.0 { (duration * 0.3).round() } else { 0.0 };
    let start_str = format!("{start_time}");
    let t_len = if duration > 5.0 { "5" } else { "1" };

    let output = Command::new(ffmpeg_path)
        .args(&[
            "-ss", &start_str,
            "-i", video_path,
            "-t", t_len,
            "-c:v", "libx264",
            "-preset", "superfast",
            "-crf", "28",
            "-vf", "scale=320:180",
            "-an",
            "-y",
            output_mp4
        ])
        .output()
        .map_err(|e| format!("failed to run ffmpeg for preview clip: {e}"))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffmpeg preview clip error: {err}"));
    }

    Ok(())
}

/// Spawns a background worker queue that generates hover video clips and sprite sheets
/// sequentially for all files in the SQLite database that lack them.
pub fn start_preview_worker(pool: SqlitePool, cache_dir: std::path::PathBuf) {
    tauri::async_runtime::spawn(async move {
        // Sleep a short time on startup
        tokio::time::sleep(Duration::from_secs(3)).await;

        loop {
            let ffmpeg = get_ffmpeg_path(&pool).await;
            let ffprobe = get_ffprobe_path(&pool).await;

            let files: Vec<(String, String, i64)> = sqlx::query_as(
                "SELECT path, ed2k, size_bytes FROM files WHERE ed2k IS NOT NULL"
            )
            .fetch_all(&pool)
            .await
            .unwrap_or_default();

            let sprite_dir = cache_dir.join("sprites");
            let clip_dir = cache_dir.join("clips");

            std::fs::create_dir_all(&sprite_dir).ok();
            std::fs::create_dir_all(&clip_dir).ok();

            let mut processed_any = false;

            for (path, ed2k, _size) in files {
                if !Path::new(&path).exists() {
                    continue;
                }

                let sprite_path = sprite_dir.join(format!("{ed2k}.jpg"));
                let clip_path = clip_dir.join(format!("{ed2k}.mp4"));

                let need_sprite = !sprite_path.exists();
                let need_clip = !clip_path.exists();

                if need_sprite || need_clip {
                    processed_any = true;
                    
                    let sprite_path_str = sprite_path.to_string_lossy().to_string();
                    let clip_path_str = clip_path.to_string_lossy().to_string();

                    match query_duration(&ffprobe, &path) {
                        Ok(duration) => {
                            if need_sprite {
                                let _ = generate_sprite_sheet(&ffmpeg, &path, duration, &sprite_path_str);
                            }
                            if need_clip {
                                let _ = generate_preview_clip(&ffmpeg, &path, duration, &clip_path_str);
                            }
                        }
                        Err(_) => {}
                    }

                    tokio::time::sleep(Duration::from_millis(500)).await;
                }
            }

            if !processed_any {
                tokio::time::sleep(Duration::from_secs(15)).await;
            } else {
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        }
    });
}
