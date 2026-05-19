//! Model Context Protocol server.
//!
//! Lets external AI clients (Claude Desktop, Cursor, Claude Code, Zed) read
//! the user's dictation history, run the cleanup pipeline against arbitrary
//! text, and append into the vault. Runs only when the user enables it from
//! Settings → Integrations. Always binds to 127.0.0.1 — never accessible
//! over the LAN.
//!
//! The wire transport is rmcp's `StreamableHttpService`, mounted on a tiny
//! axum router. We deliberately use a single fixed port (43210) so users
//! can paste a static config snippet into their MCP client and never have
//! to chase a moving target.

use anyhow::{anyhow, Context, Result};
use rmcp::{
    handler::server::router::tool::ToolRouter,
    model::{CallToolResult, Content, ServerCapabilities, ServerInfo},
    schemars::{self, JsonSchema},
    tool, tool_handler, tool_router,
    transport::streamable_http_server::{
        session::local::LocalSessionManager, StreamableHttpServerConfig, StreamableHttpService,
    },
    ErrorData as McpError, ServerHandler,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::net::TcpListener;
use tokio_util::sync::CancellationToken;

use crate::{db, llm, AppState, Settings};

/// Loopback-only bind. The MCP server is a local-IPC convenience for AI
/// clients running on the same Mac, not a remote API.
pub const DEFAULT_PORT: u16 = 43210;

/// Handle returned by `spawn` so the lifecycle layer can stop the server
/// when the user disables MCP in Settings.
pub struct ServerHandle {
    cancel: CancellationToken,
    join: tokio::task::JoinHandle<()>,
}

impl ServerHandle {
    pub async fn shutdown(self) {
        self.cancel.cancel();
        let _ = self.join.await;
    }
}

/// Service struct passed to rmcp. Holds an AppHandle so tools can reach
/// the database, settings, and the cleanup pipeline through `AppState`.
#[derive(Clone)]
pub struct FluisterService {
    app: AppHandle,
    tool_router: ToolRouter<Self>,
}

impl FluisterService {
    fn new(app: AppHandle) -> Self {
        Self {
            tool_router: Self::tool_router(),
            app,
        }
    }

    fn state(&self) -> tauri::State<'_, AppState> {
        self.app.state::<AppState>()
    }
}

