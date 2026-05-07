use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{
    tray::{MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent,
};
use tauri_plugin_clipboard_manager::ClipboardExt;

#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

mod audio;
mod db;
mod frontmost;
mod hotkey;
mod model_download;
mod ollama;
mod paste;
mod permissions;
mod transcribe;
mod vocabulary;

const SETTINGS_KEY: &str = "config";

// ─── Settings ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    #[serde(default = "default_ollama_model")]
    pub ollama_model: String,
    #[serde(default = "default_whisper_model_path")]
    pub whisper_model_path: String,
    #[serde(default = "default_cleanup_enabled")]
    pub cleanup_enabled: bool,
    #[serde(default)]
    pub vad_silence_ms: i64,
    #[serde(default = "default_overlay_position")]
    pub overlay_position: String,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default)]
    pub onboarding_complete: bool,
    /// ID of the active profile. None falls back to whichever profile is
    /// named "Default", or the built-in cleanup behaviour if even that is
    /// missing. The picker UI always resolves to a concrete profile.
    #[serde(default)]
    pub active_profile_id: Option<i64>,
}

fn default_ollama_model() -> String {
    std::env::var("FLUISTER_OLLAMA_MODEL").unwrap_or_else(|_| "llama3.2:latest".into())
}

fn default_whisper_model_path() -> String {
    std::env::var("FLUISTER_MODEL").unwrap_or_else(|_| {
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("fluister/models/ggml-base.en.bin")
            .to_string_lossy()
            .into_owned()
    })
}

fn default_cleanup_enabled() -> bool {
    true
}

fn default_overlay_position() -> String {
    "bottom-right".into()
}

fn default_theme() -> String {
    "system".into()
}

fn default_language() -> String {
    "en-US".into()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            ollama_model: default_ollama_model(),
            whisper_model_path: default_whisper_model_path(),
            cleanup_enabled: default_cleanup_enabled(),
            vad_silence_ms: 0,
            overlay_position: default_overlay_position(),
            theme: default_theme(),
            language: default_language(),
            onboarding_complete: false,
            active_profile_id: None,
        }
    }
}

fn load_settings(database: &db::Db) -> Settings {
    match database.get_setting(SETTINGS_KEY) {
        Ok(Some(json)) => serde_json::from_str(&json).unwrap_or_default(),
        _ => Settings::default(),
    }
}

fn save_settings(database: &db::Db, settings: &Settings) -> anyhow::Result<()> {
    let json = serde_json::to_string(settings)?;
    database.set_setting(SETTINGS_KEY, &json)
}

// ─── App state ───────────────────────────────────────────────────────────────

struct AppState {
    recorder: Arc<audio::Recorder>,
    is_recording: Arc<Mutex<bool>>,
    whisper: Arc<Mutex<Option<Arc<transcribe::Transcriber>>>>,
    settings: Arc<Mutex<Settings>>,
    db: db::Db,
    recording_started_at: Arc<Mutex<Option<Instant>>>,
    last_external_app: Arc<Mutex<Option<frontmost::TargetApp>>>,
}

#[derive(Clone, Serialize)]
struct StatusPayload {
    state: &'static str,
    message: Option<String>,
}

fn db_path() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("fluister/history.db")
}

/// One-time migration of the data directory from the old "local-whisper"
/// path to "fluister". Preserves existing dictations and downloaded Whisper
/// models for users upgrading.
fn migrate_data_dir() {
    let Some(local) = dirs::data_local_dir() else { return; };
    let old = local.join("local-whisper");
    let new = local.join("fluister");
    if old.exists() && !new.exists() {
        match std::fs::rename(&old, &new) {
            Ok(_) => log::info!("Migrated data dir local-whisper → fluister"),
            Err(e) => log::warn!("data dir migration failed: {e}"),
        }
    }
}

fn emit_status(app: &AppHandle, state: &'static str, message: Option<String>) {
    let _ = app.emit("status", StatusPayload { state, message });
}

