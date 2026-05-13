//! Supervisor for the bundled `llama-server` sidecar.
//!
//! Lazy-spawns the child on first cleanup request, polls its `/health`
//! endpoint until ready, serves chat-completions on a loopback port, and
//! kills the child after 5 minutes of inactivity to free RAM. On app exit
//! the supervisor is given a synchronous chance to SIGTERM + SIGKILL the
//! child so it doesn't outlive the parent.

use std::path::Path;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Context, Result};
use serde_json::Value;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::sync::Mutex;
use tokio::time::sleep;

const SIDECAR_NAME: &str = "binaries/llama-server";
const HEALTH_POLL_INTERVAL: Duration = Duration::from_millis(250);
const HEALTH_TIMEOUT: Duration = Duration::from_secs(60);
const IDLE_TIMEOUT: Duration = Duration::from_secs(5 * 60);
const IDLE_TICK: Duration = Duration::from_secs(60);
const SIGTERM_GRACE: Duration = Duration::from_secs(2);
const CHAT_TIMEOUT: Duration = Duration::from_secs(120);

static STATE: OnceLock<Mutex<Inner>> = OnceLock::new();
static HTTP: OnceLock<reqwest::Client> = OnceLock::new();

enum Inner {
    Idle,
    Running {
        port: u16,
        pid: u32,
        child: CommandChild,
        last_used: Instant,
    },
}

fn state() -> &'static Mutex<Inner> {
    STATE.get_or_init(|| Mutex::new(Inner::Idle))
}

fn http() -> &'static reqwest::Client {
    HTTP.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(2))
            .build()
            .expect("failed to build reqwest client")
    })
}

/// Wire up the idle watchdog. Call once from the Tauri setup() hook.
pub fn install_idle_watchdog() {
    tauri::async_runtime::spawn(async {
        loop {
            sleep(IDLE_TICK).await;
            let mut guard = state().lock().await;
            let idle_too_long = matches!(
                *guard,
                Inner::Running { last_used, .. } if last_used.elapsed() > IDLE_TIMEOUT
            );
            if idle_too_long {
                log::info!("llama-server idle > {}s, shutting down", IDLE_TIMEOUT.as_secs());
                terminate_locked(&mut guard);
            }
        }
    });
}

/// Make a cleanup chat-completions request against the bundled server,
/// (re)spawning it if necessary.
pub async fn chat_completions(app: &AppHandle, model_path: &Path, body: Value) -> Result<String> {
    let base_url = ensure_running(app, model_path).await?;

    let resp = http()
        .post(format!("{base_url}/v1/chat/completions"))
        .timeout(CHAT_TIMEOUT)
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                anyhow!(
                    "llama-server cleanup timed out after {}s",
                    CHAT_TIMEOUT.as_secs()
                )
            } else {
                anyhow!("llama-server request failed: {e}")
            }
        })?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(anyhow!("llama-server responded with {status}: {body}"));
    }

    let parsed: ChatCompletionsResponse = resp
        .json()
        .await
        .map_err(|e| anyhow!("failed to parse llama-server response: {e}"))?;

    if let Some(choice) = parsed.choices.into_iter().next() {
        if choice.finish_reason.as_deref() == Some("length") {
            return Err(anyhow!(
                "llama-server output was truncated. Try a shorter dictation or a model with a larger context window."
            ));
        }
        Ok(choice.message.content)
    } else {
        Err(anyhow!("llama-server returned no choices"))
    }
}

