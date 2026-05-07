# Fluister

A native macOS menu-bar dictation utility. Hold the **Right Option** key, talk,
release. Whisper transcribes locally, a local Ollama model cleans up filler
words and punctuation, the result is pasted into whatever app was frontmost.
Everything runs on-device — no network calls except optionally pulling models
from Hugging Face.

Inspired by Wispr Flow, Granola, and the macOS native menu-bar agent style
(Linear, Raycast, Bartender).

`LSUIElement = true` — Fluister is a menu-bar agent, no Dock icon. macOS-only.

---

## Architecture

**Tauri 2** desktop app (Rust backend + Webview frontend). TypeScript + HTML +
Tailwind CSS v4 for the UI.

```
┌────────────────────────────────────────────────────────────┐
│  Rust (src-tauri/src/)                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │  hotkey  │→ │  audio   │→ │transcribe│→ │  ollama    │  │
│  │CGEventTap│  │  cpal    │  │whisper-rs│  │ /api/chat  │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│       ↓                                          ↓         │
│  ┌──────────┐                              ┌────────────┐  │
│  │frontmost │                              │   paste    │  │
│  │NSWorkspace                              │  enigo +   │  │
│  └──────────┘                              │ ⌘V dispatch│  │
│                                             └────────────┘ │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │       db         │  │ model_download   │                │
│  │ SQLite history + │  │  HF stream + UI  │                │
│  │     settings     │  │    progress      │                │
│  └──────────────────┘  └──────────────────┘                │
│  ┌──────────────────┐                                      │
│  │  permissions     │  AXIsProcessTrusted, AVCaptureDevice │
│  └──────────────────┘                                      │
└────────────────────────────────────────────────────────────┘
            ↕  Tauri commands + emit/listen events
┌────────────────────────────────────────────────────────────┐
│  Frontend (4 windows, each its own HTML page + TS module)  │
│   • overlay    — floating wave bars while recording        │
│   • popover    — menu-bar dropdown (recents + actions)     │
│   • history    — main window, list view + sidebar Settings │
│   • onboarding — first-launch setup checklist              │
└────────────────────────────────────────────────────────────┘
```

---

## Pipeline (one dictation)

1. **Press Right Option** — `hotkey.rs` is a CGEventTap watching for the
   `kVK_RightOption` keycode (`NX_DEVICERALTKEYMASK` in flags). Custom because
   Carbon's `RegisterEventHotKey` (used by `tauri-plugin-global-shortcut`)
   doesn't support modifier-only chords.
2. **Capture** — `audio.rs` runs cpal on a dedicated thread (`Stream` is
   `!Send` on macOS), records 16 kHz mono `f32`, exposes a peak-amplitude level
   for the wave-bar visualisation.
3. **VAD auto-stop** *(optional)* — level emitter checks for silence and
   auto-fires release after a configurable number of milliseconds.
4. **Release Right Option** → `transcribe.rs`: `whisper-rs` w/ Metal feature,
   model loaded from `~/Library/Application Support/fluister/models/ggml-*.bin`.
   `set_language()` is pinned to the user's choice; `initial_prompt` carries
   custom vocabulary + locale-spelling hints.
5. **Cleanup** — `ollama.rs` POSTs to `http://127.0.0.1:11434/api/chat` (the
   chat API, not generate — chat is dramatically less prone to echoing
   few-shot examples). System message pins the model into "text editor for
   {language}, never translate, never answer questions in the dictation". Stop
   sequences `<dictation>`, `</dictation>`. Defensive `strip_label_prefix()`
   removes any `Cleaned:` / `Output:` etc. that small models occasionally leak.
6. **Paste** — `paste.rs` writes the clipboard via
   `tauri-plugin-clipboard-manager`, hops to the Tauri main thread (enigo's
   `TSMGetInputSourceProperty` asserts main-queue dispatch on macOS 26 — this
   was a real crash), then synthesises ⌘V.
