import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface Dictation {
  id: number;
  created_at: number;
  raw_text: string;
  cleaned_text: string;
  duration_ms: number;
  favorite: boolean;
}

type OverlayPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

type Theme = "system" | "light" | "dark";

interface Settings {
  ollama_model: string;
  whisper_model_path: string;
  vocabulary: string;
  cleanup_enabled: boolean;
  vad_silence_ms: number;
  overlay_position: OverlayPosition;
  theme: Theme;
  language: string;
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

interface DownloadProgress {
  filename: string;
  downloaded: number;
  total: number;
  bytes_per_sec: number;
}

interface DownloadDone {
  filename: string;
  path: string;
}

interface DownloadFailed {
  filename: string;
  error: string;
}

interface OllamaModel {
  name: string;
  size_bytes: number;
  family: string;
  parameter_size: string;
}

const LANGUAGES: Array<{ code: string; name: string; multilingual: boolean }> = [
  { code: "auto",  name: "Auto-detect",                   multilingual: true  },
  { code: "en-US", name: "English (United States)",       multilingual: false },
  { code: "en-GB", name: "English (United Kingdom)",      multilingual: false },
  { code: "en-AU", name: "English (Australia)",           multilingual: false },
  { code: "es-ES", name: "Spanish (Spain)",               multilingual: true  },
  { code: "es-LA", name: "Spanish (Latin America)",       multilingual: true  },
  { code: "fr-FR", name: "French",                        multilingual: true  },
  { code: "de-DE", name: "German",                        multilingual: true  },
  { code: "it-IT", name: "Italian",                       multilingual: true  },
  { code: "pt-BR", name: "Portuguese (Brazil)",           multilingual: true  },
  { code: "pt-PT", name: "Portuguese (Portugal)",         multilingual: true  },
  { code: "nl-NL", name: "Dutch",                         multilingual: true  },
  { code: "da-DK", name: "Danish",                        multilingual: true  },
  { code: "sv-SE", name: "Swedish",                       multilingual: true  },
  { code: "no-NO", name: "Norwegian",                     multilingual: true  },
  { code: "fi-FI", name: "Finnish",                       multilingual: true  },
  { code: "el-GR", name: "Greek",                         multilingual: true  },
  { code: "ru-RU", name: "Russian",                       multilingual: true  },
  { code: "pl-PL", name: "Polish",                        multilingual: true  },
  { code: "cs-CZ", name: "Czech",                         multilingual: true  },
  { code: "tr-TR", name: "Turkish",                       multilingual: true  },
  { code: "ar-SA", name: "Arabic",                        multilingual: true  },
  { code: "he-IL", name: "Hebrew",                        multilingual: true  },
  { code: "hi-IN", name: "Hindi",                         multilingual: true  },
  { code: "zh-CN", name: "Chinese (Simplified)",          multilingual: true  },
  { code: "zh-TW", name: "Chinese (Traditional)",         multilingual: true  },
  { code: "ja-JP", name: "Japanese",                      multilingual: true  },
  { code: "ko-KR", name: "Korean",                        multilingual: true  },
  { code: "vi-VN", name: "Vietnamese",                    multilingual: true  },
  { code: "th-TH", name: "Thai",                          multilingual: true  },
  { code: "id-ID", name: "Indonesian",                    multilingual: true  },
  { code: "uk-UA", name: "Ukrainian",                     multilingual: true  },
];

function isEnglishOnly(code: string): boolean {
  // The .en Whisper models only handle English. Auto-detect or anything
  // non-English requires a multilingual model.
  return code.startsWith("en-") || code === "en";
}

const listEl          = document.getElementById("list") as HTMLElement;
const emptyEl         = document.getElementById("empty") as HTMLElement;
const searchEl        = document.getElementById("search") as HTMLInputElement;
const favBtn          = document.getElementById("filter-fav") as HTMLButtonElement;
const settingsBtn     = document.getElementById("open-settings") as HTMLButtonElement;
const settingsPanel   = document.getElementById("settings-panel") as HTMLElement;
const settingsForm    = document.getElementById("settings-form") as HTMLFormElement;
const settingsStatus  = document.getElementById("settings-status") as HTMLElement;
const positionGrid    = document.getElementById("position-grid") as HTMLElement;
const themePicker     = document.getElementById("theme-picker") as HTMLElement;
const toolbarEl       = document.getElementById("toolbar") as HTMLElement;
const backBtn         = document.getElementById("back-from-settings") as HTMLButtonElement;
const settingsNav     = settingsPanel.querySelector(".settings-nav") as HTMLElement;
const aboutVersionEl  = document.getElementById("about-version") as HTMLElement;
const aboutStatusEl   = document.getElementById("about-update-status") as HTMLElement;
const aboutCheckBtn   = document.getElementById("about-check-updates") as HTMLButtonElement;
const languageSelect  = () => settingsForm.elements.namedItem("language") as HTMLSelectElement;
const modelsListEl    = () => document.getElementById("models-list") as HTMLElement;
const modelWarningEl  = () => document.getElementById("model-warning") as HTMLElement;
const modelWarningTxt = () => modelWarningEl().querySelector(".model-warning-text") as HTMLElement;
const modelWarningBtn = () => document.getElementById("model-warning-action") as HTMLButtonElement;

type SettingsSection = "general" | "recording" | "models" | "about";

let dictations: Dictation[] = [];
let expanded = new Set<number>();
let favoritesOnly = false;
let searchDebounce: number | undefined;
let settingsDebounce: number | undefined;
let statusFadeTimer: number | undefined;
let settingsOpen = false;
let activeSection: SettingsSection = "general";
let selectedIndex = -1;

const STAR_FILLED  = `<svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21Z"/></svg>`;
const STAR_OUTLINE = `<svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="m12 15.39-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.39M12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2Z"/></svg>`;
const ICON_COPY    = `<svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1Zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2Zm0 16H8V7h11v14Z"/></svg>`;
const ICON_PASTE   = `<svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2Zm-7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm-1 17-4-4 1.41-1.41L11 16.17l5.59-5.58L18 12l-7 7Z"/></svg>`;
const ICON_CHECK   = `<svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z"/></svg>`;
const ICON_TRASH   = `<svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"/></svg>`;

// ─── Theme ───────────────────────────────────────────────────────────────────

function applyTheme(theme: Theme) {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

function selectTheme(theme: Theme) {
  themePicker.querySelectorAll<HTMLButtonElement>("button[data-theme-value]").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.themeValue === theme ? "true" : "false");
  });
  applyTheme(theme);
}

