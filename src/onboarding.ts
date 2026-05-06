import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  LANGUAGES,
  isEnglishLanguage,
  recommendedWhisperFilename,
  recommendedWhisperLabel,
} from "./languages";

type MicStatus = "not-determined" | "restricted" | "denied" | "authorized";

interface OnboardingStatus {
  microphone: MicStatus;
  accessibility: boolean;
  has_whisper_model: boolean;
  ollama_running: boolean;
  ollama_has_models: boolean;
  onboarding_complete: boolean;
}

interface ModelInfo {
  filename: string;
  label: string;
  multilingual: boolean;
  size_bytes: number;
  installed: boolean;
  active: boolean;
  path: string;
}

interface Settings {
  language: string;
  // ...other fields not needed here
  [key: string]: unknown;
}

interface DownloadProgress {
  filename: string;
  downloaded: number;
  total: number;
  bytes_per_sec: number;
}

const listEl       = document.getElementById("ob-list") as HTMLElement;
const ctaBtn       = document.getElementById("ob-cta") as HTMLButtonElement;
const progressEl   = document.getElementById("ob-progress") as HTMLElement;
const progressFill = progressEl.querySelector(".ob-progress-fill") as HTMLElement;
const progressPct  = progressEl.querySelector(".ob-progress-pct") as HTMLElement;
const langSelect   = document.getElementById("ob-language") as HTMLSelectElement;

let status: OnboardingStatus | null = null;
let whisperModels: ModelInfo[] = [];
let language = "en-US";
let downloading = false;
let ollamaSkipped = false;
let pollTimer: number | undefined;

// Populate the language dropdown once.
for (const l of LANGUAGES) {
  const opt = document.createElement("option");
  opt.value = l.code;
  opt.textContent = l.name;
  langSelect.appendChild(opt);
}

// ─── Status polling ──────────────────────────────────────────────────────────

async function refresh() {
  try {
    const [s, models, settings] = await Promise.all([
      invoke<OnboardingStatus>("onboarding_status"),
      invoke<ModelInfo[]>("list_whisper_models"),
      invoke<Settings>("get_settings"),
    ]);
    status = s;
    whisperModels = models;
    if (settings.language && language !== settings.language) {
      language = settings.language;
      langSelect.value = language;
    } else if (!langSelect.value) {
      langSelect.value = language;
    }
    render();
  } catch (e) {
    console.error("onboarding refresh failed", e);
  }
}

function startPolling() {
  if (pollTimer !== undefined) return;
  pollTimer = window.setInterval(refresh, 1500);
}

window.addEventListener("focus", refresh);

// ─── Whisper compatibility logic ────────────────────────────────────────────

function whisperReady(): boolean {
  if (isEnglishLanguage(language)) {
    // Any installed model works for English variants — both .en and the
    // multilingual base will transcribe English correctly.
    return whisperModels.some((m) => m.installed);
  }
  // Non-English (or auto-detect) requires a multilingual model.
  return whisperModels.some((m) => m.installed && m.multilingual);
}

function recommendedSizeMB(): number {
  // tiny ≈ 39 MB, base ≈ 142 MB. We always recommend base for onboarding.
  return 142;
}

// ─── Rendering ──────────────────────────────────────────────────────────────

function setRow(step: string, state: "ok" | "warn" | "loading", btn?: { label?: string; hidden?: boolean }) {
  const row = listEl.querySelector<HTMLElement>(`.ob-row[data-step="${step}"]`);
  if (!row) return;
  row.dataset.state = state;
  const icon = row.querySelector<HTMLElement>(".ob-row-icon");
  if (icon) icon.dataset.state = state;
  const button = row.querySelector<HTMLButtonElement>(".ob-row-btn");
  if (button && btn) {
    if (typeof btn.label === "string") button.textContent = btn.label;
    if (typeof btn.hidden === "boolean") button.classList.toggle("hidden", btn.hidden);
  }
}

