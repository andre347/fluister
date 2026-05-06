# Local Whisper

Hotkey-driven voice → text overlay for macOS. Press the global shortcut, talk,
press it again. Audio is transcribed locally with Whisper, polished by a small
local Ollama model (filler-word removal, punctuation), and pasted into the
focused text field.

Everything runs offline. Nothing leaves the machine.

## Hotkey

`⌘ + ⇧ + Space` toggles recording. Press once to start, press again to stop —
the cleaned text is pasted into whatever app you were in.

## Requirements

- macOS 11+
- [Ollama](https://ollama.com) running locally (`ollama serve`)
- A small instruct model pulled, e.g. `ollama pull llama3.2` (default)
- A Whisper ggml model file on disk (default path:
  `~/Library/Application Support/local-whisper/models/ggml-base.en.bin`)
- Build deps: Rust (stable), Node 20+, `pnpm`, `cmake` (for `whisper-rs`)

## Whisper model

Grab a ggml model from the [whisper.cpp releases](https://huggingface.co/ggerganov/whisper.cpp/tree/main):

```sh
mkdir -p "$HOME/Library/Application Support/local-whisper/models"
curl -L -o "$HOME/Library/Application Support/local-whisper/models/ggml-base.en.bin" \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
```

Override the path with `LOCAL_WHISPER_MODEL=/path/to/model.bin`.

## Ollama model

Default is `llama3.2:latest`. Override with `LOCAL_WHISPER_OLLAMA_MODEL=...`.
Smaller is fine; the cleanup task is light.

## Permissions (first run)

macOS will prompt for:

- **Microphone** — required to capture audio
- **Accessibility** — required to synthesize the `⌘V` paste keystroke

Grant both in *System Settings → Privacy & Security*.

## Develop

```sh
pnpm install
pnpm tauri dev
```

The window starts hidden and only shows during a recording cycle. The app
itself is a menu-bar agent (no Dock icon, `LSUIElement = true`).

## Build

```sh
pnpm tauri build
```

Produces `src-tauri/target/release/bundle/macos/Local Whisper.app`.