fn show_overlay(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("overlay") {
        let _ = w.show();
    }
}

fn hide_overlay(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("overlay") {
        let _ = w.hide();
    }
}

fn show_history(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("history") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.unminimize();
    }
}

fn hide_history(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("history") {
        let _ = window.hide();
    }
}

fn hide_popover(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("popover") {
        let _ = window.hide();
    }
}

/// Anchors the popover under the tray icon and shows it. The icon's screen
/// rect comes from the tray-click event, converted to physical pixels.
fn show_popover_at_tray(app: &AppHandle, rect: tauri::Rect) {
    let Some(window) = app.get_webview_window("popover") else {
        return;
    };

    // The active monitor for clamping. current_monitor() returns the monitor
    // the window currently sits on; while it's hidden that may be stale, so
    // we fall back to the primary.
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());
    let scale = monitor.as_ref().map(|m| m.scale_factor()).unwrap_or(1.0);

    let icon_pos = rect.position.to_physical::<f64>(scale);
    let icon_size = rect.size.to_physical::<f64>(scale);
    let win_size = window
        .outer_size()
        .map(|s| (s.width as f64, s.height as f64))
        .unwrap_or((320.0 * scale, 420.0 * scale));

    let mut x = icon_pos.x + icon_size.width / 2.0 - win_size.0 / 2.0;
    let y = icon_pos.y + icon_size.height + 4.0 * scale;

    if let Some(monitor) = monitor.as_ref() {
        let mon_pos = monitor.position();
        let mon_size = monitor.size();
        let min_x = mon_pos.x as f64 + 8.0 * scale;
        let max_x = (mon_pos.x as f64 + mon_size.width as f64) - win_size.0 - 8.0 * scale;
        if max_x > min_x {
            x = x.clamp(min_x, max_x);
        }
    }

    let _ = window.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
    let _ = window.show();
    let _ = window.set_focus();
}

fn position_overlay(app: &AppHandle) {
    let Some(window) = app.get_webview_window("overlay") else {
        return;
    };
    let monitor = match window.primary_monitor() {
        Ok(Some(m)) => m,
        _ => return,
    };
    let monitor_size = monitor.size();
    let win_size = match window.outer_size() {
        Ok(s) => s,
        Err(_) => return,
    };
    let margin = (40.0 * monitor.scale_factor()) as i32;
    let preference = app
        .state::<AppState>()
        .settings
        .lock()
        .overlay_position
        .clone();

    let mw = monitor_size.width as i32;
    let mh = monitor_size.height as i32;
    let ww = win_size.width as i32;
    let wh = win_size.height as i32;
    let center_x = (mw - ww) / 2;
    let top_y = margin;
    let bottom_y = mh - wh - margin;
    let left_x = margin;
    let right_x = mw - ww - margin;

    let (x, y) = match preference.as_str() {
        "top-left" => (left_x, top_y),
        "top-center" => (center_x, top_y),
        "top-right" => (right_x, top_y),
        "bottom-left" => (left_x, bottom_y),
        "bottom-center" => (center_x, bottom_y),
        // "bottom-right" or any unknown value
        _ => (right_x, bottom_y),
    };
    let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
}

/// Briefly shows the overlay at its new position so the user can confirm
/// where it'll land. Skips the preview if a recording is in progress.
async fn preview_overlay(app: AppHandle) {
    {
        let state = app.state::<AppState>();
        if *state.is_recording.lock() {
            return;
        }
    }
    position_overlay(&app);
    if let Some(window) = app.get_webview_window("overlay") {
        let _ = window.show();
        tokio::time::sleep(Duration::from_millis(900)).await;
        let state = app.state::<AppState>();
        if !*state.is_recording.lock() {
            let _ = window.hide();
        }
    }
}

/// Captures the currently-frontmost app, but only if it isn't us.
fn capture_target_app(state: &AppState) {
    if let Some(app) = frontmost::current() {
        if !frontmost::is_self(&app) {
            *state.last_external_app.lock() = Some(app);
        }
    }
}

