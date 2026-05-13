use std::path::PathBuf;

fn main() {
    stage_llama_server();
    tauri_build::build();
}

/// Run `scripts/fetch-llama-server.sh` so the externalBin path exists before
/// Tauri tries to read it. The script is idempotent — re-runs are no-ops when
/// the pinned version is already staged.
fn stage_llama_server() {
    // Only stage on macOS arm64 — the only target Fluister ships today.
    if !cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        return;
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let script = manifest_dir.join("scripts/fetch-llama-server.sh");
    let stamp = manifest_dir.join(".llama-stage/version.txt");
    let binary = manifest_dir.join("binaries/llama-server-aarch64-apple-darwin");

    // Tell cargo to re-run only when the script or stamp changes — not on
    // every recompile.
    println!("cargo:rerun-if-changed={}", script.display());
    println!("cargo:rerun-if-changed={}", stamp.display());
    println!("cargo:rerun-if-env-changed=LLAMA_VERSION");

    // Skip if both binary and stamp exist (script would also no-op, but
    // shelling out has noticeable overhead on every build).
    if binary.exists() && stamp.exists() {
        return;
    }

    let status = std::process::Command::new("bash")
        .arg(&script)
        .status()
        .expect("failed to spawn fetch-llama-server.sh — is bash on PATH?");

    if !status.success() {
        panic!(
            "fetch-llama-server.sh exited with {} — see stderr above",
            status
        );
    }
}