// ─── Tool inputs ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct SearchInput {
    /// Text to match in the cleaned or raw transcript. Case-insensitive
    /// substring match.
    pub query: String,
    /// Max number of results. Defaults to 20.
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct RecentInput {
    /// How many of the most-recent dictations to return. Defaults to 10.
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct GetInput {
    /// Numeric dictation id (returned by search/recent).
    pub id: i64,
}

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct CleanTextInput {
    /// Raw text to pass through Fluister's cleanup pipeline.
    pub text: String,
    /// Optional profile id whose `style_prompt` is appended to the cleanup
    /// instructions. Omit to use the user's current active profile (no
    /// style override).
    #[serde(default)]
    pub profile_id: Option<i64>,
}

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct AppendVaultInput {
    /// Path relative to the user's vault root, e.g. `notes/inbox.md`.
    /// Parent directories are created if missing. Absolute paths are
    /// rejected for safety — the tool can only write inside the vault.
    pub path: String,
    /// Content to append. A trailing newline is added if missing.
    pub content: String,
}

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct AddVocabularyInput {
    /// Canonical term (the way you want Whisper to spell it).
    pub term: String,
    /// Phonetic variants Whisper sometimes hears instead. Empty list is
    /// fine for terms you just want biased into the model's vocabulary.
    #[serde(default)]
    pub aliases: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct ReadVaultInput {
    /// Path relative to the user's vault root. Absolute paths and `..`
    /// segments are rejected for the same reason as in append_to_vault —
    /// the tool can only read files inside the vault.
    pub path: String,
}

/// Placeholder input for tools that take no parameters. Forces the
/// generated JSON Schema to be a proper `{ "type": "object", ... }`
/// shape rather than an empty `{}` — Claude Code (and any other strict
/// MCP client) rejects the latter as a validation failure.
#[derive(Debug, Default, Deserialize, Serialize, JsonSchema)]
pub struct NoInput {}

// ─── Tool outputs ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct DictationSummary {
    id: i64,
    created_at_ms: i64,
    cleaned_text: String,
    raw_text: String,
    duration_ms: i64,
    favorite: bool,
    profile_id: Option<i64>,
}

impl From<&db::Dictation> for DictationSummary {
    fn from(d: &db::Dictation) -> Self {
        Self {
            id: d.id,
            created_at_ms: d.created_at,
            cleaned_text: d.cleaned_text.clone(),
            raw_text: d.raw_text.clone(),
            duration_ms: d.duration_ms,
            favorite: d.favorite,
            profile_id: d.profile_id,
        }
    }
}

#[derive(Debug, Serialize)]
struct ProfileSummary {
    id: i64,
    name: String,
    description: String,
    style_prompt: String,
    app_bindings: Vec<String>,
}

impl From<&db::Profile> for ProfileSummary {
    fn from(p: &db::Profile) -> Self {
        Self {
            id: p.id,
            name: p.name.clone(),
            description: p.description.clone(),
            style_prompt: p.style_prompt.clone(),
            app_bindings: p.app_bindings.clone(),
        }
    }
}

#[derive(Debug, Serialize)]
struct VocabSummary {
    id: i64,
    term: String,
    aliases: Vec<String>,
}

impl From<&db::VocabularyEntry> for VocabSummary {
    fn from(v: &db::VocabularyEntry) -> Self {
        Self {
            id: v.id,
            term: v.term.clone(),
            aliases: v.aliases.clone(),
        }
    }
}

// ─── Tools ────────────────────────────────────────────────────────────────

#[tool_router]
impl FluisterService {
    #[tool(description = "Search the user's dictation history. Matches against both the cleaned and raw transcript. Returns the most-recent N matches in descending time order.")]
    async fn search_dictations(
        &self,
        params: rmcp::handler::server::wrapper::Parameters<SearchInput>,
    ) -> Result<CallToolResult, McpError> {
        let input = params.0;
        let limit = input.limit.unwrap_or(20).clamp(1, 200);
        let rows = self
            .state()
            .db
            .list(limit, 0, false, Some(input.query.clone()))
            .map_err(map_err)?;
        let payload: Vec<DictationSummary> = rows.iter().map(DictationSummary::from).collect();
        Ok(CallToolResult::success(vec![json_content(&payload)?]))
    }

    #[tool(description = "Return the most recent dictations in reverse chronological order. Useful when you want context for what the user just said without filtering.")]
    async fn recent_dictations(
        &self,
        params: rmcp::handler::server::wrapper::Parameters<RecentInput>,
    ) -> Result<CallToolResult, McpError> {
        let limit = params.0.limit.unwrap_or(10).clamp(1, 200);
        let rows = self
            .state()
            .db
            .list(limit, 0, false, None)
            .map_err(map_err)?;
        let payload: Vec<DictationSummary> = rows.iter().map(DictationSummary::from).collect();
        Ok(CallToolResult::success(vec![json_content(&payload)?]))
    }

    #[tool(description = "Fetch a single dictation by its numeric id. Use ids returned by search_dictations or recent_dictations.")]
    async fn get_dictation(
        &self,
        params: rmcp::handler::server::wrapper::Parameters<GetInput>,
    ) -> Result<CallToolResult, McpError> {
        let row = self
            .state()
            .db
            .get(params.0.id)
            .map_err(map_err)?
            .ok_or_else(|| McpError::invalid_params("dictation not found", None))?;
        let payload = DictationSummary::from(&row);
        Ok(CallToolResult::success(vec![json_content(&payload)?]))
    }

    #[tool(description = "Run arbitrary text through Fluister's cleanup pipeline. Optionally pass a profile id to use that profile's style instructions. Returns the cleaned text.")]
    async fn clean_text(
        &self,
        params: rmcp::handler::server::wrapper::Parameters<CleanTextInput>,
    ) -> Result<CallToolResult, McpError> {
        let input = params.0;
        let state = self.state();
        let settings_snapshot: Settings = state.settings.lock().clone();
        let style_prompt = match input.profile_id {
            Some(pid) => state
                .db
                .get_profile(pid)
                .map_err(map_err)?
                .map(|p| p.style_prompt)
                .unwrap_or_default(),
            None => String::new(),
        };
        let cleaned = llm::cleanup(
            &self.app,
            &settings_snapshot,
            &input.text,
            &settings_snapshot.language,
            &style_prompt,
        )
        .await
        .map_err(map_err)?;
        Ok(CallToolResult::success(vec![Content::text(cleaned)]))
    }

    #[tool(description = "Append text to a file inside the user's Fluister vault. The path is relative to the vault root; parent directories are created if missing. Returns the absolute path written to.")]
    async fn append_to_vault(
        &self,
        params: rmcp::handler::server::wrapper::Parameters<AppendVaultInput>,
    ) -> Result<CallToolResult, McpError> {
        let input = params.0;
        let state = self.state();
        let vault_root = state
            .settings
            .lock()
            .vault_path
            .clone()
            .ok_or_else(|| McpError::invalid_request("no vault configured — set one in Settings → Storage", None))?;
        let abs =
            append_under_vault(&vault_root, &input.path, &input.content).map_err(map_err)?;
        Ok(CallToolResult::success(vec![Content::text(
            abs.to_string_lossy().to_string(),
        )]))
    }

    #[tool(description = "Read a file from the user's Fluister vault. Returns the file's text contents. Same path safety rules as append_to_vault.")]
    async fn read_vault(
        &self,
        params: rmcp::handler::server::wrapper::Parameters<ReadVaultInput>,
    ) -> Result<CallToolResult, McpError> {
        let input = params.0;
        let state = self.state();
        let vault_root = state
            .settings
            .lock()
            .vault_path
            .clone()
            .ok_or_else(|| McpError::invalid_request("no vault configured — set one in Settings → Storage", None))?;
        let content = read_under_vault(&vault_root, &input.path).map_err(map_err)?;
        Ok(CallToolResult::success(vec![Content::text(content)]))
    }

    #[tool(description = "List the user's cleanup profiles. Returns each profile's id, name, description, and style_prompt. Use the id with clean_text to apply the profile's tone.")]
    async fn list_profiles(
        &self,
        _params: rmcp::handler::server::wrapper::Parameters<NoInput>,
    ) -> Result<CallToolResult, McpError> {
        let state = self.state();
        let rows = state.db.list_profiles().map_err(map_err)?;
        let payload: Vec<ProfileSummary> = rows.iter().map(ProfileSummary::from).collect();
        Ok(CallToolResult::success(vec![json_content(&payload)?]))
    }

    #[tool(description = "List the user's vocabulary entries (custom terms biased into Whisper's transcription, with phonetic aliases the model often hears instead).")]
    async fn list_vocabulary(
        &self,
        _params: rmcp::handler::server::wrapper::Parameters<NoInput>,
    ) -> Result<CallToolResult, McpError> {
        let state = self.state();
        let rows = state.db.list_vocabulary().map_err(map_err)?;
        let payload: Vec<VocabSummary> = rows.iter().map(VocabSummary::from).collect();
        Ok(CallToolResult::success(vec![json_content(&payload)?]))
    }

    #[tool(description = "Add a vocabulary entry. The canonical term plus optional aliases (phonetic variants Whisper sometimes hears). Writes through to the vault when one is configured. Returns the new entry.")]
    async fn add_vocabulary(
        &self,
        params: rmcp::handler::server::wrapper::Parameters<AddVocabularyInput>,
    ) -> Result<CallToolResult, McpError> {
        let input = params.0;
        let state = self.state();
        let entry = state
            .db
            .create_vocabulary_entry(&input.term, &input.aliases)
            .map_err(map_err)?;
        crate::vault_sync_vocabulary(&state);
        let _ = self.app.emit("vocabulary-changed", ());
        let payload = VocabSummary::from(&entry);
        Ok(CallToolResult::success(vec![json_content(&payload)?]))
    }
}

#[tool_handler]
impl ServerHandler for FluisterService {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            instructions: Some(
                "Fluister: local-first voice dictation for macOS. Tools expose the \
                 user's dictation history (search / recent / get), the cleanup pipeline \
                 (clean_text), and the vault (append_to_vault). All data stays on \
                 device — no cloud calls."
                    .into(),
            ),
            capabilities: ServerCapabilities::builder().enable_tools().build(),
            ..Default::default()
        }
    }
}