// ─── Hotkey handlers ─────────────────────────────────────────────────────────

fn handle_press(app: AppHandle) {
    let recorder;
    let is_recording_flag;
    let vad_silence_ms;
    {
        let state = app.state::<AppState>();
        let mut flag = state.is_recording.lock();
        if *flag {
            return;
        }
        *flag = true;
        recorder = Arc::clone(&state.recorder);
        is_recording_flag = Arc::clone(&state.is_recording);
        *state.recording_started_at.lock() = Some(Instant::now());
        capture_target_app(&state);
        vad_silence_ms = state.settings.lock().vad_silence_ms;
    }

    if let Err(e) = recorder.start() {
        *is_recording_flag.lock() = false;
        log::error!("recorder start failed: {e}");
        emit_status(&app, "error", Some(format!("mic: {e}")));
        return;
    }

    position_overlay(&app);
    show_overlay(&app);
    emit_status(&app, "recording", None);

    spawn_level_task(app, recorder, is_recording_flag, vad_silence_ms);
}

fn spawn_level_task(
    app: AppHandle,
    recorder: Arc<audio::Recorder>,
    is_recording_flag: Arc<Mutex<bool>>,
    vad_silence_ms: i64,
) {
    const TICK_MS: u64 = 40;
    const VAD_THRESHOLD: f32 = 0.015;
    const VAD_GRACE_MS: u64 = 800;

    let vad_silence_ticks = if vad_silence_ms > 0 {
        Some((vad_silence_ms / TICK_MS as i64).max(1))
    } else {
        None
    };
    let grace_ticks = (VAD_GRACE_MS / TICK_MS) as i64;

    tauri::async_runtime::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_millis(TICK_MS));
        let mut elapsed_ticks: i64 = 0;
        let mut silent_ticks: i64 = 0;
        loop {
            tick.tick().await;
            if !*is_recording_flag.lock() {
                break;
            }
            elapsed_ticks += 1;
            let level = recorder.level();
            let _ = app.emit("level", level);

            if let Some(limit) = vad_silence_ticks {
                if elapsed_ticks > grace_ticks {
                    if level < VAD_THRESHOLD {
                        silent_ticks += 1;
                        if silent_ticks >= limit {
                            // VAD fired — auto-stop. handle_release will run
                            // the rest of the pipeline and reset the flag.
                            handle_release(app.clone());
                            break;
                        }
                    } else {
                        silent_ticks = 0;
                    }
                }
            }
        }
        let _ = app.emit("level", 0.0_f32);
    });
}

fn handle_release(app: AppHandle) {
    let recorder;
    let whisper_slot;
    let settings;
    let database;
    let was_recording;
    let started_at;
    {
        let state = app.state::<AppState>();
        let mut flag = state.is_recording.lock();
        was_recording = *flag;
        *flag = false;
        recorder = Arc::clone(&state.recorder);
        whisper_slot = Arc::clone(&state.whisper);
        settings = state.settings.lock().clone();
        database = state.db.clone();
        started_at = state.recording_started_at.lock().take();
    }

    if !was_recording {
        return;
    }

    let duration_ms = started_at
        .map(|t| t.elapsed().as_millis() as i64)
        .unwrap_or(0);

    emit_status(&app, "transcribing", None);
    let samples = match recorder.stop() {
        Ok(s) => s,
        Err(e) => {
            log::error!("recorder stop failed: {e}");
            emit_status(&app, "error", Some(format!("stop: {e}")));
            tauri::async_runtime::spawn(hide_after_delay(app.clone(), 1500));
            return;
        }
    };

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let result = run_pipeline(
            &app_handle,
            samples,
            whisper_slot,
            settings,
            database,
            duration_ms,
        )
        .await;
        match result {
            Ok(_) => emit_status(&app_handle, "idle", None),
            Err(e) => {
                log::error!("pipeline failed: {e}");
                emit_status(&app_handle, "error", Some(e.to_string()));
            }
        }
        hide_after_delay(app_handle.clone(), 800).await;
    });
}