/// Lazy-spawns the sidecar if not already running, returns its base URL.
/// Holds the supervisor mutex across spawn + health check, so concurrent
/// callers wait for the first one to finish bringing the server up.
pub async fn ensure_running(app: &AppHandle, model_path: &Path) -> Result<String> {
    if !model_path.exists() {
        return Err(anyhow!(
            "cleanup model is not downloaded yet at {}",
            model_path.display()
        ));
    }

    let mut guard = state().lock().await;

    // Already running? Reap it if the child died on us, otherwise reuse it.
    if let Inner::Running { .. } = &*guard {
        // No portable try_wait() on CommandChild, so we treat the cached
        // state as authoritative and let HTTP errors surface a dead child
        // on the next request (the supervisor re-spawns then).
        if let Inner::Running { port, last_used, .. } = &mut *guard {
            *last_used = Instant::now();
            return Ok(format!("http://127.0.0.1:{port}"));
        }
    }

    let port = pick_free_port()?;
    log::info!(
        "spawning llama-server on 127.0.0.1:{port} with {}",
        model_path.display()
    );

    let resource_dir = llama_resource_dir(app)?;
    let model_path_str = model_path.to_string_lossy().into_owned();

    let cmd = app
        .shell()
        .sidecar(SIDECAR_NAME)
        .with_context(|| format!("resolving sidecar '{SIDECAR_NAME}'"))?
        .args([
            "--host", "127.0.0.1",
            "--port", &port.to_string(),
            "--model", &model_path_str,
            // CPU thread count: leave default (llama.cpp picks a sensible
            // value from hw_concurrency). Metal handles the heavy lifting.
            "--no-webui",
            // Conservative context length — cleanup prompts are short and a
            // bigger ctx would just waste KV-cache RAM.
            "--ctx-size", "4096",
            // Slot management: one request at a time is plenty for a
            // single-user dictation app.
            "--parallel", "1",
        ])
        // Belt-and-suspenders: tell ggml-metal where to find default.metallib.
        // The bundled rpath already covers dylibs.
        .env("GGML_METAL_PATH_RESOURCES", resource_dir.to_string_lossy().to_string());

    let (mut rx, child) = cmd
        .spawn()
        .with_context(|| "failed to spawn llama-server sidecar")?;
    let pid = child.pid();

    // Drain stdout/stderr in the background — llama.cpp is chatty and we
    // want its logs visible during dev without blocking the pipe.
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                    if let Ok(text) = std::str::from_utf8(&line) {
                        log::debug!("[llama-server] {}", text.trim_end());
                    }
                }
                CommandEvent::Terminated(payload) => {
                    log::warn!(
                        "llama-server (pid {pid}) terminated: code={:?} signal={:?}",
                        payload.code,
                        payload.signal
                    );
                    let mut guard = state().lock().await;
                    if let Inner::Running { pid: current, .. } = &*guard {
                        if *current == pid {
                            *guard = Inner::Idle;
                        }
                    }
                    return;
                }
                _ => {}
            }
        }
    });

    *guard = Inner::Running {
        port,
        pid,
        child,
        last_used: Instant::now(),
    };

    // Drop the mutex during /health polling so a slow startup doesn't lock
    // out the watchdog or shutdown.
    drop(guard);

    wait_for_health(port).await.inspect_err(|_| {
        // Health failed — tear down whatever we just spawned so the next
        // request gets a clean retry.
        if let Some(mtx) = STATE.get() {
            let mut g = mtx.blocking_lock();
            terminate_locked(&mut g);
        }
    })?;

    Ok(format!("http://127.0.0.1:{port}"))
}

/// Synchronous shutdown — called from the Tauri `RunEvent::Exit` hook. Tries
/// SIGTERM first to give llama.cpp a chance to release Metal handles, then
/// SIGKILL after a short grace period.
pub fn shutdown_blocking() {
    let Some(mtx) = STATE.get() else { return };
    let mut guard = mtx.blocking_lock();
    terminate_locked(&mut guard);
}

fn terminate_locked(guard: &mut Inner) {
    let prev = std::mem::replace(guard, Inner::Idle);
    if let Inner::Running { pid, child, .. } = prev {
        log::info!("terminating llama-server pid {pid}");
        // SIGTERM first.
        unsafe {
            libc::kill(pid as i32, libc::SIGTERM);
        }
        // Brief grace period for clean shutdown, then SIGKILL via the
        // CommandChild (which sends SIGKILL on Unix).
        std::thread::sleep(SIGTERM_GRACE);
        let _ = child.kill();
    }
}

async fn wait_for_health(port: u16) -> Result<()> {
    let url = format!("http://127.0.0.1:{port}/health");
    let deadline = Instant::now() + HEALTH_TIMEOUT;
    let mut last_err: Option<String> = None;

    while Instant::now() < deadline {
        sleep(HEALTH_POLL_INTERVAL).await;
        match http()
            .get(&url)
            .timeout(Duration::from_secs(2))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => return Ok(()),
            Ok(resp) => last_err = Some(format!("status={}", resp.status())),
            Err(e) => last_err = Some(e.to_string()),
        }
    }

    Err(anyhow!(
        "llama-server didn't become healthy within {}s ({})",
        HEALTH_TIMEOUT.as_secs(),
        last_err.unwrap_or_else(|| "no response".into())
    ))
}

fn pick_free_port() -> Result<u16> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0")
        .context("binding to 127.0.0.1:0 to discover a free port")?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

fn llama_resource_dir(app: &AppHandle) -> Result<std::path::PathBuf> {
    // In the bundled .app this resolves to Contents/Resources/llama via the
    // `resources` map in tauri.conf.json. In dev it resolves to
    // src-tauri/resources/llama (lowercase) — both lay out the .dylibs and
    // default.metallib for the sidecar to load.
    if let Ok(path) = app.path().resolve("llama", BaseDirectory::Resource) {
        if path.exists() {
            return Ok(path);
        }
    }

    // Dev fallback: walk up from the binary location.
    if let Ok(exe) = std::env::current_exe() {
        let candidate = exe
            .parent()
            .map(|p| p.join("../resources/llama"))
            .map(|p| p.canonicalize().unwrap_or(p));
        if let Some(c) = candidate {
            if c.exists() {
                return Ok(c);
            }
        }
    }

    Err(anyhow!("could not locate llama resource directory"))
}

#[derive(serde::Deserialize)]
struct ChatCompletionsResponse {
    choices: Vec<ChatChoice>,
}

#[derive(serde::Deserialize)]
struct ChatChoice {
    message: ChoiceMessage,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(serde::Deserialize)]
struct ChoiceMessage {
    content: String,
}