// ─── Server lifecycle ─────────────────────────────────────────────────────

/// Start the MCP HTTP server. Binds 127.0.0.1:{port} synchronously so the
/// caller knows immediately if the port is busy; the actual `axum::serve`
/// loop runs in a spawned task. Returns a handle whose `shutdown()` stops
/// the loop and drains.
pub async fn spawn(app: AppHandle, port: u16) -> Result<ServerHandle> {
    let listener = TcpListener::bind(("127.0.0.1", port))
        .await
        .with_context(|| format!("binding 127.0.0.1:{port} for MCP server"))?;

    let svc_app = app.clone();
    let service = StreamableHttpService::new(
        move || Ok(FluisterService::new(svc_app.clone())),
        Arc::new(LocalSessionManager::default()),
        StreamableHttpServerConfig::default(),
    );

    // Mount only at `/mcp`. Some clients (Claude Code) probe for OAuth
    // discovery at `/.well-known/oauth-authorization-server`; previously
    // those probes hit StreamableHttpService and bounced back with a 406
    // ("Accept must include application/json + text/event-stream"), which
    // the client's OAuth parser then failed to parse as JSON. Returning a
    // plain 404 for unrelated paths makes the client cleanly conclude
    // "no auth required" and move on.
    let router = axum::Router::new().nest_service("/mcp", service);

    let cancel = CancellationToken::new();
    let cancel_for_task = cancel.clone();

    let join = tokio::spawn(async move {
        let shutdown = async move {
            cancel_for_task.cancelled().await;
        };
        if let Err(e) = axum::serve(listener, router)
            .with_graceful_shutdown(shutdown)
            .await
        {
            log::error!("mcp: axum::serve exited with error: {e:?}");
        }
        log::info!("mcp: server stopped");
    });

    log::info!("mcp: listening on 127.0.0.1:{port}");
    Ok(ServerHandle { cancel, join })
}

