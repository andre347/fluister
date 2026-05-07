# Fluister — Design Brief

A brief for wireframing in Claude Design. Self-contained context: what the app is, how it works, what it should feel like.

---

## What it is

**Fluister** is a tiny, native-feeling macOS menu-bar dictation utility. You hold the **Right Option** key, speak, release — and your transcribed, lightly cleaned-up text is pasted into whatever app is in focus. No browser tab, no cloud round-trip, no sign-in. It lives in the menu bar and otherwise stays out of the way.

The name is Dutch for "whisper" (the open-source speech model that does the heavy lifting).

## Why it exists

The closest thing on macOS today is either:
- **macOS Dictation**, which is OK but has weak punctuation, no context awareness, and no privacy guarantee on the cloud-backed mode.
- **Superwhisper / Wispr Flow / etc.**, which are good but not local-first, often subscription-priced, and feel like Electron apps wearing a macOS costume.

Fluister's wedge: **everything runs on your Mac**. Whisper transcribes locally on Metal. Ollama (a local LLM runner) does cleanup locally. Nothing is uploaded. Nothing requires a login. It's a small, single-binary app that respects the platform it's on.

## Core flow

1. User holds **Right Option** anywhere on macOS.
2. A small recording overlay slides into a corner of the screen (user-configurable position).
3. User speaks.
4. User releases Right Option.
5. Whisper transcribes the audio (Metal-accelerated, runs in the user's chosen Whisper model size).
6. **Optional**: Ollama rewrites the raw transcript to remove fillers, fix punctuation, and apply the active **Profile**'s style.
7. The cleaned text is pasted at the cursor via a synthetic ⌘V.
8. The dictation is saved to local SQLite history.

End-to-end latency target: **under 2 seconds** for a one-sentence dictation on Apple Silicon. There is no network call in the happy path.

## Tech (target stack for implementation)

- **Tauri 2** (Rust + WebView shell)
- **whisper-rs** with Metal feature → on-device transcription
- **Ollama** running locally over HTTP → optional cleanup
- **CGEventTap** for the global Right-Option hotkey
- **enigo** for synthetic ⌘V dispatch
- **rusqlite** for SQLite history + profiles + vocabulary
- **window-vibrancy** for NSVisualEffectMaterial::HudWindow on the popover
- **React 19 + TypeScript**, **Vite 6** multi-page (one entry per window), **Tailwind v4**, **shadcn/ui** (base-ui registry)

See `README.md` in this folder for the full implementation guide.
