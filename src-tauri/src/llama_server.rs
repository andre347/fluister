//! Supervisor for the bundled `llama-server` sidecar.
//!
//! Lazy-spawns the child on first cleanup request, polls its `/health`
//! endpoint until ready, serves chat-completions on a loopback port, and
//! kills the child after 5 minutes of inactivity to free RAM. On app exit
//! the supervisor is given a synchronous chance to SIGTERM + SIGKILL the
//! child so it doesn't outlive the parent.

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Context, Result};
use serde_json::Value;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child as TokioChild, Command as TokioCommand};
use tokio::sync::Mutex;
use tokio::time::sleep;

const SIDECAR_BINARY: &str = "llama-server";
const HEALTH_POLL_INTERVAL: Duration = Duration::from_millis(250);
const HEALTH_TIMEOUT: Duration = Duration::from_secs(60);
// A loaded llama-3.2-3B sits at ~2 GB resident — fine on Apple Silicon
// dictation rigs (16 GB minimum target). Keeping the sidecar warm for an
// hour after the last cleanup avoids the ~5 s cold-start hit on every
// dictation after a meeting or lunch break. Combined with the pre-warm
// task in lib.rs's setup() callback, the user sees a cold start only the
// first time Fluister itself launches.
const IDLE_TIMEOUT: Duration = Duration::from_secs(60 * 60);
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
        child: TokioChild,
        last_used: Instant,
        /// Bearer token llama-server expects on every chat request. Random
        /// per spawn so that other local processes which discover the port
        /// can't trivially share the user's model.
        api_key: String,
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
    let (base_url, api_key) = ensure_running(app, model_path).await?;

    let resp = http()
        .post(format!("{base_url}/v1/chat/completions"))
        .timeout(CHAT_TIMEOUT)
        .bearer_auth(&api_key)
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

/// Lazy-spawns the sidecar if not already running, returns its base URL and
/// the per-spawn bearer token the caller must present on every chat request.
/// Holds the supervisor mutex across spawn + health check, so concurrent
/// callers wait for the first one to finish bringing the server up.
pub async fn ensure_running(app: &AppHandle, model_path: &Path) -> Result<(String, String)> {
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
        if let Inner::Running { port, last_used, api_key, .. } = &mut *guard {
            *last_used = Instant::now();
            return Ok((format!("http://127.0.0.1:{port}"), api_key.clone()));
        }
    }

    let port = pick_free_port()?;
    let api_key = ulid::Ulid::new().to_string();
    log::info!(
        "spawning llama-server on 127.0.0.1:{port} with {}",
        model_path.display()
    );

    let resource_dir = llama_resource_dir(app)?;
    let model_path_str = model_path.to_string_lossy().into_owned();
    let binary_path = sidecar_binary_path()?;
    log::info!(
        "llama-server binary path: {} (exists={})",
        binary_path.display(),
        binary_path.exists()
    );

    // We bypass Tauri's shell plugin and use tokio::process::Command
    // directly with an absolute path. Tauri 2's sidecar resolution returns
    // ENOENT on macOS Tahoe for our bundle layout for reasons we couldn't
    // pin down, even though the binary spawns fine from a regular shell.
    // Going direct sidesteps the whole shell-plugin path entirely.
    let mut cmd = TokioCommand::new(&binary_path);
    cmd.args([
        "--host", "127.0.0.1",
        "--port", &port.to_string(),
        "--model", &model_path_str,
        // Require a bearer token on every chat request so other local
        // processes that discover the port can't piggyback on the
        // user's loaded model. `/health` is exempt server-side, so the
        // readiness poll below doesn't need to authenticate.
        "--api-key", &api_key,
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
    .env("GGML_METAL_PATH_RESOURCES", resource_dir.to_string_lossy().to_string())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .kill_on_drop(false); // We manage child lifecycle ourselves via terminate_locked.

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(err) => {
            log::error!(
                "spawn llama-server failed: {err:?} (binary={}, resource_dir={}, model={})",
                binary_path.display(),
                resource_dir.display(),
                model_path.display()
            );
            return Err(err).with_context(|| "failed to spawn llama-server sidecar");
        }
    };
    let pid = child.id().unwrap_or(0);
    log::info!("llama-server spawned pid={pid}");

    // Drain stdout + stderr line-by-line in background tasks. llama.cpp
    // emits a lot of startup chatter and we want it surfaced in the file
    // log without blocking the pipe.
    if let Some(stdout) = child.stdout.take() {
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                log::debug!("[llama-server] {line}");
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                log::debug!("[llama-server] {line}");
            }
        });
    }

    *guard = Inner::Running {
        port,
        pid,
        child,
        last_used: Instant::now(),
        api_key: api_key.clone(),
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

    Ok((format!("http://127.0.0.1:{port}"), api_key))
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
    if let Inner::Running { pid, mut child, .. } = prev {
        log::info!("terminating llama-server pid {pid}");
        // SIGTERM first.
        unsafe {
            libc::kill(pid as i32, libc::SIGTERM);
        }
        // Brief grace period for clean shutdown, then SIGKILL via tokio's
        // start_kill (synchronous, only signals — no async wait needed here
        // because we're already on the shutdown path).
        std::thread::sleep(SIGTERM_GRACE);
        let _ = child.start_kill();
    }
}

/// Resolve the absolute path to the bundled llama-server binary. In a
/// proper Tauri .app on macOS this is `<Bundle>/Contents/MacOS/llama-server`,
/// which is the same directory as the main fluister executable.
fn sidecar_binary_path() -> Result<PathBuf> {
    let exe = std::env::current_exe()
        .context("can't read current_exe to resolve sidecar path")?;
    let dir = exe
        .parent()
        .ok_or_else(|| anyhow!("current_exe has no parent dir"))?;
    Ok(dir.join(SIDECAR_BINARY))
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
