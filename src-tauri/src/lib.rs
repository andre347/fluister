use std::path::{Path, PathBuf};
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
mod vault;
mod vault_watcher;
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
    /// Filesystem path to the user's Fluister vault. None = SQLite-only
    /// (legacy mode). When set, profile + vocabulary mutations write
    /// through to vault files and the cache reconciles to the vault on
    /// startup.
    #[serde(default)]
    pub vault_path: Option<PathBuf>,
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
            vault_path: None,
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
    /// Live vault watcher, present iff `Settings.vault_path` is set.
    /// Dropped to stop watching when the user disables the vault.
    vault_watcher: Arc<Mutex<Option<vault_watcher::VaultWatcher>>>,
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

// ─── Vault helpers ──────────────────────────────────────────────────────────

/// Pull the configured vault path out of state, returning None if the
/// user hasn't set up a vault yet (legacy SQLite-only mode).
fn vault_root(state: &AppState) -> Option<PathBuf> {
    state.settings.lock().vault_path.clone()
}

/// Write a single profile to the vault, computing the slugified filename.
/// Logs and continues on failure — vault writes are best-effort; SQLite
/// remains the runtime source of truth.
fn vault_write_profile(root: &Path, p: &db::Profile) -> anyhow::Result<()> {
    let ulid = ulid::Ulid::from_string(&p.ulid)
        .map_err(|e| anyhow::anyhow!("profile {} has invalid ulid: {e}", p.id))?;
    let created = chrono::DateTime::<chrono::Utc>::from_timestamp_millis(p.created_at)
        .unwrap_or_else(chrono::Utc::now);
    vault::ensure_layout(root)?;
    vault::write_profile(
        root,
        &vault::VaultProfile {
            ulid,
            name: p.name.clone(),
            description: p.description.clone(),
            style_prompt: p.style_prompt.clone(),
            vocabulary: p.vocabulary.clone(),
            created_at: created,
        },
    )?;
    Ok(())
}

/// Rewrite the global vocabulary file from the SQLite list. Vocabulary
/// is a single Markdown table, so partial writes don't make sense — the
/// whole file is rewritten on every change.
fn vault_rewrite_vocabulary(root: &Path, entries: &[db::VocabularyEntry]) -> anyhow::Result<()> {
    let mut vault_entries = Vec::with_capacity(entries.len());
    for e in entries {
        let ulid = ulid::Ulid::from_string(&e.ulid)
            .map_err(|err| anyhow::anyhow!("vocab {} has invalid ulid: {err}", e.id))?;
        let created = chrono::DateTime::<chrono::Utc>::from_timestamp_millis(e.created_at)
            .unwrap_or_else(chrono::Utc::now);
        vault_entries.push(vault::VaultVocab {
            ulid,
            term: e.term.clone(),
            aliases: e.aliases.clone(),
            created_at: created,
        });
    }
    vault::ensure_layout(root)?;
    vault::write_vocabulary(root, &vault_entries)?;
    Ok(())
}

/// Update `.fluister-meta.yml` with the active profile's ULID. Resolves
/// the ULID from SQLite via the i64 id stored in Settings.
fn vault_write_meta(state: &AppState, root: &Path) -> anyhow::Result<()> {
    let active_ulid = match state.settings.lock().active_profile_id {
        Some(id) => state
            .db
            .list_profiles()?
            .into_iter()
            .find(|p| p.id == id)
            .map(|p| p.ulid),
        None => None,
    };
    let mut meta = vault::read_meta(root).unwrap_or_default();
    meta.active_profile_ulid = active_ulid;
    if meta.version == 0 {
        meta.version = 1;
    }
    vault::write_meta(root, &meta)?;
    Ok(())
}

