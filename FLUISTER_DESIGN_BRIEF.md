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
6. **Optional**: Ollama rewrites the raw transcript to remove fillers, fix punctuation, and apply the active **Profile**'s style (e.g., "Slack reply: brief and casual" vs. "Email: formal").
7. The cleaned text is pasted at the cursor via a synthetic ⌘V.
8. The dictation is saved to local SQLite history so the user can re-paste, favorite, or delete it later.

End-to-end latency target: **under 2 seconds** for a one-sentence dictation on Apple Silicon. The whole loop is local — there is no network call in the happy path.

## Local-first as a design principle

This isn't just an architectural choice; it shapes the UI:

- **No "sign in" screen**. The first run is an Onboarding window that walks the user through (1) granting accessibility/microphone permissions, (2) downloading a Whisper model, (3) optionally setting up Ollama. That's it.
- **No telemetry, no account, no settings sync**. All state is in `~/Library/Application Support/Fluister/` (a SQLite database + downloaded models).
- **Models are visible artifacts**. The Settings → Models tab shows installed sizes (Tiny/Base/Small/Medium/Large), download progress, and which one is active. Users *feel* that the model lives on their machine.
- **Offline is the normal state**, not a degraded one. The only network calls are: optional update check, optional Whisper model downloads, and Ollama ping (and Ollama itself is local).

## Surfaces (windows)

Fluister is a multi-window app. Each window has one job:

### 1. Menu-bar tray icon
Small monochrome waveform icon in the macOS menu bar. Click → opens the **Popover**.

### 2. Popover (menu-bar dropdown)
A small floating panel anchored to the tray icon. NSVisualEffectView vibrancy backdrop (real frosted glass, not a CSS approximation). Contents:
- Active **Profile** indicator (e.g., "Email" / "Slack" / "Notes" / "Code"). Tap to switch — slides into a profile list, then slides back.
- Quick toggles: AI cleanup on/off, mute mic.
- "Open History…" → opens the History window.
- "Settings…" → opens the History window on the Settings section.
- "Quit Fluister".

Roughly 280×360 pt. Feels like the Wi-Fi or Battery menu — terse, native, keyboard-navigable.

### 3. Recording overlay
A small pill that appears in a screen corner while Right Option is held. Shows a live audio waveform. Disappears the moment you release the key. **No window chrome, no traffic lights** — it's an HUD.

### 4. History window (the main app surface)
A standard macOS window with traffic lights, ⌘W to close, draggable title bar, etc. This is where richer interaction lives. Layout:

```
┌─────────────────────────────────────────────────────┐
│ ● ● ●                                               │  ← traffic lights, drag region
├──────────┬──────────────────────────────────────────┤
│          │ History                          [search]│
│ History  │ ───────────────────────────────────      │
│ Profiles │ Today                                    │
│ Vocab    │  • "Hey Sam, can we move the…"   ★ ⌘C ⋯ │
│ Settings │  • "TODO: refactor the cleanup…"    ⋯   │
│          │ Yesterday                                │
│  ───     │  • …                                     │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

Outer left sidebar with four sections:
- **History** — chronological dictations grouped by day. Search, favorite, copy, paste-into-frontmost, delete. Click to expand long entries.
- **Profiles** — the cleanup-style presets. Each profile has a name, description, system prompt that biases Ollama, and a vocabulary seed list. Default profiles ship: Default, Email, Slack, Notes, Code. Users can add/edit/delete.
- **Vocabulary** — global term + alias entries. Example: term `TypeScript`, aliases `type script, typescript`. Two effects: (1) the term is biased into Whisper's `initial_prompt`, (2) aliases are case-insensitively replaced with the canonical term in the cleaned output.
- **Settings** — sub-tabs: **General** (theme, overlay position, silence-auto-stop), **Recording** (spoken language, model mismatch warnings), **Models** (Whisper sizes + Ollama picker + AI cleanup toggle), **About** (version, update check, attribution).

The sidebar is collapsible (⌘B) to an icon-only rail.

### 5. Onboarding window
First-run only. A single-window stepper that walks through permissions, model download, and Ollama setup. After it's dismissed, it's reachable again from Settings → "Re-run onboarding" (so it has to be standalone, not just disposable).

## Mental model

Two user-facing concepts beyond "dictation":

**Profile** — *how* the dictation is cleaned up. Active at any given time. Switchable in two clicks from the popover. Examples:
- *Default*: minimal cleanup, just punctuation.
- *Email*: complete sentences, neutral-formal tone.
- *Slack*: brief, casual, lowercase, no greetings.
- *Notes*: bullet points, terse.
- *Code*: preserves technical terms, no auto-capitalization of identifiers.

Each profile has an editable `style_prompt` that gets injected into Ollama's system message, plus a profile-scoped vocabulary list.

**Vocabulary** — *what* unusual words to expect. Improves Whisper accuracy on names and jargon. Aliases let users repair Whisper's homophones ("type script" → `TypeScript`).

These two together let users tune dictation to their actual life without writing prompts every time.

## Native macOS feel

This is the design north star. The app should be indistinguishable in feel from a small Apple-built utility. Concretely:

### Window chrome
- Real macOS traffic lights. Draggable title bar (with `data-tauri-drag-region`). No custom-painted window chrome.
- Popover uses **NSVisualEffectView** vibrancy (HudWindow material). True frosted glass, not `backdrop-filter: blur()`.
- History window uses a sidebar layout. Sidebar carves out a 28pt strip at top so traffic lights have breathing room (Apple's convention).

### Typography
- **SF Pro Text** for UI text, **SF Mono** for code/keyboard chords/timestamps. Fall back to `system-ui`.
- Type scale follows Apple HIG: title 17pt, body 13pt, footnote 11pt, tag 10pt. Avoid invented sizes.

### Color
- Brand accent: warm amber **`#E8A961`** (light) / **`#F2B570`** (dark). Used for active states, primary buttons, focus rings.
- Surfaces use `light-dark()` adaptive values. The app respects the system theme by default (System / Light / Dark toggle in Settings).
- Backgrounds layer like macOS: canvas → surface → elevated. Use translucent black/white overlays for elevation, not different gray hex values.
- One accent color. Yellow is reserved for "favorite". Red is destructive only.

