import { invoke } from "@tauri-apps/api/core";

interface Dictation {
  id: number;
  created_at: number;
  cleaned_text: string;
  duration_ms: number;
  favorite: boolean;
  raw_text: string;
}

interface Settings {
  theme: "system" | "light" | "dark";
  // ...other fields not needed here
}

interface UpdateStatus {
  up_to_date: boolean;
  latest_version: string;
}

const recentsEl       = document.getElementById("recents") as HTMLElement;
const versionRowEl    = document.getElementById("app-version") as HTMLElement;
const updateStatusEl  = document.getElementById("update-status") as HTMLElement;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

async function loadRecents() {
  try {
    const items = await invoke<Dictation[]>("list_dictations", {
      limit: 7,
      offset: 0,
      favoritesOnly: false,
      search: null,
    });
    if (items.length === 0) {
      recentsEl.innerHTML = `<div class="menu-empty">No dictations yet</div>`;
      return;
    }
    recentsEl.innerHTML = items.map(renderRecent).join("");
  } catch (e) {
    console.error("list_dictations failed", e);
    recentsEl.innerHTML = `<div class="menu-empty">Couldn't load history</div>`;
  }
}

function renderRecent(d: Dictation): string {
  return `
    <button type="button" class="menu-item recent" data-id="${d.id}">
      <span class="text">${escapeHtml(d.cleaned_text)}</span>
      <span class="meta">${formatRelative(d.created_at)}</span>
    </button>
  `;
}

function flash(row: HTMLElement) {
  row.classList.add("flash");
  setTimeout(() => row.classList.remove("flash"), 600);
}

document.addEventListener("click", async (e) => {
  const target = e.target as HTMLElement;

  // Recent dictation row → copy + flash
  const recent = target.closest<HTMLElement>(".menu-item.recent[data-id]");
  if (recent) {
    const id = Number(recent.dataset.id);
    try {
      await invoke("copy_dictation", { id });
      flash(recent);
    } catch (err) {
      console.error("copy_dictation failed", err);
    }
    return;
  }

  // Action menu items
  const action = target.closest<HTMLElement>(".menu-item[data-action]");
  if (action) {
    const which = action.dataset.action;
    try {
      switch (which) {
        case "open-history":
          await invoke("open_history");
          break;
        case "open-settings":
          await invoke("open_settings_from_popover");
          break;
        case "check-updates":
          await checkForUpdates();
          break;
        case "quit":
          await invoke("quit_app");
          break;
      }
    } catch (err) {
      console.error("popover action failed", err);
    }
  }
});

async function checkForUpdates() {
  updateStatusEl.textContent = "Checking…";
  updateStatusEl.classList.add("checking");
  try {
    const status = await invoke<UpdateStatus>("check_for_updates");
    updateStatusEl.classList.remove("checking");
    updateStatusEl.textContent = status.up_to_date
      ? "Latest version"
      : `Update available: v${status.latest_version}`;
  } catch (err) {
    console.error("check_for_updates failed", err);
    updateStatusEl.classList.remove("checking");
    updateStatusEl.textContent = "Couldn't check";
  }
}

async function loadAppVersion() {
  try {
    const v = await invoke<string>("app_version");
    versionRowEl.textContent = `Fluister v${v}`;
  } catch {
    versionRowEl.textContent = "Fluister";
  }
}

async function applyThemeFromSettings() {
  try {
    const s = await invoke<Settings>("get_settings");
    if (s.theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", s.theme);
    }
  } catch {
    /* fall back to system */
  }
}

function refreshAll() {
  loadRecents();
  applyThemeFromSettings();
}

// Refresh content every time the popover gains focus (i.e. is shown).
window.addEventListener("focus", refreshAll);

// First paint
window.addEventListener("DOMContentLoaded", () => {
  loadAppVersion();
  refreshAll();
});

// Esc closes the popover (in addition to focus-loss).
window.addEventListener("keydown", async (e) => {
  if (e.key === "Escape") {
    try {
      await invoke("close_popover");
    } catch {
      /* no-op */
    }
  }
});
