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
- **Cleanup**: enable or disable cleanup, set the cleanup level (Light / Standard / Aggressive), pick the backend and model.
- **Hotkeys**: shows the current hotkey. Rebinding is on the roadmap.
- **Models**: download or switch Whisper models. Smaller models are faster, larger ones are more accurate.
- **Storage**: optional vault folder that stores your profiles and vocabulary as plain Markdown files. Sync via iCloud, Dropbox, or Git.
- **About**: version, check for updates, re-run onboarding.

## Profiles and vocabulary

Profiles let you swap cleanup *styles* per app (a tight Slack tone vs. a fuller email tone, for example). The **cleanup level** (Light / Standard / Aggressive) is a separate, global knob for *how much* cleanup rewrites — independent of the profile's tone. Vocabulary entries give Whisper hints for names, jargon, or branded terms it would otherwise mis-hear.

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

## Local development on macOS

Two macOS quirks make the **dev** build (`pnpm tauri dev`) fussier than the shipped `.app`. Neither affects end users.

### Permissions don't stick across rebuilds (and the global hotkey needs Input Monitoring)

The dev binary needs three TCC grants: **Microphone**, **Accessibility** (synthetic ⌘V), and **Input Monitoring** (the Right-Option global hotkey — without it the hotkey only fires while Fluister is focused). macOS keys each grant to the binary's *code signature*, and the dev binary is **ad-hoc signed by default**, so its identity changes on every recompile and the grants are silently dropped.

To make grants persist, the repo signs the dev binary with a stable, local **self-signed** identity (no Apple Developer account needed). `tauri.conf.json` sets `build.runner` to [`src-tauri/sign-dev.sh`](./src-tauri/sign-dev.sh), which re-signs `target/debug/fluister` after each build with an identity named `Fluister Dev`. If that identity isn't present, codesign fails harmlessly and the build proceeds ad-hoc (so CI / fresh clones still work).

Create the identity once:

```sh
# Generate a self-signed code-signing cert and import it into the login keychain.
WORK=$(mktemp -d) && cd "$WORK"
cat > cert.conf <<'EOF'
[ req ]
distinguished_name = dn
x509_extensions = v3
prompt = no
[ dn ]
CN = Fluister Dev
[ v3 ]
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
basicConstraints = critical, CA:false
EOF
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 3650 -nodes -config cert.conf
openssl pkcs12 -export -legacy -inkey key.pem -in cert.pem -out fluister.p12 -passout pass:fluister -name "Fluister Dev"
security import fluister.p12 -k ~/Library/Keychains/login.keychain-db -P fluister -T /usr/bin/codesign
```

The **first** build after this pops a keychain dialog ("codesign wants to use key Fluister Dev") — click **Always Allow** so future builds sign unattended. Then grant the three permissions once in System Settings → Privacy & Security, pointing at `src-tauri/target/debug/fluister`. They'll now survive rebuilds.

> Note: `--legacy` on the `pkcs12` export is required — OpenSSL 3's default MAC algorithm isn't readable by macOS's keychain importer.

### Input Monitoring is granted to the *launcher*, not the binary

macOS attributes the hotkey's Input Monitoring check to the **responsible process** — the app that owns the process tree, not `fluister` itself. When you run `pnpm tauri dev` from a terminal embedded in an editor (e.g. VS Code, iTerm, or another IDE), that **launcher app** is what needs Input Monitoring enabled, even though the list also shows `fluister`. If the hotkey doesn't fire despite `fluister` being toggled on, enable your terminal/editor in the Input Monitoring list and relaunch. (Microphone and Accessibility check the immediate process, so only Input Monitoring hits this.) The shipped `.app`, launched from Finder, is its own responsible process and needs no such workaround.

Input Monitoring also only takes effect on a **fresh launch** — toggling it while the app runs does nothing until you quit and restart.

## Architecture

Tauri 2 app. Rust backend, React + Tailwind v4 frontend. Three windows:

- `overlay`: floating recording pill, hidden until you hold the hotkey.
- `history`: main window. Past dictations, profiles, vocabulary, settings.
- `onboarding`: first-run setup wizard.

Rust modules of note: `audio` (cpal capture), `transcribe` (whisper-rs with Metal), `llama_server` (bundled cleanup sidecar), `ollama` (optional external backend), `hotkey` (CGEventTap on Right Option), `paste` (clipboard plus synthesised ⌘V), `vault` (Markdown profiles and vocabulary).

## License

MIT.