7. **Save + emit** — pipeline inserts a row into SQLite, emits
   `history-changed` for the history window to refresh.

---

## Project layout

```
fluister/
├── package.json          pnpm + Vite multi-page setup
├── vite.config.ts        4 entry points (main/history/popover/onboarding)
├── index.html            ← overlay (the floating bars)
├── history.html          ← main window
├── popover.html          ← tray dropdown
├── onboarding.html       ← first-launch wizard
├── src/
│   ├── main.ts           overlay logic (RAF loop, wave bars)
│   ├── styles.css        overlay-only CSS, no Tailwind
│   ├── history.ts        history list + sidebar Settings
│   ├── history.css       Tailwind v4 + theme tokens
│   ├── popover.ts        recents + nav actions
│   ├── popover.css
│   ├── onboarding.ts     status checklist + polling
│   ├── onboarding.css
│   └── languages.ts      shared 32-language catalog + helpers
└── src-tauri/
    ├── Cargo.toml              package = "fluister", lib = "fluister_lib"
    ├── tauri.conf.json         identifier = com.fluister.app, 4 windows
    ├── Info.plist              NSMicrophoneUsageDescription etc.
    ├── Entitlements.plist      hardened-runtime entitlements
    ├── build.rs
    ├── icons/                  generated from icons-source/, includes .icns
    ├── icons-source/           SVG sources (tray-icon.svg, app-icon.svg)
    ├── capabilities/default.json   permissions per window
    └── src/
        ├── main.rs             fluister_lib::run()
        ├── lib.rs              Tauri builder, all commands, tray, pipeline
        ├── audio.rs            cpal recording on dedicated thread
        ├── transcribe.rs       whisper-rs wrapper, Metal acceleration
        ├── ollama.rs           /api/chat cleanup + /api/tags + prompts
        ├── paste.rs            clipboard + main-thread ⌘V keystroke
        ├── hotkey.rs           CGEventTap on FlagsChanged for Right Option
        ├── frontmost.rs        NSWorkspace frontmost capture + activate
        ├── db.rs               SQLite (rusqlite bundled): dictations + settings
        ├── model_download.rs   HF stream download with progress events
        └── permissions.rs      AXIsProcessTrusted + AVCaptureDevice status
```

---

## Tauri windows

| Label         | URL              | Purpose |
|---------------|------------------|---------|
| `overlay`     | `index.html`     | Floating 108×40 borderless transparent capsule, always-on-top, hidden by default. Shows during recording → transcribing → cleaning → pasting → idle. Wave bars driven by RAF loop. |
| `history`     | `history.html`   | Main window, 580×640, `titleBarStyle: "Overlay"`. Two modes: (1) list view with search/favorites/expand-on-click; (2) settings mode with a 180px sidebar nav + content pane. Modes toggled by gear icon or Esc. |
| `popover`     | `popover.html`   | Menu-bar dropdown, 380×500, frosted glass, anchored under the tray icon via `TrayIconEvent::Click.rect`. Auto-hides on `WindowEvent::Focused(false)`. |
| `onboarding`  | `onboarding.html`| First-launch setup, 520×620. Checklist of mic / accessibility / language / Whisper model / Ollama. Auto-polls status every 1.5s. Only shown when `settings.onboarding_complete == false`. |

---

## Settings (SQLite-backed)

```rust
struct Settings {
    ollama_model: String,           // e.g. "llama3.2:latest"
    whisper_model_path: String,     // active model file
    vocabulary: String,             // free-text, fed to Whisper initial_prompt
    cleanup_enabled: bool,          // skip Ollama → raw transcripts
    vad_silence_ms: i64,            // 0 = disabled
    overlay_position: String,       // top-left|top-center|top-right|bottom-*
    theme: String,                  // system|light|dark
    language: String,               // ISO/region code, e.g. "en-US", "es-LA", "auto"
    onboarding_complete: bool,
}
```