function getSelectedTheme(): Theme {
  const active = themePicker.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
  return (active?.dataset.themeValue as Theme | undefined) ?? "system";
}

themePicker.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-theme-value]");
  if (!btn) return;
  selectTheme(btn.dataset.themeValue as Theme);
  saveSettings();
});

// ─── List rendering ──────────────────────────────────────────────────────────

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

interface DateGroup {
  label: string;
  items: Dictation[];
}

/**
 * Bucket dictations into Today / Yesterday / Earlier this week / Earlier so
 * the user can scan a long history quickly. Empty buckets are dropped.
 */
function groupByDate(items: Dictation[]): DateGroup[] {
  const todayStart = startOfDay(Date.now());
  const yesterdayStart = todayStart - 86_400_000;
  const weekStart = todayStart - 6 * 86_400_000; // last 7 days inclusive of today

  const buckets: DateGroup[] = [
    { label: "Today",            items: [] },
    { label: "Yesterday",        items: [] },
    { label: "Earlier this week", items: [] },
    { label: "Earlier",          items: [] },
  ];

  for (const item of items) {
    if (item.created_at >= todayStart)         buckets[0].items.push(item);
    else if (item.created_at >= yesterdayStart) buckets[1].items.push(item);
    else if (item.created_at >= weekStart)      buckets[2].items.push(item);
    else                                        buckets[3].items.push(item);
  }

  return buckets.filter((g) => g.items.length > 0);
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.max(1, Math.floor(diff / 1000));
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}h ago`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function refresh() {
  if (settingsOpen) return;
  try {
    dictations = await invoke<Dictation[]>("list_dictations", {
      limit: 200,
      offset: 0,
      favoritesOnly,
      search: searchEl.value || null,
    });
  } catch (e) {
    console.error("list_dictations failed", e);
    dictations = [];
  }
  // Selection is invalidated whenever the list changes.
  selectedIndex = -1;
  render();
}

function renderRow(d: Dictation, indexInList: number): string {
  const isOpen = expanded.has(d.id);
  const text = escapeHtml(d.cleaned_text);
  const meta = `${formatRelative(d.created_at)} · ${(d.duration_ms / 1000).toFixed(1)}s`;
  return `
    <article class="row${isOpen ? " expanded" : ""}" role="option" data-id="${d.id}" data-idx="${indexInList}" aria-selected="false">
      <div class="row-body" data-action="toggle">
        <div class="row-text">${text}</div>
        <div class="row-meta">${meta}</div>
      </div>
      <div class="row-actions">
        <button type="button" class="row-action${d.favorite ? " on" : ""}" data-action="favorite"
                aria-label="${d.favorite ? "Unfavorite" : "Favorite"}">${d.favorite ? STAR_FILLED : STAR_OUTLINE}</button>
        <button type="button" class="row-action" data-action="paste" aria-label="Paste into previous app">${ICON_PASTE}</button>
        <button type="button" class="row-action" data-action="copy"  aria-label="Copy to clipboard">${ICON_COPY}</button>
        <button type="button" class="row-action danger" data-action="delete" aria-label="Delete">${ICON_TRASH}</button>
      </div>
    </article>
  `;
}

function render() {
  if (dictations.length === 0) {
    listEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    emptyEl.classList.add("flex");
    if (searchEl.value || favoritesOnly) {
      document.getElementById("empty-title")!.textContent = "No matches";
      document.getElementById("empty-hint")!.textContent  = "Try a different search or filter";
    } else {
      document.getElementById("empty-title")!.textContent = "No dictations yet";
      document.getElementById("empty-hint")!.textContent  = "Hold Right ⌥ Option anywhere to start";
    }
    return;
  }
  emptyEl.classList.add("hidden");
  emptyEl.classList.remove("flex");

  const groups = groupByDate(dictations);
  let flatIndex = 0;
  listEl.innerHTML = groups
    .map(
      (g) => `
        <div class="group-header">${g.label}</div>
        ${g.items.map((d) => renderRow(d, flatIndex++)).join("")}
      `,
    )
    .join("");
  syncSelectionDom();
}

function syncSelectionDom() {
  listEl.querySelectorAll<HTMLElement>(".row").forEach((row) => {
    const idx = Number(row.dataset.idx);
    row.setAttribute("aria-selected", String(idx === selectedIndex));
  });
}

function moveSelection(delta: number) {
  if (dictations.length === 0) return;
  if (selectedIndex < 0) {
    selectedIndex = delta > 0 ? 0 : dictations.length - 1;
  } else {
    selectedIndex = Math.max(0, Math.min(dictations.length - 1, selectedIndex + delta));
  }
  syncSelectionDom();
  const row = listEl.querySelector<HTMLElement>(`.row[data-idx="${selectedIndex}"]`);
  row?.scrollIntoView({ block: "nearest" });
}

listEl.addEventListener("click", async (e) => {
  const target = e.target as HTMLElement;
  const actionEl = target.closest<HTMLElement>("[data-action]");
  if (!actionEl) return;
  const rowEl = target.closest<HTMLElement>(".row");
  if (!rowEl) return;
  const id = Number(rowEl.dataset.id);
  const idx = Number(rowEl.dataset.idx);
  selectedIndex = idx;
  syncSelectionDom();
  const action = actionEl.dataset.action;

  switch (action) {
    case "favorite": {
      try {
        const newValue = await invoke<boolean>("toggle_favorite", { id });
        const d = dictations.find((x) => x.id === id);
        if (d) {
          d.favorite = newValue;
          render();
        }
      } catch (err) {
        console.error("toggle_favorite failed", err);
      }
      break;
    }
    case "copy": {
      try {
        await invoke("copy_dictation", { id });
        flashCheck(actionEl as HTMLButtonElement);
      } catch (err) {
        console.error("copy_dictation failed", err);
      }
      break;
    }
    case "paste": {
      try {
        await invoke("paste_dictation", { id });
      } catch (err) {
        console.error("paste_dictation failed", err);
      }
      break;
    }
    case "delete": {
      try {
        await invoke("delete_dictation", { id });
        dictations = dictations.filter((x) => x.id !== id);
        expanded.delete(id);
        // Keep selection on the row that takes the deleted one's place.
        if (selectedIndex >= dictations.length) selectedIndex = dictations.length - 1;
        render();
      } catch (err) {
        console.error("delete_dictation failed", err);
      }
      break;
    }
    case "toggle": {
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
      render();
      break;
    }
  }
});

function flashCheck(btn: HTMLButtonElement) {
  if (btn.dataset.flashing === "1") return;
  btn.dataset.flashing = "1";
  const original = btn.innerHTML;
  btn.innerHTML = ICON_CHECK;
  btn.classList.add("ok");
  setTimeout(() => {
    btn.innerHTML = original;
    btn.classList.remove("ok");
    delete btn.dataset.flashing;
  }, 1100);
}

searchEl.addEventListener("input", () => {
  window.clearTimeout(searchDebounce);
  searchDebounce = window.setTimeout(refresh, 180);
});

favBtn.addEventListener("click", () => {
  favoritesOnly = !favoritesOnly;
  favBtn.setAttribute("aria-pressed", favoritesOnly ? "true" : "false");
  refresh();
});

// ─── Settings panel ──────────────────────────────────────────────────────────

settingsBtn.addEventListener("click", async () => {
  if (settingsOpen) closeSettings();
  else await openSettings();
});

async function openSettings(section: SettingsSection = activeSection) {
  settingsOpen = true;
  settingsBtn.setAttribute("aria-pressed", "true");
  toolbarEl.classList.add("settings-mode");
  listEl.classList.add("hidden");
  emptyEl.classList.add("hidden");
  emptyEl.classList.remove("flex");
  settingsPanel.classList.remove("hidden");
  settingsPanel.setAttribute("aria-hidden", "false");
  switchSection(section);
  await loadSettings();
  await refreshAboutPane();
}

function closeSettings() {
  settingsOpen = false;
  settingsBtn.setAttribute("aria-pressed", "false");
  toolbarEl.classList.remove("settings-mode");
  settingsPanel.classList.add("hidden");
  settingsPanel.setAttribute("aria-hidden", "true");
  listEl.classList.remove("hidden");
  refresh();
}

function switchSection(section: SettingsSection) {
  activeSection = section;
  settingsPanel.querySelectorAll<HTMLElement>(".settings-pane").forEach((p) => {
    p.classList.toggle("active", p.dataset.pane === section);
  });
  settingsNav.querySelectorAll<HTMLButtonElement>(".settings-nav-item").forEach((b) => {
    if (b.dataset.pane === section) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
}

settingsNav.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".settings-nav-item");
  if (!btn || !btn.dataset.pane) return;
  switchSection(btn.dataset.pane as SettingsSection);
});

backBtn.addEventListener("click", () => closeSettings());

async function loadSettings() {
  try {
    const s = await invoke<Settings>("get_settings");
    populateLanguageSelect(s.language);
    (settingsForm.elements.namedItem("vocabulary")         as HTMLTextAreaElement).value   = s.vocabulary;
    (settingsForm.elements.namedItem("cleanup_enabled")    as HTMLInputElement   ).checked = s.cleanup_enabled;
    (settingsForm.elements.namedItem("vad_silence_ms")     as HTMLInputElement   ).value   = String(s.vad_silence_ms);
    selectPosition(s.overlay_position);
    selectTheme(s.theme);
    await refreshModelList(s);
    updateModelWarning(s);
    await refreshOllamaModels(s.ollama_model);
  } catch (e) {
    console.error("get_settings failed", e);
  }
}

function populateLanguageSelect(current: string) {
  const sel = languageSelect();
  if (sel.options.length === 0) {
    for (const lang of LANGUAGES) {
      const opt = document.createElement("option");
      opt.value = lang.code;
      opt.textContent = lang.name;
      sel.appendChild(opt);
    }
  }
  sel.value = current;
}

function selectPosition(pos: OverlayPosition) {
  positionGrid.querySelectorAll<HTMLButtonElement>("button[data-pos]").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.pos === pos ? "true" : "false");
  });
}

function getSelectedPosition(): OverlayPosition {
  const active = positionGrid.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
  return (active?.dataset.pos as OverlayPosition | undefined) ?? "bottom-right";
}

positionGrid.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-pos]");
  if (!btn) return;
  selectPosition(btn.dataset.pos as OverlayPosition);
  saveSettings();
});

settingsForm.addEventListener("input", () => {
  window.clearTimeout(settingsDebounce);
  settingsDebounce = window.setTimeout(saveSettings, 400);
});

async function saveSettings() {
  // Pull current settings to fill in fields the form doesn't own (the
  // whisper_model_path is set via the model list, not a text input).
  let current: Settings;
  try {
    current = await invoke<Settings>("get_settings");
  } catch (e) {
    console.error("get_settings failed", e);
    return;
  }

  const settings: Settings = {
    ...current,
    ollama_model:    (settingsForm.elements.namedItem("ollama_model")    as HTMLSelectElement).value,
    vocabulary:      (settingsForm.elements.namedItem("vocabulary")      as HTMLTextAreaElement).value,
    cleanup_enabled: (settingsForm.elements.namedItem("cleanup_enabled") as HTMLInputElement).checked,
    vad_silence_ms:  Number((settingsForm.elements.namedItem("vad_silence_ms") as HTMLInputElement).value || 0),
    overlay_position: getSelectedPosition(),
    theme:            getSelectedTheme(),
    language:         languageSelect().value,
  };
  try {
    await invoke("update_settings", { settings });
    showStatus("Saved");
    updateModelWarning(settings);
  } catch (e) {
    console.error("update_settings failed", e);
    showStatus("Save failed");
  }
}

function showStatus(msg: string) {
  settingsStatus.textContent = msg;
  settingsStatus.classList.remove("opacity-0");
  window.clearTimeout(statusFadeTimer);
  statusFadeTimer = window.setTimeout(() => {
    settingsStatus.classList.add("opacity-0");
  }, 1200);
}

// ─── Whisper model management ───────────────────────────────────────────────

const downloads = new Map<string, DownloadProgress>();
let cachedModels: ModelInfo[] = [];

function formatBytes(b: number): string {
  if (b >= 1_000_000_000) return `${(b / 1_000_000_000).toFixed(1)} GB`;
  if (b >= 1_000_000)     return `${Math.round(b / 1_000_000)} MB`;
  if (b >= 1_000)         return `${Math.round(b / 1_000)} KB`;
  return `${b} B`;
}

async function refreshModelList(settingsForWarning?: Settings) {
  try {
    cachedModels = await invoke<ModelInfo[]>("list_whisper_models");
  } catch (e) {
    console.error("list_whisper_models failed", e);
    cachedModels = [];
  }
  renderModels();
  if (settingsForWarning) updateModelWarning(settingsForWarning);
}

function renderModels() {
  modelsListEl().innerHTML = cachedModels.map(renderModelRow).join("");
}

function renderModelRow(m: ModelInfo): string {
  const dl = downloads.get(m.filename);
  let action: string;
  if (dl) {
    const pct = dl.total > 0 ? Math.min(100, Math.floor((dl.downloaded / dl.total) * 100)) : 0;
    action = `
      <div class="model-progress">
        <div class="bar"><div class="bar-fill" style="width: ${pct}%"></div></div>
        <div class="pct">${pct}%</div>
      </div>`;
  } else if (m.active) {
    action = `<button type="button" class="model-action active-tag" disabled>Active</button>`;
  } else if (m.installed) {
    action = `<button type="button" class="model-action secondary" data-use="${m.path}">Use</button>`;
  } else {
    action = `<button type="button" class="model-action" data-download="${m.filename}">Download · ${formatBytes(m.size_bytes)}</button>`;
  }

  let meta: string;
  if (dl) {
    const downloaded = formatBytes(dl.downloaded);
    const total = formatBytes(dl.total);
    const speed = dl.bytes_per_sec > 0 ? ` · ${formatBytes(dl.bytes_per_sec)}/s` : "";
    meta = `${downloaded} / ${total}${speed}`;
  } else {
    const tags = [
      m.installed ? "Installed" : `Not installed`,
      m.multilingual ? "99 languages" : "English only",
    ];
    meta = `${formatBytes(m.size_bytes)} · ${tags.join(" · ")}`;
  }

  return `
    <div class="model-item${m.active ? " active" : ""}">
      <div class="model-info">
        <div class="model-name">${m.label}</div>
        <div class="model-meta">${meta}</div>
      </div>
      ${action}
    </div>
  `;
}

modelsListEl()?.addEventListener("click", async (e) => {
  const target = e.target as HTMLElement;
  const downloadBtn = target.closest<HTMLButtonElement>("button[data-download]");
  if (downloadBtn) {
    const filename = downloadBtn.dataset.download!;
    downloads.set(filename, { filename, downloaded: 0, total: 0, bytes_per_sec: 0 });
    renderModels();
    try {
      await invoke("download_whisper_model", { filename });
    } catch (err) {
      console.error("download_whisper_model failed", err);
      downloads.delete(filename);
      renderModels();
    }
    return;
  }

  const useBtn = target.closest<HTMLButtonElement>("button[data-use]");
  if (useBtn) {
    const path = useBtn.dataset.use!;
    try {
      await invoke("set_active_whisper_model", { path });
      await refreshModelList();
      const s = await invoke<Settings>("get_settings");
      updateModelWarning(s);
      showStatus("Model switched");
    } catch (err) {
      console.error("set_active_whisper_model failed", err);
    }
  }
});

function updateModelWarning(settings: Settings) {
  const banner = modelWarningEl();
  const txt = modelWarningTxt();
  const btn = modelWarningBtn();

  // English-only models can only handle English-* languages and "auto" can
  // technically work but users rarely intend "auto" on an .en model.
  const lang = settings.language;
  const path = settings.whisper_model_path || "";
  const usingEnglishOnlyModel = path.includes(".en.bin");
  const needsMultilingual = lang === "auto" || !isEnglishOnly(lang);

  if (usingEnglishOnlyModel && needsMultilingual) {
    const langName = LANGUAGES.find((l) => l.code === lang)?.name || lang;
    txt.innerHTML = `<strong>${langName}</strong> needs the multilingual model. The current model is English-only.`;

    // Find the same-tier multilingual variant (e.g. base.en.bin → base.bin).
    const currentFilename = path.split("/").pop() || "";
    const multiFilename = currentFilename.replace(/\.en\.bin$/, ".bin");
    const multi = cachedModels.find((m) => m.filename === multiFilename);

    if (multi?.installed) {
      btn.textContent = `Switch to ${multi.label.split(" — ")[0]}`;
      btn.disabled = false;
      btn.onclick = async () => {
        try {
          await invoke("set_active_whisper_model", { path: multi.path });
          await refreshModelList();
          const s = await invoke<Settings>("get_settings");
          updateModelWarning(s);
        } catch (err) {
          console.error(err);
        }
      };
    } else if (multi) {
      btn.textContent = `Download · ${formatBytes(multi.size_bytes)}`;
      btn.disabled = downloads.has(multi.filename);
      btn.onclick = async () => {
        const filename = multi.filename;
        downloads.set(filename, { filename, downloaded: 0, total: 0, bytes_per_sec: 0 });
        renderModels();
        btn.disabled = true;
        try {
          await invoke("download_whisper_model", { filename });
        } catch (err) {
          console.error(err);
          downloads.delete(filename);
          renderModels();
          btn.disabled = false;
        }
      };
    } else {
      btn.textContent = "Open Models";
      btn.disabled = false;
      btn.onclick = () => {
        document.getElementById("models-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
      };
    }

    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }
}

listen<DownloadProgress>("model-download-progress", (e) => {
  downloads.set(e.payload.filename, e.payload);
  renderModels();
});

listen<DownloadDone>("model-download-done", async (e) => {
  downloads.delete(e.payload.filename);
  // If no model is currently active or the user just downloaded the
  // recommended one for their language, switch to it automatically.
  try {
    const s = await invoke<Settings>("get_settings");
    const stillEnglishOnly = s.whisper_model_path.includes(".en.bin");
    const needsMulti = s.language === "auto" || !isEnglishOnly(s.language);
    if (stillEnglishOnly && needsMulti) {
      await invoke("set_active_whisper_model", { path: e.payload.path });
    }
    await refreshModelList();
    const after = await invoke<Settings>("get_settings");
    updateModelWarning(after);
    showStatus("Model installed");
  } catch (err) {
    console.error(err);
    await refreshModelList();
  }
});

listen<DownloadFailed>("model-download-failed", (e) => {
  downloads.delete(e.payload.filename);
  renderModels();
  showStatus(`Download failed: ${e.payload.error}`);
});

listen<unknown>("models-changed", () => refreshModelList());

// ─── Ollama model picker ─────────────────────────────────────────────────────

async function refreshOllamaModels(currentValue: string) {
  const sel = settingsForm.elements.namedItem("ollama_model") as HTMLSelectElement | null;
  const status = document.getElementById("ollama-status") as HTMLElement | null;
  if (!sel || !status) return;

  status.classList.add("hidden");
  status.classList.remove("error");

  try {
    const models = await invoke<OllamaModel[]>("list_ollama_models");

    if (models.length === 0) {
      sel.innerHTML = "";
      sel.disabled = true;
      status.textContent = "Ollama is running but you haven't pulled any models. Run `ollama pull llama3.2` in Terminal.";
      status.classList.remove("hidden");
      // Preserve the previous setting as a sole option so we don't lose it.
      if (currentValue) {
        appendOption(sel, currentValue, currentValue, true);
        sel.value = currentValue;
      }
      return;
    }

    sel.innerHTML = "";
    sel.disabled = false;
    const installed = new Set<string>();
    for (const m of models) {
      installed.add(m.name);
      const label = m.parameter_size
        ? `${m.name}  ·  ${m.parameter_size}`
        : m.name;
      appendOption(sel, m.name, label);
    }

    // If the saved setting is a model that's no longer installed, show it
    // explicitly tagged so the user knows why cleanups are silently failing.
    if (currentValue && !installed.has(currentValue)) {
      appendOption(sel, currentValue, `${currentValue}  ·  not installed`, true);
      status.textContent = `${currentValue} isn't installed locally. Pick another or run \`ollama pull ${currentValue}\`.`;
      status.classList.remove("hidden");
      status.classList.add("error");
    }

    sel.value = currentValue || models[0].name;
  } catch (e) {
    console.error("list_ollama_models failed", e);
    sel.innerHTML = "";
    sel.disabled = true;
    status.textContent = "Ollama isn't running. Start it from Ollama.app or run `ollama serve` in Terminal.";
    status.classList.remove("hidden");
    status.classList.add("error");
    if (currentValue) {
      appendOption(sel, currentValue, currentValue, true);
      sel.value = currentValue;
    }
  }
}

