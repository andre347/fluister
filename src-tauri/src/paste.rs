use anyhow::{anyhow, Result};
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

pub async fn paste_text(app: &AppHandle, text: &str) -> Result<()> {
    if text.is_empty() {
        return Ok(());
    }

    app.clipboard()
        .write_text(text.to_string())
        .map_err(|e| anyhow!("clipboard write: {e}"))?;

    // Let the system register the new pasteboard contents before sending ⌘V.
    tokio::time::sleep(Duration::from_millis(80)).await;

    synthesize_keystroke(app).await
}

/// Synthesize a ⌘V keystroke without touching the clipboard. Useful when the
/// caller has already populated the pasteboard and just needs the keystroke
/// dispatched to whatever app is now frontmost.
pub async fn synthesize_keystroke(app: &AppHandle) -> Result<()> {
    // enigo on macOS calls TSMGetInputSourceProperty, which asserts main-thread
    // dispatch and crashes if invoked from a worker thread. Hop to the main
    // thread via Tauri's runtime.
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(synthesize_paste());
    })
    .map_err(|e| anyhow!("dispatch to main thread: {e}"))?;

    rx.await
        .map_err(|e| anyhow!("paste main-thread channel: {e}"))??;
    Ok(())
}

fn synthesize_paste() -> Result<()> {
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| anyhow!("enigo init (grant Accessibility permission?): {e}"))?;
    enigo
        .key(Key::Meta, Direction::Press)
        .map_err(|e| anyhow!("press cmd: {e}"))?;
    enigo
        .key(Key::Unicode('v'), Direction::Click)
        .map_err(|e| anyhow!("click v: {e}"))?;
    enigo
        .key(Key::Meta, Direction::Release)
        .map_err(|e| anyhow!("release cmd: {e}"))?;
    Ok(())
}