Stored as a JSON blob in `settings(key='config')`. Dictations stored in
`dictations(id, created_at, raw_text, cleaned_text, duration_ms, favorite)`.

Data dir: `~/Library/Application Support/fluister/` (auto-migrated from
`local-whisper/` on first launch — bundle was renamed).

---

## Tauri commands (Rust → frontend)

| Command | Used by | Notes |
|---------|---------|-------|
| `list_dictations` | history, popover | Filtered by search/favorites_only |
| `toggle_favorite` | history | |
| `delete_dictation` | history | |
| `copy_dictation` | history, popover | Writes `cleaned_text` to clipboard |
| `paste_dictation` | history | Hides history → activates `last_external_app` via `NSRunningApplication` → synthesises ⌘V |
| `get_settings` / `update_settings` | all UIs | JSON blob round-trip |
| `list_whisper_models` | history, onboarding | Catalog × disk presence × active flag |
| `download_whisper_model` | history, onboarding | Streams from HF, emits `model-download-progress` |
| `set_active_whisper_model` | history, onboarding | Updates settings, invalidates cached `WhisperContext` |
| `list_ollama_models` | history | `GET /api/tags`, 3s timeout |
| `app_version` | popover, history | Reads `package_info().version` |
| `check_for_updates` | popover, history | Stub — returns `{up_to_date: true}`. Wire to JSON manifest later. |
| `open_history` / `open_settings_from_popover` | popover | History show + optional `show-settings` event |
| `quit_app` | popover | `app.exit(0)` |
| `close_popover` | popover | |
| `onboarding_status` | onboarding | Aggregate mic/access/whisper/ollama state |
| `request_microphone_access` | onboarding | Brief cpal stream open → triggers macOS prompt |
| `open_privacy_panel` | onboarding | `open x-apple.systempreferences:...?Privacy_*` |
| `open_external_url` | onboarding | Used for the ollama.com link |
| `finish_onboarding` | onboarding | Sets `onboarding_complete = true`, hides window |

Events emitted by Rust → all windows: `status` (overlay state), `level` (mic
peak amplitude), `history-changed`, `model-download-progress`,
`model-download-done`, `show-settings`.

---

## Brand & visual identity

- **Name**: Fluister (Dutch for "whisper") — was "Local Whisper" until renamed
  end-to-end (Cargo package, bundle ID `com.fluister.app`, productName, all
  display strings, env vars `FLUISTER_MODEL` / `FLUISTER_OLLAMA_MODEL`, data
  dir).
- **Color**: Warm amber-honey. Brand token is
  `--color-accent: light-dark(#E8A961, #F2B570)`. Replaces the system-blue
  accent throughout.
- **Icon**: Charcoal squircle (gradient `#2c2c2e → #1c1c1e`) with 5 amber
  waveform bars (gradient `#FFCB85 → #E8A961`). Same 5-bar shape mirrors the
  dictation overlay so all surfaces (icon, tray, recording overlay) read as
  one product. Tray icon stays monochrome black on transparent — marked as a
  template image so macOS auto-tints for light/dark menu bars.
- **Typography**: SF Pro Display/Text. Custom Tailwind `@theme` scale —
  `--text-display: 22px`, `--text-body: 13px`, `--text-caption: 12px`,
  `--text-footnote: 11px`, `--text-tag: 10.5px`.
- **Theming**: `light-dark()` CSS function on every colour token.
  `:root { color-scheme: light dark }` follows system, `[data-theme="light|dark"]`
  overrides. User-selectable in Settings → General → Theme.
- **Recording state**: overlay wave bars switch from white to amber `#F2B570`
  with a soft glow when capture is live.

Icon SVG sources are at `src-tauri/icons-source/`. Regenerate with:

```sh
rsvg-convert -w 44   -h 44   src-tauri/icons-source/tray-icon.svg -o src-tauri/icons/tray-icon.png
rsvg-convert -w 1024 -h 1024 src-tauri/icons-source/app-icon.svg  -o src-tauri/icons/app-icon.png
pnpm tauri icon src-tauri/icons/app-icon.png
```