/// Reconcile the SQLite cache against the vault.
///
/// `delete_orphans = false` ("merge both ways") — used at startup. Vault
/// wins on shared rows; SQLite-only rows are written to the vault;
/// vault-only rows are inserted into SQLite. Never deletes — that's safer
/// when the user has opted into a vault but the vault could be empty.
///
/// `delete_orphans = true` ("vault is canonical") — used by the file
/// watcher. SQLite rows whose ULID is missing from the vault are deleted.
/// This is the right semantic when the user's intent is observable (they
/// just deleted a file in Finder while the app was running).
fn reconcile_vault_into_db(
    database: &db::Db,
    root: &Path,
    delete_orphans: bool,
) -> anyhow::Result<()> {
    vault::ensure_layout(root)?;

    // ── Profiles ──
    let vault_profiles = vault::list_profiles(root)?;
    let mut sqlite_profiles = database.list_profiles()?;

    for (_, vp) in &vault_profiles {
        let ulid_str = vp.ulid.to_string();
        match database.find_profile_by_ulid(&ulid_str)? {
            Some(_) => {
                database.update_profile_by_ulid(
                    &ulid_str,
                    &vp.name,
                    &vp.description,
                    &vp.style_prompt,
                    &vp.vocabulary,
                )?;
            }
            None => {
                let created = vp.created_at.timestamp_millis();
                database.create_profile_with_ulid(
                    &ulid_str,
                    &vp.name,
                    &vp.description,
                    &vp.style_prompt,
                    &vp.vocabulary,
                    created,
                )?;
            }
        }
    }

    sqlite_profiles.sort_by_key(|p| p.id);
    let vault_ulids: std::collections::HashSet<String> = vault_profiles
        .iter()
        .map(|(_, p)| p.ulid.to_string())
        .collect();

    if delete_orphans {
        // SQLite-only rows → delete (user removed the file).
        for p in &sqlite_profiles {
            if !p.ulid.is_empty() && !vault_ulids.contains(&p.ulid) {
                if let Err(e) = database.delete_profile_by_ulid(&p.ulid) {
                    log::warn!("watcher: delete profile {} failed: {e}", p.name);
                }
            }
        }
    } else {
        // SQLite-only rows → write to vault (initial population).
        for p in &sqlite_profiles {
            if !p.ulid.is_empty() && !vault_ulids.contains(&p.ulid) {
                if let Err(e) = vault_write_profile(root, p) {
                    log::warn!("vault write missed profile {}: {e}", p.name);
                }
            }
        }
    }

    // ── Vocabulary ──
    let vault_vocab = vault::read_vocabulary(root)?;
    let vault_vocab_ulids: std::collections::HashSet<String> =
        vault_vocab.iter().map(|v| v.ulid.to_string()).collect();
    for vv in &vault_vocab {
        let ulid_str = vv.ulid.to_string();
        match database.find_vocab_by_ulid(&ulid_str)? {
            Some(_) => database.update_vocab_by_ulid(&ulid_str, &vv.term, &vv.aliases)?,
            None => {
                let created = vv.created_at.timestamp_millis();
                database.create_vocabulary_entry_with_ulid(
                    &ulid_str,
                    &vv.term,
                    &vv.aliases,
                    created,
                )?;
            }
        };
    }

    if delete_orphans {
        let sqlite_vocab = database.list_vocabulary()?;
        for v in &sqlite_vocab {
            if !v.ulid.is_empty() && !vault_vocab_ulids.contains(&v.ulid) {
                if let Err(e) = database.delete_vocab_by_ulid(&v.ulid) {
                    log::warn!("watcher: delete vocab {} failed: {e}", v.term);
                }
            }
        }
    } else {
        // Rewrite the whole file so SQLite-only rows get persisted with
        // consistent ordering.
        let all_vocab = database.list_vocabulary()?;
        if !all_vocab.is_empty() || !vault_vocab.is_empty() {
            if let Err(e) = vault_rewrite_vocabulary(root, &all_vocab) {
                log::warn!("vault rewrite vocabulary failed: {e}");
            }
        }
    }

    Ok(())
}

