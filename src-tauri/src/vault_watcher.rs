//! Vault file-system watcher.
//!
//! Watches the user's Fluister vault directory recursively. When files
//! change (because Obsidian saved a profile, or the user pulled a vault
//! sync, or they renamed something in Finder) we run the canonical
//! reconcile — vault wins, including absences — and emit
//! `profiles-changed` / `vocabulary-changed` so the UI refreshes.
//!
//! Debouncing: notify backends fire bursts of events for a single save
//! (FSEvents on macOS coalesces poorly for short-lived edits). We block
//! waiting for the first event, then drain the channel for 250ms before
//! running a single reconcile pass.
//!
//! Echo protection: not currently implemented. The reconcile is
//! idempotent and emits regardless, so a self-write triggers one extra
//! refresh on the frontend — harmless and avoids a stateful filter.
//! Revisit if it shows up as UI churn.

use anyhow::Result;
use notify::{RecommendedWatcher, RecursiveMode, Watcher as _};
use std::path::PathBuf;
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

use crate::{db, reconcile_vault_into_db, sync_meta_into_settings, vault, AppState};

const DEBOUNCE: Duration = Duration::from_millis(250);

/// Owns the OS-level watcher. Drop to stop the loop — the channel sender
/// inside notify gets dropped, the receiver thread exits.
pub struct VaultWatcher {
    _watcher: RecommendedWatcher,
}

pub fn start(app: AppHandle, root: PathBuf) -> Result<VaultWatcher> {
    // Make sure the layout exists before we try to watch it.
    vault::ensure_layout(&root)?;

    let (tx, rx) = mpsc::channel::<()>();

    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        // We don't care about event details — every change runs a full
        // reconcile, so we just need to know that *something* changed.
        if res.is_ok() {
            let _ = tx.send(());
        }
    })?;
    watcher.watch(&root, RecursiveMode::Recursive)?;

    thread::spawn(move || debounce_loop(app, root, rx));

    Ok(VaultWatcher { _watcher: watcher })
}

fn debounce_loop(app: AppHandle, root: PathBuf, rx: mpsc::Receiver<()>) {
    loop {
        // Block until the first event of a new burst.
        if rx.recv().is_err() {
            log::debug!("vault watcher channel closed; exiting");
            return;
        }
        // Drain any further events arriving within DEBOUNCE.
        let deadline = Instant::now() + DEBOUNCE;
        while let Some(remaining) = deadline.checked_duration_since(Instant::now()) {
            if rx.recv_timeout(remaining).is_err() {
                break;
            }
        }

        let state = app.state::<AppState>();

        // The user may have disabled the vault while we were debouncing.
        // Bail out without emitting; the watcher will be dropped shortly.
        let still_active = state.settings.lock().vault_path.as_deref() == Some(root.as_path());
        if !still_active {
            log::debug!("vault watcher: path no longer active, skipping reconcile");
            continue;
        }

        match reconcile_vault_into_db(&state.db as &db::Db, &root, true) {
            Ok(_) => {}
            Err(e) => {
                log::warn!("vault watcher reconcile failed: {e}");
                continue;
            }
        }
        if let Err(e) = sync_meta_into_settings(&state, &root) {
            log::warn!("vault watcher meta sync failed: {e}");
        }

        let _ = app.emit("profiles-changed", ());
        let _ = app.emit("vocabulary-changed", ());
        let _ = app.emit("vault-changed", ());
    }
}