function appendOption(
  sel: HTMLSelectElement,
  value: string,
  label: string,
  italic = false,
) {
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = label;
  if (italic) opt.dataset.fallback = "1";
  sel.appendChild(opt);
}

document.getElementById("refresh-ollama")?.addEventListener("click", async () => {
  const sel = settingsForm.elements.namedItem("ollama_model") as HTMLSelectElement | null;
  const current = sel?.value ?? "";
  await refreshOllamaModels(current);
});

// ─── Keyboard navigation ─────────────────────────────────────────────────────

window.addEventListener("keydown", (e) => {
  // ⌘F always focuses search; Esc inside settings closes the panel.
  if (e.key === "f" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    if (settingsOpen) closeSettings();
    searchEl.focus();
    searchEl.select();
    return;
  }
  if (e.key === "Escape" && settingsOpen) {
    closeSettings();
    return;
  }
  if (settingsOpen) return;

  // While typing in the search box, only Esc has list-meaning (clear focus).
  if (document.activeElement === searchEl) {
    if (e.key === "Escape") {
      if (searchEl.value) {
        searchEl.value = "";
        refresh();
      } else {
        searchEl.blur();
      }
      e.preventDefault();
    }
    return;
  }

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      moveSelection(1);
      break;
    case "ArrowUp":
      e.preventDefault();
      moveSelection(-1);
      break;
    case "Enter": {
      if (selectedIndex < 0) return;
      e.preventDefault();
      const id = dictations[selectedIndex].id;
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
      render();
      break;
    }
    case "j": // Vim-style aliases
      if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); moveSelection(1); }
      break;
    case "k":
      if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); moveSelection(-1); }
      break;
  }
});

