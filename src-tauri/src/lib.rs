use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct CobaltRequest {
    pub url: String,
    #[serde(rename = "videoQuality")]
    pub video_quality: Option<String>,
    #[serde(rename = "audioFormat")]
    pub audio_format: Option<String>,
    #[serde(rename = "audioBitrate")]
    pub audio_bitrate: Option<String>,
    #[serde(rename = "filenameStyle")]
    pub filename_style: Option<String>,
    #[serde(rename = "downloadMode")]
    pub download_mode: Option<String>,
    #[serde(rename = "youtubeVideoCodec")]
    pub youtube_video_codec: Option<String>,
    #[serde(rename = "youtubeDubLang")]
    pub youtube_dub_lang: Option<String>,
    #[serde(rename = "alwaysProxy")]
    pub always_proxy: Option<bool>,
    #[serde(rename = "disableMetadata")]
    pub disable_metadata: Option<bool>,
    #[serde(rename = "tiktokFullAudio")]
    pub tiktok_full_audio: Option<bool>,
    #[serde(rename = "tiktokH265")]
    pub tiktok_h265: Option<bool>,
    #[serde(rename = "twitterGif")]
    pub twitter_gif: Option<bool>,
    #[serde(rename = "youtubeHLS")]
    pub youtube_hls: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CobaltResponse {
    pub status: String,
    pub url: Option<String>,
    pub filename: Option<String>,
    pub audio: Option<String>,
    #[serde(rename = "audioFilename")]
    pub audio_filename: Option<String>,
    pub picker: Option<Vec<PickerItem>>,
    pub error: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PickerItem {
    #[serde(rename = "type")]
    pub item_type: Option<String>,
    pub url: String,
    pub thumb: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerInfo {
    pub cobalt: Option<serde_json::Value>,
    pub git: Option<serde_json::Value>,
}

#[tauri::command]
async fn cobalt_request(
    api_url: String,
    url: String,
    download_mode: String,
    video_quality: String,
    audio_format: String,
    audio_bitrate: String,
    filename_style: String,
    youtube_video_codec: String,
    always_proxy: bool,
    disable_metadata: bool,
    tiktok_full_audio: bool,
    tiktok_h265: bool,
    twitter_gif: bool,
    youtube_hls: bool,
    api_token: Option<String>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();

    let mut body: HashMap<String, serde_json::Value> = HashMap::new();
    body.insert("url".into(), serde_json::Value::String(url));
    body.insert("downloadMode".into(), serde_json::Value::String(download_mode));
    
    if !video_quality.is_empty() && video_quality != "1080" { body.insert("videoQuality".into(), serde_json::Value::String(video_quality)); }
    else if !video_quality.is_empty() { body.insert("videoQuality".into(), serde_json::Value::String(video_quality)); } // actually let's just send it if not empty
    
    if !audio_format.is_empty() { body.insert("audioFormat".into(), serde_json::Value::String(audio_format)); }
    if !audio_bitrate.is_empty() && audio_bitrate != "128" { body.insert("audioBitrate".into(), serde_json::Value::String(audio_bitrate)); }
    if !filename_style.is_empty() && filename_style != "classic" { body.insert("filenamePattern".into(), serde_json::Value::String(filename_style)); }
    if !youtube_video_codec.is_empty() && youtube_video_codec != "h264" { body.insert("youtubeVideoCodec".into(), serde_json::Value::String(youtube_video_codec)); }
    
    if always_proxy { body.insert("alwaysProxy".into(), serde_json::Value::Bool(true)); }
    if disable_metadata { body.insert("disableMetadata".into(), serde_json::Value::Bool(true)); }
    if tiktok_full_audio { body.insert("tiktokFullAudio".into(), serde_json::Value::Bool(true)); }
    if tiktok_h265 { body.insert("tiktokH265".into(), serde_json::Value::Bool(true)); }
    // Note: the default for twitterGif in the UI might be true, but in cobalt it's false? Wait.
    // Let's send twitter_gif if it's true
    if twitter_gif { body.insert("twitterGif".into(), serde_json::Value::Bool(true)); }
    if youtube_hls { body.insert("youtubeHLS".into(), serde_json::Value::Bool(true)); }

    let mut request = client
        .post(&api_url)
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");

    if let Some(token) = api_token {
        if !token.trim().is_empty() {
            request = request.header("Authorization", format!("Bearer {}", token.trim()));
            request = request.header("Api-Key", token.trim()); // For backward compatibility with some v7 instances
        }
    }

    let response = request
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if text.trim().is_empty() {
        return Err(format!("Empty response from server (HTTP {})", status));
    }

    let json: serde_json::Value = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(e) => {
            let preview = if text.len() > 200 { &text[..200] } else { &text };
            return Err(format!("Invalid JSON (HTTP {}): {} — body: {}", status, e, preview));
        }
    };

    if !status.is_success() && json.get("status").and_then(|s| s.as_str()) != Some("error") {
        return Err(format!("HTTP {}: {}", status, text));
    }

    Ok(json)
}

#[tauri::command]
async fn cobalt_server_info(api_url: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();

    let response = client
        .get(&api_url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(json)
}

#[tauri::command]
async fn download_file(url: String, filename: String, save_path: Option<String>) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .header("Accept", "*/*")
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("Download server returned HTTP {}", status));
    }

    // Check content-type to make sure we're getting media, not an error page
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    if content_type.contains("text/html") || content_type.contains("application/json") {
        let text = response.text().await.unwrap_or_default();
        let preview = if text.len() > 200 { &text[..200] } else { &text };
        return Err(format!("Server returned {} instead of a media file: {}", content_type, preview));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read bytes: {}", e))?;

    // Check if the file is completely empty (often happens when YouTube blocks the instance)
    if bytes.len() == 0 {
        return Err(format!("The server returned an empty file. This usually means the instance is being blocked by YouTube. Try another instance or use your local one."));
    }

    // Sanity check: if the file is suspiciously small, it's probably an error page
    if bytes.len() < 1024 {
        let preview = String::from_utf8_lossy(&bytes[..bytes.len().min(256)]);
        if preview.contains("<html") || preview.contains("<!DOCTYPE") || preview.contains("error") {
            return Err(format!("Server returned an error page instead of the file"));
        }
    }

    // Use the save_path from the dialog, or fall back to downloads folder
    let file_path = if let Some(path) = save_path {
        std::path::PathBuf::from(path)
    } else {
        let download_dir = dirs_next::download_dir()
            .or_else(|| dirs_next::home_dir().map(|h| h.join("Downloads")))
            .ok_or("Could not determine downloads directory")?;
        download_dir.join(&filename)
    };

    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    std::fs::write(&file_path, &bytes)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn download_with_ytdlp(app: tauri::AppHandle, url: String, filename: String, save_path: Option<String>) -> Result<String, String> {
    let file_path = if let Some(path) = save_path {
        std::path::PathBuf::from(path)
    } else {
        let download_dir = dirs_next::download_dir()
            .or_else(|| dirs_next::home_dir().map(|h| h.join("Downloads")))
            .ok_or("Could not determine downloads directory")?;
        download_dir.join(&filename)
    };

    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Try to get the best single file with video+audio (mp4 preferred)
    let output = app.shell()
        .command("yt-dlp")
        .args(["-f", "best[ext=mp4]/best", "-o", file_path.to_str().unwrap(), &url])
        .output()
        .await
        .map_err(|e| format!("Failed to execute yt-dlp sidecar: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp error: {}", stderr));
    }

    // Check if the file was actually created
    if !file_path.exists() {
        return Err("yt-dlp completed but the file was not found.".to_string());
    }

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn get_ytdlp_metadata(app: tauri::AppHandle, url: String) -> Result<String, String> {
    let output = app.shell()
        .command("yt-dlp")
        .args(["-f", "best[ext=mp4]/best", "--print", "filename", "-o", "%(title)s.%(ext)s", &url])
        .output()
        .await
        .map_err(|e| format!("Failed to execute yt-dlp sidecar: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp error: {}", stderr));
    }

    let filename = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(filename)
}

#[tauri::command]
async fn nest_exchange_code(code: String) -> Result<String, String> {
    // Exchange the OAuth authorization code for an access token.
    // The client_secret lives here in Rust — never exposed to the frontend.
    let client_id     = "a8b00d4a-652c-4301-a7d6-3764be0d9e2e";
    let client_secret = env!("NEST_CLIENT_SECRET"); // set via env var at build time
    let redirect_uri  = "santi-tools://auth/callback";

    let client = reqwest::Client::new();
    let params = [
        ("grant_type",    "authorization_code"),
        ("code",          code.as_str()),
        ("redirect_uri",  redirect_uri),
        ("client_id",     client_id),
        ("client_secret", client_secret),
    ];

    let resp = client
        .post("https://nest.rip/api/oauth/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Token request failed: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Token exchange failed: {}", text));
    }

    let json: serde_json::Value = resp.json().await
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    let access_token = json["access_token"]
        .as_str()
        .ok_or("No access_token in response")?
        .to_string();

    Ok(access_token)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            cobalt_request,
            cobalt_server_info,
            download_file,
            download_with_ytdlp,
            get_ytdlp_metadata,
            nest_exchange_code
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