async fn hide_after_delay(app: AppHandle, ms: u64) {
    tokio::time::sleep(Duration::from_millis(ms)).await;
    hide_overlay(&app);
}

async fn run_pipeline(
    app: &AppHandle,
    samples: Vec<f32>,
    whisper_slot: Arc<Mutex<Option<Arc<transcribe::Transcriber>>>>,
    settings: Settings,
    database: db::Db,
    duration_ms: i64,
) -> anyhow::Result<()> {
    if samples.len() < 16_000 / 4 {
        return Ok(());
    }

    let peak = samples.iter().fold(0f32, |m, s| m.max(s.abs()));
    if peak < 0.012 {
        return Ok(());
    }

    let model_path = std::path::Path::new(&settings.whisper_model_path).to_path_buf();
    let transcriber = ensure_whisper(&whisper_slot, &model_path)?;

    // Resolve the active profile (falls back to the seeded "Default" profile
    // or to an empty no-op profile if even that's gone).
    let active_profile = resolve_active_profile(&database, &settings);

    // Pull the global vocabulary terms once — they stack into Whisper's
    // initial_prompt AND drive post-cleanup alias replacement.
    let vocab_entries = database.list_vocabulary().unwrap_or_default();
    let global_terms: Vec<&str> = vocab_entries.iter().map(|e| e.term.as_str()).collect();

    // Build initial_prompt: locale hint (British spelling, etc.) + active
    // profile vocabulary + global canonical terms.
    let mut prompt_parts: Vec<String> = Vec::new();
    let locale = ollama::locale_hint(&settings.language);
    if !locale.is_empty() {
        prompt_parts.push(locale.to_string());
    }
    if let Some(p) = &active_profile {
        if !p.vocabulary.trim().is_empty() {
            prompt_parts.push(p.vocabulary.clone());
        }
    }
    if !global_terms.is_empty() {
        prompt_parts.push(global_terms.join(", "));
    }
    let prompt = prompt_parts.join(" ");

    let whisper_iso = ollama::whisper_iso(&settings.language).map(str::to_string);

    let raw = tokio::task::spawn_blocking(move || {
        transcriber.transcribe(&samples, &prompt, whisper_iso.as_deref())
    })
    .await
    .map_err(|e| anyhow::anyhow!("transcribe task: {e}"))??;

    if is_silence_artifact(&raw) {
        return Ok(());
    }

    let style_prompt = active_profile
        .as_ref()
        .map(|p| p.style_prompt.as_str())
        .unwrap_or("");

    let cleaned_pre = if settings.cleanup_enabled {
        emit_status(app, "cleaning", None);
        match ollama::cleanup(
            &raw,
            &settings.ollama_model,
            &settings.language,
            style_prompt,
        )
        .await
        {
            Ok(text) if !text.is_empty() => text,
            Ok(_) => raw.clone(),
            Err(e) => {
                log::warn!("ollama cleanup failed, using raw transcript: {e}");
                raw.clone()
            }
        }
    } else {
        raw.clone()
    };

    // Final pass: replace user-defined aliases with their canonical terms
    // (e.g. "type script" → "TypeScript").
    let cleaned = vocabulary::apply_replacements(&cleaned_pre, &vocab_entries);

    emit_status(app, "pasting", None);
    paste::paste_text(app, &cleaned).await?;

    match database.insert(&raw, &cleaned, duration_ms) {
        Ok(_) => {
            let _ = app.emit("history-changed", ());
        }
        Err(e) => log::warn!("history save failed: {e}"),
    }

    Ok(())
}

