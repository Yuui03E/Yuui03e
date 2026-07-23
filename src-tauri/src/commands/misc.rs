//! Miscellaneous utility Tauri commands.

/// Open a video file in the OS default external media player.
#[tauri::command]
pub fn play_video(path: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("file path is empty".to_string());
    }

    tauri_plugin_opener::open_path(&path, None::<&str>)
        .map_err(|e| format!("failed to launch player: {e}"))
}

/// Copies text directly to the system clipboard from the backend.
#[tauri::command]
pub fn copy_to_clipboard(text: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args(&[
                "-NoProfile",
                "-Command",
                &format!("Set-Clipboard -Value '{}'", text.replace("'", "''")),
            ])
            .output()
            .map_err(|e| format!("Failed to copy to clipboard: {e}"))?;
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        use std::io::Write;
        use std::process::{Command, Stdio};
        let mut child = Command::new("pbcopy")
            .stdin(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn pbcopy: {e}"))?;
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
        }
        child.wait().map_err(|e| e.to_string())?;
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        use std::io::Write;
        use std::process::{Command, Stdio};
        if let Ok(mut child) = Command::new("xclip")
            .args(&["-selection", "clipboard"])
            .stdin(Stdio::piped())
            .spawn()
        {
            if let Some(mut stdin) = child.stdin.take() {
                let _ = stdin.write_all(text.as_bytes());
            }
            let _ = child.wait();
            return Ok(());
        }
        if let Ok(mut child) = Command::new("xsel")
            .args(&["--clipboard", "--input"])
            .stdin(Stdio::piped())
            .spawn()
        {
            if let Some(mut stdin) = child.stdin.take() {
                let _ = stdin.write_all(text.as_bytes());
            }
            let _ = child.wait();
            return Ok(());
        }
        Err("No clipboard utility found (xclip or xsel required)".to_string())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Unsupported platform for clipboard operations".to_string())
    }
}

/// Proxy a GET request to Yande.re API and return JSON body.
#[tauri::command]
pub async fn yandere_get(url: String) -> Result<serde_json::Value, String> {
    let resp = crate::http_client()
        .get(&url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        .send()
        .await
        .map_err(|e| format!("Yande.re request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Yande.re returned HTTP {}", resp.status().as_u16()));
    }

    resp.json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Yande.re JSON parse failed: {e}"))
}

use futures_util::StreamExt;
use tauri::Emitter;
use tokio::io::AsyncWriteExt;

#[derive(serde::Serialize, Clone)]
pub struct DownloadProgressPayload {
    pub id: String,
    pub filename: String,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub percent: u8,
    pub status: String,
    pub save_path: Option<String>,
    pub error_msg: Option<String>,
}

/// Download an artwork image file from URL with real-time progress events.
#[tauri::command]
pub async fn download_artwork_file(
    app_handle: tauri::AppHandle,
    id: String,
    url: String,
    filename: String,
    custom_dir: Option<String>,
) -> Result<String, String> {
    let target_dir = if let Some(ref dir) = custom_dir {
        if !dir.trim().is_empty() {
            std::path::PathBuf::from(dir)
        } else {
            dirs::download_dir().unwrap_or_else(|| std::path::PathBuf::from("."))
        }
    } else {
        dirs::download_dir().unwrap_or_else(|| std::path::PathBuf::from("."))
    };

    std::fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create download directory: {e}"))?;

    let save_path = target_dir.join(&filename);

    let _ = app_handle.emit(
        "download-progress",
        DownloadProgressPayload {
            id: id.clone(),
            filename: filename.clone(),
            bytes_downloaded: 0,
            total_bytes: 0,
            percent: 0,
            status: "downloading".to_string(),
            save_path: None,
            error_msg: None,
        },
    );

    let resp = crate::http_client()
        .get(&url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        .send()
        .await
        .map_err(|e| {
            let err_msg = format!("Download request failed: {e}");
            let _ = app_handle.emit(
                "download-progress",
                DownloadProgressPayload {
                    id: id.clone(),
                    filename: filename.clone(),
                    bytes_downloaded: 0,
                    total_bytes: 0,
                    percent: 0,
                    status: "error".to_string(),
                    save_path: None,
                    error_msg: Some(err_msg.clone()),
                },
            );
            err_msg
        })?;

    if !resp.status().is_success() {
        let err_msg = format!("Download returned HTTP {}", resp.status().as_u16());
        let _ = app_handle.emit(
            "download-progress",
            DownloadProgressPayload {
                id: id.clone(),
                filename: filename.clone(),
                bytes_downloaded: 0,
                total_bytes: 0,
                percent: 0,
                status: "error".to_string(),
                save_path: None,
                error_msg: Some(err_msg.clone()),
            },
        );
        return Err(err_msg);
    }

    let total_bytes = resp.content_length().unwrap_or(0);
    let mut file = tokio::fs::File::create(&save_path)
        .await
        .map_err(|e| format!("Failed to create output file: {e}"))?;

    let mut stream = resp.bytes_stream();
    let mut downloaded: u64 = 0;

    while let Some(chunk_res) = stream.next().await {
        let chunk = chunk_res.map_err(|e| format!("Error downloading chunk: {e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Error writing file: {e}"))?;
        downloaded += chunk.len() as u64;

        let percent = if total_bytes > 0 {
            ((downloaded as f64 / total_bytes as f64) * 100.0) as u8
        } else {
            50
        };

        let _ = app_handle.emit(
            "download-progress",
            DownloadProgressPayload {
                id: id.clone(),
                filename: filename.clone(),
                bytes_downloaded: downloaded,
                total_bytes,
                percent,
                status: "downloading".to_string(),
                save_path: None,
                error_msg: None,
            },
        );
    }

    let _ = file.flush().await;
    let final_path_str = save_path.to_string_lossy().to_string();

    let _ = app_handle.emit(
        "download-progress",
        DownloadProgressPayload {
            id: id.clone(),
            filename: filename.clone(),
            bytes_downloaded: downloaded,
            total_bytes,
            percent: 100,
            status: "completed".to_string(),
            save_path: Some(final_path_str.clone()),
            error_msg: None,
        },
    );

    Ok(final_path_str)
}



