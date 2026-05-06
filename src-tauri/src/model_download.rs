use anyhow::{anyhow, Context, Result};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

const HF_BASE: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

/// Catalog of Whisper ggml models we know how to download. Sizes are the
/// approximate file sizes on disk in bytes — used for UI before the HTTP
/// HEAD comes back.
pub const CATALOG: &[ModelEntry] = &[
    ModelEntry { filename: "ggml-tiny.en.bin",    label: "Tiny — English only",      multilingual: false, size_bytes: 39_456_896 },
    ModelEntry { filename: "ggml-tiny.bin",       label: "Tiny — Multilingual",      multilingual: true,  size_bytes: 39_456_896 },
    ModelEntry { filename: "ggml-base.en.bin",    label: "Base — English only",      multilingual: false, size_bytes: 147_964_416 },
    ModelEntry { filename: "ggml-base.bin",       label: "Base — Multilingual",      multilingual: true,  size_bytes: 147_964_416 },
    ModelEntry { filename: "ggml-small.en.bin",   label: "Small — English only",     multilingual: false, size_bytes: 487_940_224 },
    ModelEntry { filename: "ggml-small.bin",      label: "Small — Multilingual",     multilingual: true,  size_bytes: 487_940_224 },
    ModelEntry { filename: "ggml-medium.en.bin",  label: "Medium — English only",    multilingual: false, size_bytes: 1_533_641_344 },
    ModelEntry { filename: "ggml-medium.bin",     label: "Medium — Multilingual",    multilingual: true,  size_bytes: 1_533_641_344 },
    ModelEntry { filename: "ggml-large-v3.bin",   label: "Large v3 — Multilingual",  multilingual: true,  size_bytes: 3_094_293_504 },
];

#[derive(Debug, Clone, Copy)]
pub struct ModelEntry {
    pub filename: &'static str,
    pub label: &'static str,
    pub multilingual: bool,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ModelInfo {
    pub filename: String,
    pub label: String,
    pub multilingual: bool,
    pub size_bytes: u64,
    pub installed: bool,
    pub active: bool,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub filename: String,
    pub downloaded: u64,
    pub total: u64,
    pub bytes_per_sec: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadDone {
    pub filename: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadFailed {
    pub filename: String,
    pub error: String,
}

pub fn models_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("fluister/models")
}

pub fn list(active_path: &str) -> Vec<ModelInfo> {
    let dir = models_dir();
    let active_pathbuf = Path::new(active_path);
    CATALOG
        .iter()
        .map(|m| {
            let path = dir.join(m.filename);
            let installed = path.exists();
            let active = installed && active_pathbuf == path.as_path();
            ModelInfo {
                filename: m.filename.into(),
                label: m.label.into(),
                multilingual: m.multilingual,
                size_bytes: m.size_bytes,
                installed,
                active,
                path: path.to_string_lossy().into_owned(),
            }
        })
        .collect()
}

pub async fn download(app: AppHandle, filename: String) -> Result<PathBuf> {
    let entry = CATALOG
        .iter()
        .find(|m| m.filename == filename)
        .ok_or_else(|| anyhow!("unknown model: {filename}"))?;

    let dir = models_dir();
    tokio::fs::create_dir_all(&dir)
        .await
        .context("creating models directory")?;
    let final_path = dir.join(entry.filename);
    let temp_path = dir.join(format!("{}.download", entry.filename));

    let url = format!("{HF_BASE}/{}", entry.filename);
    let response = reqwest::Client::new()
        .get(&url)
        .send()
        .await
        .context("starting download")?
        .error_for_status()
        .context("server returned an error")?;

    let total = response.content_length().unwrap_or(entry.size_bytes);

    // Stream chunks to a `.download` temp file, then atomically rename so a
    // partial file never masquerades as a finished one.
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

        // Throttle UI updates to ~5/sec — emitting every chunk floods the
        // Tauri event channel and tanks the JS render loop on big downloads.
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
                "model-download-progress",
                DownloadProgress {
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

    // Final 100% tick so the UI can settle the bar before swapping to "Active".
    let _ = app.emit(
        "model-download-progress",
        DownloadProgress {
            filename: entry.filename.into(),
            downloaded: total,
            total,
            bytes_per_sec: 0,
        },
    );
    let _ = app.emit(
        "model-download-done",
        DownloadDone {
            filename: entry.filename.into(),
            path: final_path.to_string_lossy().into_owned(),
        },
    );

    Ok(final_path)
}