fn is_silence_artifact(text: &str) -> bool {
    let t = text.trim();
    if t.is_empty() {
        return true;
    }
    if t.starts_with('[') || t.starts_with('(') {
        return true;
    }
    let normalized: String = t
        .chars()
        .filter(|c| c.is_ascii_alphabetic() || c.is_ascii_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase();

    matches!(
        normalized.as_str(),
        ""
            | "you"
            | "thank you"
            | "thanks"
            | "thanks for watching"
            | "thanks for watching the video"
            | "thank you for watching"
            | "bye"
            | "okay"
            | "ok"
            | "hmm"
            | "uh"
            | "um"
    )
}

fn ensure_whisper(
    slot: &Arc<Mutex<Option<Arc<transcribe::Transcriber>>>>,
    model_path: &std::path::Path,
) -> anyhow::Result<Arc<transcribe::Transcriber>> {
    let mut guard = slot.lock();
    if let Some(existing) = guard.as_ref() {
        return Ok(Arc::clone(existing));
    }
    let t = Arc::new(transcribe::Transcriber::new(model_path)?);
    *guard = Some(Arc::clone(&t));
    Ok(t)
}

/// Resolve the currently-active profile. Tries the explicit
/// `active_profile_id` first, then falls back to the seeded "Default"
/// profile, then `None` if even that's been deleted.
fn resolve_active_profile(database: &db::Db, settings: &Settings) -> Option<db::Profile> {
    if let Some(id) = settings.active_profile_id {
        if let Ok(Some(p)) = database.get_profile(id) {
            return Some(p);
        }
    }
    database
        .list_profiles()
        .ok()
        .and_then(|profs| {
            profs
                .into_iter()
                .find(|p| p.name.eq_ignore_ascii_case("Default"))
        })
}

// ─── Tauri commands ──────────────────────────────────────────────────────────

#[tauri::command]
fn list_dictations(
    state: State<'_, AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
    favorites_only: Option<bool>,
    search: Option<String>,
) -> Result<Vec<db::Dictation>, String> {
    state
        .db
        .list(
            limit.unwrap_or(200),
            offset.unwrap_or(0),
            favorites_only.unwrap_or(false),
            search,
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_favorite(state: State<'_, AppState>, id: i64) -> Result<bool, String> {
    state.db.toggle_favorite(id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_dictation(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.db.delete(id).map_err(|e| e.to_string())
}

#[tauri::command]
fn copy_dictation(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    let dict = state
        .db
        .get(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "dictation not found".to_string())?;
    app.clipboard()
        .write_text(dict.cleaned_text)
        .map_err(|e| e.to_string())
}

// ─── Popover navigation commands ─────────────────────────────────────────────

#[tauri::command]
fn open_history(app: AppHandle) {
    hide_popover(&app);
    show_history(&app);
}

#[tauri::command]
fn open_settings_from_popover(app: AppHandle) {
    hide_popover(&app);
    show_history(&app);
    // The history window listens for this and switches to its settings panel.
    let _ = app.emit("show-settings", ());
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn close_popover(app: AppHandle) {
    hide_popover(&app);
}

#[tauri::command]
fn app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Stub for the "Check for updates" entry in the popover. Wires up later to
/// a real update endpoint (Tauri's updater plugin or a custom JSON manifest).
#[tauri::command]
async fn check_for_updates() -> Result<UpdateStatus, String> {
    // Simulate a quick network round-trip so the UI gets to show the
    // "checking" state. Replace with a real call when ready.
    tokio::time::sleep(Duration::from_millis(700)).await;
    Ok(UpdateStatus {
        up_to_date: true,
        latest_version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[derive(Clone, Serialize)]
struct UpdateStatus {
    up_to_date: bool,
    latest_version: String,
}

// ─── Model management ────────────────────────────────────────────────────────

#[tauri::command]
fn list_whisper_models(state: State<'_, AppState>) -> Vec<model_download::ModelInfo> {
    let active = state.settings.lock().whisper_model_path.clone();
    model_download::list(&active)
}

#[tauri::command]
async fn download_whisper_model(app: AppHandle, filename: String) -> Result<(), String> {
    match model_download::download(app.clone(), filename.clone()).await {
        Ok(_) => Ok(()),
        Err(e) => {
            let _ = app.emit(
                "model-download-failed",
                model_download::DownloadFailed {
                    filename,
                    error: e.to_string(),
                },
            );
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn list_ollama_models() -> Result<Vec<ollama::OllamaModel>, String> {
    ollama::list_models().await.map_err(|e| e.to_string())
}

// ─── Onboarding ──────────────────────────────────────────────────────────────

#[derive(Clone, Serialize)]
struct OnboardingStatus {
    microphone: permissions::MicStatus,
    accessibility: bool,
    has_whisper_model: bool,
    ollama_running: bool,
    ollama_has_models: bool,
    onboarding_complete: bool,
}

#[tauri::command]
async fn onboarding_status(state: State<'_, AppState>) -> Result<OnboardingStatus, String> {
    let microphone = permissions::microphone_status();
    let accessibility = permissions::accessibility_granted();
    let onboarding_complete = state.settings.lock().onboarding_complete;
    let active_path = state.settings.lock().whisper_model_path.clone();
    let has_whisper_model = std::path::Path::new(&active_path).exists()
        || model_download::list(&active_path).iter().any(|m| m.installed);

    let (ollama_running, ollama_has_models) = match ollama::list_models().await {
        Ok(models) => (true, !models.is_empty()),
        Err(_) => (false, false),
    };

    Ok(OnboardingStatus {
        microphone,
        accessibility,
        has_whisper_model,
        ollama_running,
        ollama_has_models,
        onboarding_complete,
    })
}

#[tauri::command]
async fn request_microphone_access() -> Result<permissions::MicStatus, String> {
    tokio::task::spawn_blocking(|| {
        permissions::request_microphone();
        permissions::microphone_status()
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_privacy_panel(panel: String) -> Result<(), String> {
    permissions::open_privacy_panel(&panel).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(url)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn finish_onboarding(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    {
        let mut current = state.settings.lock();
        current.onboarding_complete = true;
        save_settings(&state.db, &current).map_err(|e| e.to_string())?;
    }
    if let Some(window) = app.get_webview_window("onboarding") {
        let _ = window.hide();
    }
    Ok(())
}

fn show_onboarding(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("onboarding") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.center();
    }
}

#[tauri::command]
fn show_onboarding_window(app: AppHandle) {
    show_onboarding(&app);
}

#[tauri::command]
fn set_active_whisper_model(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<(), String> {
    {
        let mut current = state.settings.lock();
        current.whisper_model_path = path;
        save_settings(&state.db, &current).map_err(|e| e.to_string())?;
    }
    // Drop the cached transcriber so the next dictation reloads from the
    // new model file.
    *state.whisper.lock() = None;
    let _ = app.emit("models-changed", ());
    Ok(())
}

#[tauri::command]
async fn paste_dictation(
    app: AppHandle,
    id: i64,
) -> Result<(), String> {
    // Pull what we need out of state up-front so we don't hold the State guard
    // across the await points (which the Tauri handler infrastructure forbids).
    let (text, target) = {
        let state = app.state::<AppState>();
        let dict = state
            .db
            .get(id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "dictation not found".to_string())?;
        let target = state.last_external_app.lock().clone();
        (dict.cleaned_text, target)
    };

    // 1. Stage the text on the pasteboard.
    app.clipboard()
        .write_text(text)
        .map_err(|e| e.to_string())?;

    // 2. Hide the history window so focus can return to the previous app.
    hide_history(&app);

    // 3. Force-activate the previously-frontmost app, if we know it.
    //    Without this, focus would land on whoever macOS picks next, which
    //    may not be where the user actually wants the paste to go.
    if let Some(t) = &target {
        frontmost::activate(t.pid);
    }

    // 4. Wait for the activation/focus change to settle, then send ⌘V.
    tokio::time::sleep(Duration::from_millis(140)).await;
    paste::synthesize_keystroke(&app)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Settings {
    state.settings.lock().clone()
}

#[tauri::command]
fn update_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: Settings,
) -> Result<(), String> {
    save_settings(&state.db, &settings).map_err(|e| e.to_string())?;
    let position_changed;
    {
        let mut current = state.settings.lock();
        // If the whisper model path changed, drop the cached transcriber so
        // the next dictation reloads from the new path.
        if current.whisper_model_path != settings.whisper_model_path {
            *state.whisper.lock() = None;
        }
        position_changed = current.overlay_position != settings.overlay_position;
        *current = settings;
    }
    if position_changed {
        let preview_app = app.clone();
        tauri::async_runtime::spawn(async move { preview_overlay(preview_app).await });
    }
    Ok(())
}

// ─── Profiles ───────────────────────────────────────────────────────────────

#[tauri::command]
fn list_profiles(state: State<'_, AppState>) -> Result<Vec<db::Profile>, String> {
    state.db.list_profiles().map_err(|e| e.to_string())
}

#[tauri::command]
fn create_profile(
    app: AppHandle,
    state: State<'_, AppState>,
    name: String,
    description: String,
    style_prompt: String,
    vocabulary: String,
) -> Result<db::Profile, String> {
    let p = state
        .db
        .create_profile(&name, &description, &style_prompt, &vocabulary)
        .map_err(|e| e.to_string())?;
    let _ = app.emit("profiles-changed", ());
    Ok(p)
}

#[tauri::command]
fn update_profile(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
    name: String,
    description: String,
    style_prompt: String,
    vocabulary: String,
) -> Result<(), String> {
    state
        .db
        .update_profile(id, &name, &description, &style_prompt, &vocabulary)
        .map_err(|e| e.to_string())?;
    let _ = app.emit("profiles-changed", ());
    Ok(())
}

#[tauri::command]
fn delete_profile(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    state.db.delete_profile(id).map_err(|e| e.to_string())?;

    // If the active profile was the one we just deleted, clear it so the
    // resolver falls back to "Default".
    let mut current = state.settings.lock();
    if current.active_profile_id == Some(id) {
        current.active_profile_id = None;
        let _ = save_settings(&state.db, &current);
    }
    drop(current);

    let _ = app.emit("profiles-changed", ());
    Ok(())
}

#[tauri::command]
fn set_active_profile(
    app: AppHandle,
    state: State<'_, AppState>,
    id: Option<i64>,
) -> Result<(), String> {
    {
        let mut current = state.settings.lock();
        current.active_profile_id = id;
        save_settings(&state.db, &current).map_err(|e| e.to_string())?;
    }
    let _ = app.emit("profiles-changed", ());
    Ok(())
}

// ─── Vocabulary ─────────────────────────────────────────────────────────────

#[tauri::command]
fn list_vocabulary(state: State<'_, AppState>) -> Result<Vec<db::VocabularyEntry>, String> {
    state.db.list_vocabulary().map_err(|e| e.to_string())
}

#[tauri::command]
fn create_vocabulary_entry(
    app: AppHandle,
    state: State<'_, AppState>,
    term: String,
    aliases: Vec<String>,
) -> Result<db::VocabularyEntry, String> {
    let entry = state
        .db
        .create_vocabulary_entry(&term, &aliases)
        .map_err(|e| e.to_string())?;
    let _ = app.emit("vocabulary-changed", ());
    Ok(entry)
}

#[tauri::command]
fn update_vocabulary_entry(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
    term: String,
    aliases: Vec<String>,
) -> Result<(), String> {
    state
        .db
        .update_vocabulary_entry(id, &term, &aliases)
        .map_err(|e| e.to_string())?;
    let _ = app.emit("vocabulary-changed", ());
    Ok(())
}

#[tauri::command]
fn delete_vocabulary_entry(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    state
        .db
        .delete_vocabulary_entry(id)
        .map_err(|e| e.to_string())?;
    let _ = app.emit("vocabulary-changed", ());
    Ok(())
}

// ─── Tray icon ───────────────────────────────────────────────────────────────

fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    // Custom monochrome tray glyph — a 5-bar waveform that matches the
    // dictation overlay. Loaded as a "template image" so macOS auto-tints
    // it for light/dark menu bars and the menu-bar selected state.
    let tray_icon_bytes = include_bytes!("../icons/tray-icon.png");
    let icon = tauri::image::Image::from_bytes(tray_icon_bytes)?;

    // No system menu — both left- and right-clicks open the same popover,
    // matching Granola / Spotify / Linear menubar behaviour. The popover
    // itself contains "Open History", "Settings" and "Quit".
    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .icon_as_template(true)
        .on_tray_icon_event(|tray, event| {
            let TrayIconEvent::Click {
                button_state: MouseButtonState::Up,
                rect,
                ..
            } = event
            else {
                return;
            };

            let app = tray.app_handle();
            if let Some(s) = app.try_state::<AppState>() {
                capture_target_app(&s);
            }
            if let Some(window) = app.get_webview_window("popover") {
                let visible = window.is_visible().unwrap_or(false);
                if visible {
                    let _ = window.hide();
                } else {
                    show_popover_at_tray(app, rect);
                }
            }
        })
        .build(app)?;

    Ok(())
}

// ─── Entry point ────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = env_logger::try_init();

    // Migrate user data (history db, downloaded models) from the old
    // local-whisper directory before opening anything.
    migrate_data_dir();

    let database = db::Db::open(&db_path()).expect("opening history database");
    let settings = load_settings(&database);
    let needs_onboarding = !settings.onboarding_complete;

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState {
            recorder: Arc::new(audio::Recorder::new()),
            is_recording: Arc::new(Mutex::new(false)),
            whisper: Arc::new(Mutex::new(None)),
            settings: Arc::new(Mutex::new(settings)),
            db: database,
            recording_started_at: Arc::new(Mutex::new(None)),
            last_external_app: Arc::new(Mutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![
            list_dictations,
            toggle_favorite,
            delete_dictation,
            copy_dictation,
            paste_dictation,
            get_settings,
            update_settings,
            open_history,
            open_settings_from_popover,
            quit_app,
            close_popover,
            list_whisper_models,
            download_whisper_model,
            set_active_whisper_model,
            list_ollama_models,
            app_version,
            check_for_updates,
            onboarding_status,
            request_microphone_access,
            open_privacy_panel,
            open_external_url,
            finish_onboarding,
            show_onboarding_window,
            list_profiles,
            create_profile,
            update_profile,
            delete_profile,
            set_active_profile,
            list_vocabulary,
            create_vocabulary_entry,
            update_vocabulary_entry,
            delete_vocabulary_entry,
        ])
        .on_window_event(|window, event| match window.label() {
            "history" | "onboarding" => {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
            "popover" => {
                // Click outside → lose focus → hide. Same UX as a real menu.
                if let WindowEvent::Focused(false) = event {
                    let _ = window.hide();
                }
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
            _ => {}
        })
        .setup(move |app| {
            position_overlay(&app.handle().clone());

            let press_app = app.handle().clone();
            let release_app = app.handle().clone();
            hotkey::spawn_right_option_listener(
                move || handle_press(press_app.clone()),
                move || handle_release(release_app.clone()),
            );

            setup_tray(app)?;

            // Apply native NSVisualEffectView frosted-glass to the popover.
            // CSS backdrop-filter sampled the desktop too literally and leaked
            // color from saturated wallpapers; HudWindow gives the proper
            // macOS-native dropdown appearance instead.
            #[cfg(target_os = "macos")]
            if let Some(popover) = app.get_webview_window("popover") {
                if let Err(err) = apply_vibrancy(
                    &popover,
                    NSVisualEffectMaterial::HudWindow,
                    None,
                    Some(12.0),
                ) {
                    log::warn!("apply_vibrancy(popover) failed: {err:?}");
                }
            }

            // First-launch (or any launch where onboarding was skipped):
            // open the welcome window so the user can grant permissions
            // and pick a model before trying the hotkey.
            if needs_onboarding {
                show_onboarding(&app.handle().clone());
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
