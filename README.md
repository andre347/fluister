# Fluister

A tiny macOS menu-bar dictation app. Hold Right Option, talk, release. The text appears wherever your cursor is.

Everything runs on your Mac. No network calls, no telemetry, no cloud transcription.

Website: [fluister-web.vercel.app](https://fluister-web.vercel.app)

## Requirements

- macOS 11 or later
- Apple Silicon (M1/M2/M3/M4). Intel Macs are not supported.
- Microphone and Accessibility permission (Fluister prompts for both on first run).

## Install

Download the latest DMG from [Releases](https://github.com/andre347/fluister/releases/latest), drag Fluister into Applications, launch it.

Fluister lives in the menu bar with no Dock icon. The onboarding window walks you through granting permissions, picking a speech model, and choosing a language.

## How it works

The pipeline runs entirely on-device:

1. You hold Right Option. Audio capture starts.
2. You release. Whisper transcribes the recording locally using Metal.
3. A small local language model cleans up filler words and punctuation.
4. The result is pasted at your cursor.

The cleanup model runs in a bundled `llama-server` sidecar by default. You can also point it at a separately installed [Ollama](https://ollama.com) daemon from Settings.

## Settings

Open Settings from the gear icon in the History window, or press ⌘,.

- **General**: theme, overlay position.
- **Recording**: spoken language, silence auto-stop.
- **Cleanup**: enable or disable cleanup, pick the backend and model.
- **Hotkeys**: shows the current hotkey. Rebinding is on the roadmap.
- **Models**: download or switch Whisper models. Smaller models are faster, larger ones are more accurate.
- **Storage**: optional vault folder that stores your profiles and vocabulary as plain Markdown files. Sync via iCloud, Dropbox, or Git.
- **About**: version, check for updates, re-run onboarding.

## Profiles and vocabulary

Profiles let you swap cleanup styles per app (a tight Slack tone vs. a fuller email tone, for example). Vocabulary entries give Whisper hints for names, jargon, or branded terms it would otherwise mis-hear.

Both are stored as Markdown if you set up a vault, otherwise in a local SQLite cache.

## Updates

Fluister checks for updates on launch and shows a small banner if a new version is available. You can also check manually from Settings, About. Updates are signed and installed in place.

## Build from source

```sh
pnpm install
pnpm tauri dev
```

To produce a `.dmg`:

```sh
pnpm tauri build
```

The bundle ends up in `src-tauri/target/release/bundle/`.

See [RELEASING.md](./RELEASING.md) for the signing and tagged-release workflow.

## Architecture

Tauri 2 app. Rust backend, React + Tailwind v4 frontend. Three windows:

- `overlay`: floating recording pill, hidden until you hold the hotkey.
- `history`: main window. Past dictations, profiles, vocabulary, settings.
- `onboarding`: first-run setup wizard.

Rust modules of note: `audio` (cpal capture), `transcribe` (whisper-rs with Metal), `llama_server` (bundled cleanup sidecar), `ollama` (optional external backend), `hotkey` (CGEventTap on Right Option), `paste` (clipboard plus synthesised ⌘V), `vault` (Markdown profiles and vocabulary).

## License

MIT.