/// Read `.fluister-meta.yml` and reflect `active_profile_ulid` into the
/// in-memory Settings struct + saved row. No-op if meta is missing or the
/// referenced ULID isn't in SQLite.
fn sync_meta_into_settings(state: &AppState, root: &Path) -> anyhow::Result<()> {
    let meta = vault::read_meta(root)?;
    let Some(ulid) = meta.active_profile_ulid else {
        return Ok(());
    };
    let resolved = match state.db.find_profile_by_ulid(&ulid)? {
        Some(p) => Some(p.id),
        None => None,
    };
    let mut settings = state.settings.lock();
    if settings.active_profile_id != resolved {
        settings.active_profile_id = resolved;
        save_settings(&state.db, &settings)?;
    }
    Ok(())
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

    let profile_id = active_profile.as_ref().map(|p| p.id);
    match database.insert(&raw, &cleaned, duration_ms, profile_id) {
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

// ─── Vault setup ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct VaultStatus {
    pub path: Option<String>,
    pub exists: bool,
    pub profile_count: usize,
    pub vocab_count: usize,
}

/// Snapshot of the current vault setup for the Storage settings card.
#[tauri::command]
fn vault_status(state: State<'_, AppState>) -> Result<VaultStatus, String> {
    let path = state.settings.lock().vault_path.clone();
    let Some(root) = path.as_ref() else {
        return Ok(VaultStatus {
            path: None,
            exists: false,
            profile_count: 0,
            vocab_count: 0,
        });
    };
    let exists = root.exists();
    let (profile_count, vocab_count) = if exists {
        let p = vault::list_profiles(root).map(|v| v.len()).unwrap_or(0);
        let v = vault::read_vocabulary(root).map(|v| v.len()).unwrap_or(0);
        (p, v)
    } else {
        (0, 0)
    };
    Ok(VaultStatus {
        path: Some(root.to_string_lossy().into_owned()),
        exists,
        profile_count,
        vocab_count,
    })
}

/// Promote a folder to be the user's Fluister vault. Creates the layout
/// if missing, then runs the merge-both-ways reconcile so any existing
/// SQLite data lands in the vault and any pre-existing vault content is
/// pulled into the cache.
#[tauri::command]
fn set_vault_path(
    app: AppHandle,
    state: State<'_, AppState>,
    path: PathBuf,
) -> Result<VaultStatus, String> {
    if path.is_file() {
        return Err("That path is a file, not a folder".into());
    }
    std::fs::create_dir_all(&path)
        .map_err(|e| format!("creating vault dir: {e}"))?;
    vault::ensure_layout(&path).map_err(|e| e.to_string())?;
    reconcile_vault_into_db(&state.db, &path, false).map_err(|e| e.to_string())?;

    {
        let mut settings = state.settings.lock();
        settings.vault_path = Some(path.clone());
        save_settings(&state.db, &settings).map_err(|e| e.to_string())?;
    }
    if let Err(e) = vault_write_meta(&state, &path) {
        log::warn!("vault meta refresh failed: {e}");
    }

    // Start (or restart) the file watcher for the new path. Drop the old
    // one first so notify releases the FSEvents handle on the old dir.
    {
        let mut slot = state.vault_watcher.lock();
        *slot = None;
        match vault_watcher::start(app.clone(), path.clone()) {
            Ok(w) => *slot = Some(w),
            Err(e) => log::warn!("vault watcher failed to start: {e}"),
        }
    }

    let _ = app.emit("vault-changed", ());
    let _ = app.emit("profiles-changed", ());
    let _ = app.emit("vocabulary-changed", ());
    vault_status(state)
}

/// Drop back to SQLite-only mode. The vault files are NOT deleted — the
/// user can re-enable later or move/delete the folder manually.
#[tauri::command]
fn clear_vault_path(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<VaultStatus, String> {
    {
        let mut settings = state.settings.lock();
        settings.vault_path = None;
        save_settings(&state.db, &settings).map_err(|e| e.to_string())?;
    }
    // Drop the watcher so notify releases the FSEvents handle.
    *state.vault_watcher.lock() = None;
    let _ = app.emit("vault-changed", ());
    vault_status(state)
}

/// Suggest a sensible default vault location for first-run UX. Mirrors
/// Obsidian's "Vaults" pattern by sitting directly under the user's home,
/// where it's easy to find and natural to sync.
#[tauri::command]
fn suggested_vault_path() -> Result<String, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Couldn't resolve home directory".to_string())?;
    Ok(home.join("Fluister").to_string_lossy().into_owned())
}

#[tauri::command]
fn open_vault_in_finder(state: State<'_, AppState>) -> Result<(), String> {
    let path = state
        .settings
        .lock()
        .vault_path
        .clone()
        .ok_or_else(|| "No vault configured".to_string())?;
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("open: {e}"))?;
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
    if let Some(root) = vault_root(&state) {
        if let Err(e) = vault_write_profile(&root, &p) {
            log::warn!("vault write failed for new profile {}: {e}", p.name);
        }
    }
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
    // Capture pre-update name + ulid so we can delete the old vault file
    // if the user renamed the profile (slugified filename changes).
    let pre = state.db.get_profile(id).map_err(|e| e.to_string())?;

    state
        .db
        .update_profile(id, &name, &description, &style_prompt, &vocabulary)
        .map_err(|e| e.to_string())?;

    if let Some(root) = vault_root(&state) {
        if let Some(prev) = pre {
            if prev.name != name {
                if let Err(e) = vault::delete_profile(&root, &prev.name) {
                    log::warn!("vault delete (rename) failed for {}: {e}", prev.name);
                }
            }
            // Re-fetch with the new contents so we write the updated file.
            if let Ok(Some(updated)) = state.db.get_profile(id) {
                if let Err(e) = vault_write_profile(&root, &updated) {
                    log::warn!("vault write failed for {}: {e}", updated.name);
                }
            }
        }
    }
    let _ = app.emit("profiles-changed", ());
    Ok(())
}