(`brew install librsvg` for `rsvg-convert`.)

---

## Prerequisites for end-users

1. **macOS 11+** (built and tested on macOS 26 / arm64; building universal
   requires `rustup target add x86_64-apple-darwin`).
2. **Microphone permission** — auto-requested on first recording.
3. **Accessibility permission** — required for the global hotkey (CGEventTap)
   and the synthesised ⌘V paste. Granted manually in *System Settings →
   Privacy & Security → Accessibility*.
4. **Ollama** running locally (`brew install ollama && ollama serve`) with at
   least one model pulled (`ollama pull llama3.2`). Optional — can be skipped
   via "use raw transcripts" in onboarding.
5. **A Whisper model** at `~/Library/Application Support/fluister/models/ggml-*.bin`.
   Onboarding downloads this automatically (defaults to `ggml-base.en.bin` for
   English language picks, `ggml-base.bin` multilingual otherwise — both
   ~142 MB).

The onboarding window walks the user through (3) – (5) on first launch.

---

## Develop

```sh
pnpm install
pnpm tauri dev
```

The overlay window starts hidden and only shows during a recording cycle.

## Build

```sh
pnpm tauri build
```

Produces `.app` and `.dmg` in `src-tauri/target/release/bundle/`. Currently
unsigned — colleagues need to right-click → Open or
`xattr -dr com.apple.quarantine` after install. Apple Developer ID would solve
this.

---

## Key dependencies

```toml
[dependencies]
tauri = { version = "2", features = ["macos-private-api", "tray-icon", "image-png"] }
tauri-plugin-clipboard-manager = "2"
serde, serde_json, tokio (rt-multi-thread, sync, time, fs, io-util)
parking_lot, anyhow, thiserror
cpal = "0.15", hound = "3.5"
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
enigo = "0.3"
rusqlite = { version = "0.32", features = ["bundled"] }
log, env_logger, dirs

[target.'cfg(target_os = "macos")'.dependencies]
whisper-rs = { version = "0.13", features = ["metal"] }   # builds whisper.cpp via cmake
core-graphics = "0.24"   # CGEventTap for the hotkey
core-foundation = "0.10" # CFRunLoop bridging
objc2 = "0.5"            # NSWorkspace, NSRunningApplication, AVCaptureDevice msg_send
```

Frontend: `tailwindcss@4`, `@tailwindcss/vite`, `@tauri-apps/api`,
`@tauri-apps/plugin-clipboard-manager`. Vite v6.

---

## Known sharp edges / next-up ideas

- **Code signing**: app is unsigned. First-time install requires Gatekeeper
  bypass. Apple Developer ID + notarisation = clean install for everyone.
- **Auto-updates**: `check_for_updates` is a stub. Wire to a JSON manifest (or
  `tauri-plugin-updater`).
- **Universal binary**: currently builds for the host arch only.
  `pnpm tauri build --target universal-apple-darwin` after
  `rustup target add x86_64-apple-darwin`.
- **Real re-paste from the popover**: clicking a recent in the popover
  currently copies. The "paste into previous app" plumbing (used from history)
  could be wired to popover rows too.
- **Keyboard nav in history**: ↑↓/Enter work. ⌘C, Backspace-to-delete, ⌘F
  focus search are wired. Could add ⌘N or similar for new dictation trigger.
- **Sound cues**: subtle blip on record-start / paste-done would feel more
  polished. ~20 min job.
- **Domain**: `fluister.io` and `fluisterly.com` are available;
  `fluister.com` is parked at NameBright (squatter, would need to negotiate).
- **React refactor** *(in progress on `react-refactor`)*: migrating the four
  vanilla-TS UI windows to React + shadcn/ui + Tailwind v4 while keeping
  Tauri, the Rust backend, and the multi-window Vite setup unchanged.