function render() {
  if (!status) return;

  // Microphone
  if (status.microphone === "authorized") {
    setRow("microphone", "ok", { hidden: true });
  } else if (status.microphone === "not-determined") {
    setRow("microphone", "warn", { label: "Grant access", hidden: false });
  } else {
    setRow("microphone", "warn", { label: "Open Settings", hidden: false });
  }

  // Accessibility
  if (status.accessibility) {
    setRow("accessibility", "ok", { hidden: true });
  } else {
    setRow("accessibility", "warn", { label: "Open Settings", hidden: false });
  }

  // Whisper model — language-aware
  const ready = whisperReady();
  const desc = document.getElementById("ob-whisper-desc");
  const whisperBtn = listEl.querySelector<HTMLButtonElement>(`.ob-row[data-step="whisper"] .ob-row-btn`);

  if (desc) {
    desc.textContent = `${recommendedWhisperLabel(language)} · ~${recommendedSizeMB()} MB.`;
  }

  if (ready) {
    setRow("whisper", "ok", { hidden: true });
    progressEl.classList.add("hidden");
  } else if (downloading) {
    setRow("whisper", "warn");
    if (whisperBtn) whisperBtn.classList.add("hidden");
    progressEl.classList.remove("hidden");
  } else {
    setRow("whisper", "warn", { label: `Download · ${recommendedSizeMB()} MB`, hidden: false });
    progressEl.classList.add("hidden");
  }

  // Ollama
  if (ollamaSkipped) {
    setRow("ollama", "ok", { hidden: true });
  } else if (status.ollama_running && status.ollama_has_models) {
    setRow("ollama", "ok", { hidden: true });
  } else if (status.ollama_running && !status.ollama_has_models) {
    setRow("ollama", "warn", { label: "Copy pull command", hidden: false });
    setOllamaDesc("Ollama is running but no models are pulled. Run `ollama pull llama3.2` in Terminal.");
  } else {
    setRow("ollama", "warn", { label: "Get Ollama", hidden: false });
    setOllamaDesc("Polishes filler words and punctuation. Runs locally — install once and forget.");
  }

  // CTA enabled when must-haves are green. Ollama is optional.
  ctaBtn.disabled = !(status.microphone === "authorized" && status.accessibility && ready);
}

function setOllamaDesc(text: string) {
  const el = document.getElementById("ob-ollama-desc");
  if (el) el.textContent = text;
}

// ─── Language change ────────────────────────────────────────────────────────

langSelect.addEventListener("change", async () => {
  const newLang = langSelect.value;
  if (newLang === language) return;
  language = newLang;
  // Save to settings so the rest of the app picks it up immediately.
  try {
    const current = await invoke<Settings>("get_settings");
    await invoke("update_settings", {
      settings: { ...current, language: newLang },
    });
  } catch (e) {
    console.error("save language failed", e);
  }
  render();
});

// ─── Button handling ────────────────────────────────────────────────────────

document.addEventListener("click", async (e) => {
  const target = e.target as HTMLElement;
  const btn = target.closest<HTMLButtonElement>("button[data-action]");
  if (!btn) return;
  const action = btn.dataset.action!;

  switch (action) {
    case "grant-mic":
      btn.disabled = true;
      try {
        await invoke<MicStatus>("request_microphone_access");
      } catch (err) {
        console.error(err);
      }
      btn.disabled = false;
      await refresh();
      // If the prompt was already declined in a previous session, the call
      // can't re-trigger it — deep-link to Settings as a fallback.
      if (status?.microphone === "denied" || status?.microphone === "restricted") {
        await invoke("open_privacy_panel", { panel: "microphone" });
      }
      break;

    case "open-accessibility":
      await invoke("open_privacy_panel", { panel: "accessibility" });
      break;

    case "download-whisper":
      downloading = true;
      btn.classList.add("hidden");
      progressEl.classList.remove("hidden");
      progressFill.style.width = "0%";
      progressPct.textContent = "0%";
      try {
        await invoke("download_whisper_model", {
          filename: recommendedWhisperFilename(language),
        });
      } catch (err) {
        console.error("download failed", err);
        downloading = false;
        progressEl.classList.add("hidden");
        btn.classList.remove("hidden");
      }
      break;

    case "open-ollama-site":
      if (status?.ollama_running && !status.ollama_has_models) {
        try { await navigator.clipboard.writeText("ollama pull llama3.2"); } catch {}
      } else {
        await invoke("open_external_url", { url: "https://ollama.com" });
      }
      break;

    case "skip-ollama":
      ollamaSkipped = true;
      render();
      break;

    default:
      break;
  }
});

ctaBtn.addEventListener("click", async () => {
  try {
    await invoke("finish_onboarding");
  } catch (err) {
    console.error("finish_onboarding failed", err);
  }
});

// ─── Download progress events ──────────────────────────────────────────────

listen<DownloadProgress>("model-download-progress", (e) => {
  const p = e.payload;
  const pct = p.total > 0 ? Math.min(100, Math.floor((p.downloaded / p.total) * 100)) : 0;
  progressFill.style.width = `${pct}%`;
  progressPct.textContent = `${pct}%`;
});

listen<{ filename: string; path: string }>("model-download-done", async (e) => {
  downloading = false;
  // Make the just-downloaded model the active one — important when the
  // user picked a non-English language while a .en model was active.
  try {
    await invoke("set_active_whisper_model", { path: e.payload.path });
  } catch (err) {
    console.error("set_active_whisper_model failed", err);
  }
  await refresh();
});

listen<{ filename: string; error: string }>("model-download-failed", async (e) => {
  downloading = false;
  console.error("download failed", e.payload.error);
  await refresh();
});

// ─── Boot ───────────────────────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", () => {
  refresh();
  startPolling();
});