### Controls
- Segmented controls for small enumerations (System/Light/Dark, Profile picker tabs).
- Native-feeling toggles for booleans.
- Native `<select>` is fine and *preferred* for long lists like languages — don't force a custom dropdown if the platform one is better.
- Buttons are quiet by default. Primary action gets the accent fill, everything else is ghost or secondary. No multi-color CTAs.
- Cards are the unit of grouping in Settings. Each Card has a title + description + control(s). No nested cards.

### Motion
- Sparing. Match macOS: 180–220ms ease-out on most transitions, 120ms on hover.
- The recording overlay slides in/out. The popover does not animate (matches Apple's menu-bar popovers).
- No bounce, no wiggle, no parallax.

### Sound
- None. The app is silent by design — dictation is often used in shared spaces.

## Visual identity

- **Tone**: quiet, confident, slightly warm. The amber accent is intentional — most dictation apps lean cold blue/teal; the warmth signals that this is a personal, local-first tool.
- **Shape language**: 8–12pt corner radius, rounded but not pill-shaped. Apple's standard.
- **Spacing**: 4pt grid. 14pt and 16pt are the most-used vertical gaps.
- **Empty states**: a single line of muted text. No illustrations. "No dictations yet" is enough.

## Don't-do list

- ❌ No splash screen.
- ❌ No marketing landing inside the app.
- ❌ No "Pro" upsell, no plans, no usage limits.
- ❌ No dashboard with stats or charts. Users want their text, not metrics about themselves.
- ❌ No nested modals, no toast spam, no confetti.
- ❌ No Electron-style beveled buttons or gradient hero sections.
- ❌ No accent-color soup. One amber, one yellow (favorites only), one red (destructive only).
- ❌ No custom window chrome that fights the OS.
- ❌ No telemetry banners ("we collect anonymous usage data") — there's nothing to disclose because nothing is collected.

## Tech (for context, not for design)

- **Tauri 2** (Rust + WebView shell), so the app is a real macOS bundle, signs cleanly, and weighs ~30 MB.
- **whisper-rs** with Metal feature → on-device transcription on Apple Silicon GPU.
- **Ollama** running locally over HTTP → optional cleanup with a model the user already has (e.g., `llama3.2`).
- **CGEventTap** for the global Right-Option hotkey (no Accessibility prompt needed for the modifier-only hold).
- **enigo** dispatches the synthetic ⌘V on the main thread (UI thread requirement for input events).
- **rusqlite** for the SQLite history + profiles + vocabulary database, with `PRAGMA user_version` migrations.
- **window-vibrancy** crate for NSVisualEffectMaterial::HudWindow on the popover.
- **React 19 + TypeScript** for the UI, **Vite 6** multi-page (one entry per window), **Tailwind v4**, **shadcn/ui** (base-ui registry).

The Rust pipeline (audio capture → Whisper → Ollama → paste) is the core; the React UI is a thin shell around it.

## Designing for this app

When wireframing:
- Start from the **History window** — it's the densest surface and sets the visual language.
- The **Popover** should look like it could ship in macOS itself.
- Treat the **Recording overlay** as an HUD, not a window. No chrome.
- **Onboarding** is the only place you can be slightly more spacious / pedagogical.
- Everything should look correct in **both light and dark mode**, side by side.
- If a control looks "designed" — i.e., distinctive, branded, custom — it's probably wrong for this app. Lean toward "standard, slightly warm, clearly Mac."
