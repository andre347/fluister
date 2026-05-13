//! Downloader for the cleanup LLM (gguf format, served by `llama-server`).
//!
//! Mirrors `model_download.rs` for the Whisper models — same throttled
//! progress events, `.download` temp-file pattern, atomic rename — and
//! emits `llm-download-progress` / `llm-download-done` / `llm-download-failed`
//! for the onboarding + Settings UIs.

use anyhow::{anyhow, Context, Result};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

/// Catalog of cleanup models we know how to download. Currently a single
/// entry — the bundled default that ships with Fluister. Kept as a list so
/// it's trivial to expose a "small / medium / large" picker later if users
/// want to trade quality for disk.
pub const CATALOG: &[LlmEntry] = &[LlmEntry {
    id: "llama-3.2-3b-instruct-q4_k_m",
    filename: "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    label: "Llama 3.2 3B Instruct — Q4_K_M",
    // bartowski's GGUF conversions are the de-facto source for chat-tuned
    // quants. Pinned via the resolve URL so HF mirror redirects work.
    url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    size_bytes: 2_019_377_472, // ~2.0 GB, used for UI before HEAD lands
}];

#[derive(Debug, Clone, Copy)]
pub struct LlmEntry {
    pub id: &'static str,
    pub filename: &'static str,
    pub label: &'static str,
    pub url: &'static str,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct LlmModelInfo {
    pub id: String,
    pub filename: String,
    pub label: String,
    pub size_bytes: u64,
    pub installed: bool,
    pub active: bool,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct LlmDownloadProgress {
    pub id: String,
    pub filename: String,
    pub downloaded: u64,
    pub total: u64,
    pub bytes_per_sec: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct LlmDownloadDone {
    pub id: String,
    pub filename: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct LlmDownloadFailed {
    pub id: String,
    pub error: String,
}

pub fn models_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("fluister/llm-models")
}

pub fn default_model_path() -> PathBuf {
    models_dir().join(CATALOG[0].filename)
}

pub fn list(active_path: &str) -> Vec<LlmModelInfo> {
    let dir = models_dir();
    let active_pathbuf = Path::new(active_path);
    CATALOG
        .iter()
        .map(|m| {
            let path = dir.join(m.filename);
            let installed = path.exists();
            let active = installed && active_pathbuf == path.as_path();
            LlmModelInfo {
                id: m.id.into(),
                filename: m.filename.into(),
                label: m.label.into(),
                size_bytes: m.size_bytes,
                installed,
                active,
                path: path.to_string_lossy().into_owned(),
            }
        })
        .collect()
}

pub async fn download(app: AppHandle, id: String) -> Result<PathBuf> {
    let entry = CATALOG
        .iter()
        .find(|m| m.id == id)
        .ok_or_else(|| anyhow!("unknown LLM: {id}"))?;

    let dir = models_dir();
    tokio::fs::create_dir_all(&dir)
        .await
        .context("creating llm-models directory")?;
    let final_path = dir.join(entry.filename);
    let temp_path = dir.join(format!("{}.download", entry.filename));

    let response = reqwest::Client::new()
        .get(entry.url)
        .send()
        .await
        .context("starting download")?
        .error_for_status()
        .context("server returned an error")?;

    let total = response.content_length().unwrap_or(entry.size_bytes);

    let mut response = response;
    let mut file = tokio::fs::File::create(&temp_path)
        .await
        .context("creating temp file")?;

    let mut downloaded: u64 = 0;
    let mut last_emit = Instant::now();
    let mut last_bytes: u64 = 0;

    while let Some(chunk) = response
        .chunk()
        .await
        .context("reading download chunk")?
    {
        file.write_all(&chunk)
            .await
            .context("writing download chunk")?;
        downloaded += chunk.len() as u64;

        let elapsed = last_emit.elapsed();
        if elapsed.as_millis() >= 200 {
            let bytes_per_sec = if elapsed.as_secs_f64() > 0.0 {
                ((downloaded - last_bytes) as f64 / elapsed.as_secs_f64()) as u64
            } else {
                0
            };
            last_emit = Instant::now();
            last_bytes = downloaded;
            let _ = app.emit(
                "llm-download-progress",
                LlmDownloadProgress {
                    id: entry.id.into(),
                    filename: entry.filename.into(),
                    downloaded,
                    total,
                    bytes_per_sec,
                },
            );
        }
    }

    file.flush().await.context("flushing temp file")?;
    drop(file);

    tokio::fs::rename(&temp_path, &final_path)
        .await
        .context("renaming temp file into place")?;

    let _ = app.emit(
        "llm-download-progress",
        LlmDownloadProgress {
            id: entry.id.into(),
            filename: entry.filename.into(),
            downloaded: total,
            total,
            bytes_per_sec: 0,
        },
    );
    let _ = app.emit(
        "llm-download-done",
        LlmDownloadDone {
            id: entry.id.into(),
            filename: entry.filename.into(),
            path: final_path.to_string_lossy().into_owned(),
        },
    );

    Ok(final_path)
}