// ─── Boilerplate ─────────────────────────────────────────────────────────────

listen<unknown>("history-changed", () => refresh());
// The popover sends this when the user clicks "Settings" in its menu.
listen<unknown>("show-settings", async () => {
  if (!settingsOpen) await openSettings("general");
});

// ─── About pane ──────────────────────────────────────────────────────────────

interface UpdateStatus {
  up_to_date: boolean;
  latest_version: string;
}

async function refreshAboutPane() {
  try {
    const v = await invoke<string>("app_version");
    aboutVersionEl.textContent = `Fluister v${v}`;
  } catch {
    aboutVersionEl.textContent = "Fluister";
  }
}

aboutCheckBtn.addEventListener("click", async () => {
  aboutStatusEl.textContent = "Checking…";
  aboutCheckBtn.disabled = true;
  try {
    const status = await invoke<UpdateStatus>("check_for_updates");
    aboutStatusEl.textContent = status.up_to_date
      ? "Latest version"
      : `Update available: v${status.latest_version}`;
  } catch (err) {
    console.error("check_for_updates failed", err);
    aboutStatusEl.textContent = "Couldn't check";
  } finally {
    aboutCheckBtn.disabled = false;
  }
});

async function bootstrap() {
  // Apply saved theme before painting the list to avoid a system→theme flash.
  try {
    const s = await invoke<Settings>("get_settings");
    selectTheme(s.theme);
  } catch {
    /* no-op — :root color-scheme falls back to system */
  }
  refresh();
}

window.addEventListener("DOMContentLoaded", bootstrap);
window.addEventListener("focus", () => {
  if (!settingsOpen) refresh();
});