// ─── Helpers ──────────────────────────────────────────────────────────────

fn map_err<E: std::fmt::Display>(e: E) -> McpError {
    McpError::internal_error(e.to_string(), None)
}

fn json_content<T: Serialize>(value: &T) -> Result<Content, McpError> {
    let s = serde_json::to_string(value).map_err(map_err)?;
    Ok(Content::text(s))
}

/// Same safety rules as `append_under_vault`. Returns the file contents as
/// a UTF-8 string. Fails loudly on non-UTF8 content; callers can fall back
/// to telling the user "this file isn't text" rather than corrupting bytes.
fn read_under_vault(root: &std::path::Path, relative: &str) -> Result<String> {
    let rel = std::path::Path::new(relative);
    if rel.is_absolute() {
        return Err(anyhow!("absolute paths are not allowed"));
    }
    if rel
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err(anyhow!("`..` is not allowed in vault paths"));
    }
    let abs = root.join(rel);
    std::fs::read_to_string(&abs)
        .with_context(|| format!("reading {}", abs.display()))
}

/// Resolve `relative` under `root` and append `content`. Refuses absolute
/// paths and any path that would escape the root via `..`. Returns the
/// absolute path written.
fn append_under_vault(root: &std::path::Path, relative: &str, content: &str) -> Result<PathBuf> {
    use std::io::Write;

    let rel = std::path::Path::new(relative);
    if rel.is_absolute() {
        return Err(anyhow!("absolute paths are not allowed"));
    }
    if rel
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err(anyhow!("`..` is not allowed in vault paths"));
    }

    let abs = root.join(rel);
    if let Some(parent) = abs.parent() {
        std::fs::create_dir_all(parent).context("creating parent dir for vault path")?;
    }

    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&abs)
        .with_context(|| format!("opening {} for append", abs.display()))?;
    file.write_all(content.as_bytes())
        .context("writing vault file")?;
    if !content.ends_with('\n') {
        file.write_all(b"\n").context("writing trailing newline")?;
    }
    Ok(abs)
}
