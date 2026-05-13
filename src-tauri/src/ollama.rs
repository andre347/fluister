//! External-Ollama backend for cleanup.
//!
//! Used when `Settings.llm_backend == "external_ollama"` (advanced toggle in
//! Settings → AI cleanup). New installs default to the bundled `llama-server`
//! sidecar (see `llama_server.rs` + `llm.rs`); this module is here purely to
//! preserve the workflow of users who already had Ollama running before the
//! sidecar migration.

use anyhow::{anyhow, Result};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::json;
use std::sync::OnceLock;
use std::time::Duration;

use crate::llm_prompt;

const OLLAMA_BASE_URL: &str = "http://127.0.0.1:11434";
const LIST_MODELS_TIMEOUT: Duration = Duration::from_secs(5);
const CLEANUP_TIMEOUT: Duration = Duration::from_secs(120);

static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

#[derive(Debug, Deserialize)]
struct ChatResponse {
    message: ChatMessage,

    // Parsed from Ollama's response shape but unused — we drive control
    // flow off `done_reason`. Kept so the response struct mirrors the
    // wire format and future readers don't go hunting for it.
    #[serde(default)]
    #[allow(dead_code)]
    done: bool,

    #[serde(default)]
    done_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChatMessage {
    content: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct OllamaModel {
    pub name: String,
    pub size_bytes: u64,
    pub family: String,
    pub parameter_size: String,
}

#[derive(Debug, Deserialize)]
struct TagsResponse {
    #[serde(default)]
    models: Vec<RawModel>,
}

#[derive(Debug, Deserialize)]
struct RawModel {
    name: String,

    #[serde(default)]
    size: u64,

    #[serde(default, deserialize_with = "default_on_null")]
    details: RawDetails,
}

#[derive(Debug, Deserialize, Default)]
struct RawDetails {
    #[serde(default)]
    family: Option<String>,

    #[serde(default)]
    parameter_size: Option<String>,
}

fn default_on_null<'de, D, T>(deserializer: D) -> std::result::Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de> + Default,
{
    let value = Option::<T>::deserialize(deserializer)?;
    Ok(value.unwrap_or_default())
}

fn http_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(2))
            .build()
            .expect("failed to build reqwest client")
    })
}

fn ollama_url(path: &str) -> String {
    format!(
        "{}/{}",
        OLLAMA_BASE_URL.trim_end_matches('/'),
        path.trim_start_matches('/')
    )
}

/// Asks the local Ollama daemon for installed models. Returns an empty list
/// if Ollama is reachable but has nothing pulled, and an Err if Ollama isn't
/// running at all, so the UI can show a "start Ollama" hint.
pub async fn list_models() -> Result<Vec<OllamaModel>> {
    let resp = http_client()
        .get(ollama_url("/api/tags"))
        .timeout(LIST_MODELS_TIMEOUT)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                anyhow!("Ollama did not respond within 5 seconds at 127.0.0.1:11434")
            } else {
                anyhow!("Ollama not reachable at 127.0.0.1:11434 — {e}")
            }
        })?;

    let status = resp.status();

    if !status.is_success() {
        let body = response_body_for_error(resp).await;
        return Err(anyhow!("Ollama responded with {status}: {body}"));
    }

    let parsed: TagsResponse = resp
        .json()
        .await
        .map_err(|e| anyhow!("Failed to parse Ollama model list: {e}"))?;

    let mut models: Vec<OllamaModel> = parsed
        .models
        .into_iter()
        .map(|m| OllamaModel {
            name: m.name,
            size_bytes: m.size,
            family: non_empty_or_unknown(m.details.family.unwrap_or_default()),
            parameter_size: non_empty_or_unknown(m.details.parameter_size.unwrap_or_default()),
        })
        .collect();

    models.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(models)
}

/// Clean up a raw dictation through the local Ollama daemon.
pub async fn cleanup(
    text: &str,
    model: &str,
    language: &str,
    extra_style: &str,
) -> Result<String> {
    let text = text.trim();

    if text.is_empty() {
        return Ok(String::new());
    }

    if model.trim().is_empty() {
        return Err(anyhow!("No Ollama model selected"));
    }

    let lang_name = llm_prompt::language_display_name(language);
    let fillers = llm_prompt::fillers_for(language);
    let delimiter = llm_prompt::make_delimiter();

    let system = llm_prompt::make_cleanup_system_message(lang_name);
    let user_msg =
        llm_prompt::make_cleanup_user_message(text, lang_name, fillers, extra_style, &delimiter);

    let num_predict = llm_prompt::estimate_num_predict(text);

    // Use the chat API rather than /api/generate. Chat-tuned models treat
    // the input as a turn rather than a document to continue, which makes
    // them less likely to echo examples or labels.
    let body = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user_msg }
        ],
        "stream": false,
        "keep_alive": "5m",
        "options": {
            "temperature": 0.0,
            "num_predict": num_predict
        }
    });

    let resp = http_client()
        .post(ollama_url("/api/chat"))
        .timeout(CLEANUP_TIMEOUT)
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                anyhow!(
                    "Ollama cleanup timed out after {} seconds. The model may still be loading, or the dictation may be too long.",
                    CLEANUP_TIMEOUT.as_secs()
                )
            } else {
                anyhow!("Ollama request failed: {e}")
            }
        })?;

    let status = resp.status();

    if !status.is_success() {
        let body = response_body_for_error(resp).await;

        if body.contains("model") && body.contains("not found") {
            return Err(anyhow!(
                "Ollama model '{model}' was not found. Pull it with: ollama pull {model}"
            ));
        }

        return Err(anyhow!("Ollama responded with {status}: {body}"));
    }

    let parsed: ChatResponse = resp
        .json()
        .await
        .map_err(|e| anyhow!("Failed to parse Ollama cleanup response: {e}"))?;

    if parsed.done_reason.as_deref() == Some("length") {
        return Err(anyhow!(
            "Ollama output was truncated. Try a shorter dictation, a model with a larger context window, or increase num_predict."
        ));
    }

    let cleaned = llm_prompt::clean_model_output(&parsed.message.content);

    if cleaned.trim().is_empty() && !text.is_empty() {
        return Err(anyhow!("Ollama returned an empty cleanup result"));
    }

    Ok(cleaned)
}

async fn response_body_for_error(resp: reqwest::Response) -> String {
    let body = resp.text().await.unwrap_or_else(|_| String::new());
    let body = body.trim();

    if body.is_empty() {
        return "empty response body".to_string();
    }

    truncate_for_error(body, 2_000)
}

fn truncate_for_error(value: &str, max_chars: usize) -> String {
    let mut out = String::new();

    for (idx, ch) in value.chars().enumerate() {
        if idx >= max_chars {
            out.push_str("...");
            break;
        }

        out.push(ch);
    }

    out
}

fn non_empty_or_unknown(value: String) -> String {
    let trimmed = value.trim();

    if trimmed.is_empty() {
        "unknown".to_string()
    } else {
        trimmed.to_string()
    }
}
