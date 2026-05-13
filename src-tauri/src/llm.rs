//! Cleanup dispatcher.
//!
//! Single entry point used by `run_pipeline` and `cleanup_preview`. Routes
//! the cleanup request to either the bundled `llama-server` sidecar (default)
//! or the legacy external Ollama daemon, based on `Settings.llm_backend`.

use anyhow::{anyhow, Result};
use serde_json::json;
use std::path::PathBuf;
use tauri::AppHandle;

use crate::{llama_server, llm_prompt, ollama, Settings};

pub const BACKEND_BUNDLED: &str = "bundled";
pub const BACKEND_EXTERNAL_OLLAMA: &str = "external_ollama";

pub async fn cleanup(
    app: &AppHandle,
    settings: &Settings,
    text: &str,
    language: &str,
    extra_style: &str,
) -> Result<String> {
    match settings.llm_backend.as_str() {
        BACKEND_EXTERNAL_OLLAMA => {
            ollama::cleanup(text, &settings.ollama_model, language, extra_style).await
        }
        _ => bundled_cleanup(app, settings, text, language, extra_style).await,
    }
}

async fn bundled_cleanup(
    app: &AppHandle,
    settings: &Settings,
    text: &str,
    language: &str,
    extra_style: &str,
) -> Result<String> {
    let text = text.trim();
    if text.is_empty() {
        return Ok(String::new());
    }

    let model_path: PathBuf = settings
        .llm_model_path
        .as_ref()
        .map(PathBuf::from)
        .unwrap_or_else(crate::llm_download::default_model_path);

    if !model_path.exists() {
        return Err(anyhow!(
            "Cleanup model is not downloaded yet. Open Settings → AI cleanup to download it."
        ));
    }

    let lang_name = llm_prompt::language_display_name(language);
    let fillers = llm_prompt::fillers_for(language);
    let delimiter = llm_prompt::make_delimiter();

    let system = llm_prompt::make_cleanup_system_message(lang_name);
    let user_msg =
        llm_prompt::make_cleanup_user_message(text, lang_name, fillers, extra_style, &delimiter);
    let num_predict = llm_prompt::estimate_num_predict(text);

    // llama-server's OpenAI-compatible /v1/chat/completions endpoint.
    // `max_tokens` is the OpenAI-equivalent of Ollama's `num_predict`.
    let body = json!({
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user_msg }
        ],
        "temperature": 0.0,
        "max_tokens": num_predict,
        "stream": false,
    });

    let raw = llama_server::chat_completions(app, &model_path, body).await?;
    let cleaned = llm_prompt::clean_model_output(&raw);

    if cleaned.trim().is_empty() {
        return Err(anyhow!("Cleanup returned an empty result"));
    }

    Ok(cleaned)
}