#[tauri::command]
fn delete_profile(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    let pre = state.db.get_profile(id).map_err(|e| e.to_string())?;

    state.db.delete_profile(id).map_err(|e| e.to_string())?;

    // If the active profile was the one we just deleted, clear it so the
    // resolver falls back to "Default".
    let cleared_active = {
        let mut current = state.settings.lock();
        if current.active_profile_id == Some(id) {
            current.active_profile_id = None;
            let _ = save_settings(&state.db, &current);
            true
        } else {
            false
        }
    };

    if let Some(root) = vault_root(&state) {
        if let Some(prev) = &pre {
            if let Err(e) = vault::delete_profile(&root, &prev.name) {
                log::warn!("vault delete failed for {}: {e}", prev.name);
            }
        }
        if cleared_active {
            if let Err(e) = vault_write_meta(&state, &root) {
                log::warn!("vault meta refresh failed: {e}");
            }
        }
    }

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
    if let Some(root) = vault_root(&state) {
        if let Err(e) = vault_write_meta(&state, &root) {
            log::warn!("vault meta refresh failed: {e}");
        }
    }
    let _ = app.emit("profiles-changed", ());
    Ok(())
}

// ─── Vocabulary ─────────────────────────────────────────────────────────────

#[tauri::command]
fn list_vocabulary(state: State<'_, AppState>) -> Result<Vec<db::VocabularyEntry>, String> {
    state.db.list_vocabulary().map_err(|e| e.to_string())
}

/// Mirror the full vocabulary list to the vault if a vault is configured.
/// Vocabulary lives in a single Markdown table (Global.md) so every change
/// rewrites the file from the post-mutation SQLite list — there's no
/// per-entry file to selectively update.
fn vault_sync_vocabulary(state: &AppState) {
    let Some(root) = vault_root(state) else {
        return;
    };
    let entries = match state.db.list_vocabulary() {
        Ok(v) => v,
        Err(e) => {
            log::warn!("vault sync vocab: list failed: {e}");
            return;
        }
    };
    if let Err(e) = vault_rewrite_vocabulary(&root, &entries) {
        log::warn!("vault sync vocab: write failed: {e}");
    }
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
    vault_sync_vocabulary(&state);
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
    vault_sync_vocabulary(&state);
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
    vault_sync_vocabulary(&state);
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

    // Reconcile the SQLite cache with the user's vault on boot. Best-effort;
    // a malformed file shouldn't prevent the app from starting.
    if let Some(root) = settings.vault_path.as_ref() {
        match reconcile_vault_into_db(&database, root, false) {
            Ok(_) => log::info!("vault reconciled at {}", root.display()),
            Err(e) => log::warn!("vault reconcile failed at {}: {e}", root.display()),
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            recorder: Arc::new(audio::Recorder::new()),
            is_recording: Arc::new(Mutex::new(false)),
            whisper: Arc::new(Mutex::new(None)),
            settings: Arc::new(Mutex::new(settings)),
            db: database,
            recording_started_at: Arc::new(Mutex::new(None)),
            last_external_app: Arc::new(Mutex::new(None)),
            vault_watcher: Arc::new(Mutex::new(None)),
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
            vault_status,
            set_vault_path,
            clear_vault_path,
            open_vault_in_finder,
            suggested_vault_path,
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

            // If the user already has a vault configured, start watching it
            // now. Boot already ran the merge-both-ways reconcile above; the
            // watcher takes over for live edits going forward.
            {
                let state: tauri::State<AppState> = app.state();
                let path = state.settings.lock().vault_path.clone();
                if let Some(path) = path {
                    match vault_watcher::start(app.handle().clone(), path.clone()) {
                        Ok(w) => {
                            *state.vault_watcher.lock() = Some(w);
                            log::info!("vault watcher started at {}", path.display());
                        }
                        Err(e) => log::warn!(
                            "vault watcher failed to start at {}: {e}",
                            path.display()
                        ),
                    }
                }
            }

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

            // The pill is purely a status indicator — never receives
            // clicks — so the overlay window is configured to pass every
            // mouse event through to whatever's underneath. We don't
            // apply NSVisualEffectView at the window level either; doing
            // so paints the entire window with an opaque frosted backdrop
            // that shows up as a grey rectangle around the pill. The
            // pill provides its own translucent-dark fill via CSS.
            #[cfg(target_os = "macos")]
            if let Some(overlay) = app.get_webview_window("overlay") {
                if let Err(err) = overlay.set_ignore_cursor_events(true) {
                    log::warn!("overlay set_ignore_cursor_events failed: {err:?}");
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
