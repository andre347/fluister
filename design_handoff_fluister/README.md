# Handoff: Fluister → Tauri Implementation

## Overview

Fluister is a macOS menu-bar dictation utility (Right-Option hold → speak → release → paste). This handoff documents the **chosen designs** for each surface, with implementation guidance for the existing tech stack.

## ⚠️ About the Files in This Bundle

The HTML/JSX files here are **design references**, not production code.

- They use a sketchy, hand-drawn aesthetic on purpose — to communicate that these are wireframes, not finished UI.
- They show **structure, layout, component placement, content, and behavior**, not final visual styling.
- The Tauri app should follow the **native macOS look-and-feel described in the design brief** (SF Pro, NSVisualEffectView vibrancy, real traffic lights, amber accent `#E8A961`) — *not* the sketchy fonts.

**The job:** recreate the *layouts and behavior* of the chosen variants in **Tauri 2 + React 19 + TypeScript + Vite 6 (multi-page) + Tailwind v4 + shadcn/ui (base-ui registry)**, applying the native macOS visual language from the brief.

## Fidelity

Mid-fi wireframes. Layout, content priority, and interaction shape are decided. Final typography, color, vibrancy, and motion come from the brief / native macOS conventions.

---

## Chosen Variants

| Surface | Choice | Source file |
|---|---|---|
| History window | **B — Three-pane (sidebar + list + detail)** | `wireframes-history.jsx` → `HistoryB` |
| Popover | **B — Last-dictation surfaced** | `wireframes-popover.jsx` → `PopoverB` |
| Recording overlay | **A — Pill (bottom-right default), user-configurable position** | `wireframes-overlay.jsx` → `OverlayA` |
| Onboarding | **A — Multi-step stepper** | `wireframes-onboarding.jsx` → `OnbA` |
| Tray icon | **Simple Fluister logo only** (no per-state variants in v1) | — |

---

## Tech Stack Mapping

| Concern | Tool | Notes |
|---|---|---|
| Window shells | Tauri 2 windows (one per surface) | One Vite entry per window: `popover.html`, `history.html`, `overlay.html`, `onboarding.html` |
| UI framework | React 19 + TypeScript | |
| Styling | Tailwind v4 | `@theme` tokens below |
| Components | shadcn/ui (base-ui registry) | `Button`, `Tabs`, `Switch`, `Input`, `Separator`, `ScrollArea`, `DropdownMenu`, `Dialog`, `Card`, `Tooltip`, `Progress`, `Select` |
| Window vibrancy | `tauri-plugin-window-vibrancy` | `NSVisualEffectMaterial::HudWindow` for popover |
| State | React Query for SQLite reads, Zustand or context for UI state | |
| IPC | Tauri commands (`invoke`) — see list below | |

### Tauri commands (Rust → JS)

```ts
invoke('list_history', { limit, offset, query, profileId })
invoke('paste_to_frontmost', { id })
invoke('copy_history_item', { id })
invoke('toggle_favorite', { id })
invoke('delete_history_item', { id })
invoke('rerun_cleanup', { id, profileId })

invoke('list_profiles')
invoke('upsert_profile', { profile })
invoke('set_active_profile', { id })

invoke('list_vocabulary', { profileId? })
invoke('upsert_vocab_term', { term })

invoke('list_whisper_models')
invoke('download_whisper_model', { size })       // emits 'whisper-download-progress' events
invoke('set_active_whisper_model', { size })
invoke('check_ollama')
invoke('list_ollama_models')

invoke('open_window', { name: 'history' | 'onboarding' })

// permissions
invoke('check_permissions')                       // { microphone, accessibility }
invoke('request_microphone')
invoke('request_accessibility')                   // opens System Settings
```

Events (Rust → JS):
- `recording-started` / `recording-stopped`
- `audio-level` (RMS for waveform)
- `transcription-complete` (raw + cleaned text)
- `whisper-download-progress` ({ size, bytesDone, bytesTotal })

### Tailwind v4 theme tokens

```css
@import "tailwindcss";

@theme {
  --color-amber: oklch(0.79 0.12 65);              /* #E8A961 light */
  --color-amber-dark: oklch(0.83 0.13 70);         /* #F2B570 dark */
  --color-amber-ink: oklch(0.62 0.13 60);          /* amber border / amber-on-amber text */
  --color-favorite: oklch(0.85 0.15 90);           /* yellow — favorites only */
  --color-destructive: oklch(0.62 0.18 25);        /* red — destructive only */

  --radius-card: 0.5rem;     /* 8pt */
  --radius-window: 0.75rem;  /* 12pt */

  --font-sans: "SF Pro Text", system-ui, sans-serif;
  --font-mono: "SF Mono", ui-monospace, monospace;

  /* Apple HIG type scale */
  --text-title: 17px;
  --text-body: 13px;
  --text-footnote: 11px;
  --text-tag: 10px;
}
```

Use `light-dark()` for surfaces; respect system theme.

---

## Surface 1 · Tray icon (simplified)

**One state, one icon.** A monochrome Fluister logo (use a small waveform glyph or your custom mark — supply as a `Template Image` PNG/SVG so macOS auto-tints it light/dark).

**Behavior:**
- **Click** → toggles the popover window
- **Right-click** → context menu: `Open History…`, `Settings…`, `Quit`

Implement with `tauri::tray::TrayIconBuilder`. Single icon — no `set_icon()` swapping.

---

## Surface 2 · Popover (Variant B — last dictation surfaced)

**Window:** undecorated Tauri window, ~280×360 pt, anchored below tray icon.
**Vibrancy:** `NSVisualEffectMaterial::HudWindow` via `tauri-plugin-window-vibrancy`. **Do not** use `backdrop-filter: blur()` — use real NSVisualEffectView.

```
┌──────────────────────────────┐
│ LAST DICTATION · 10:42       │  ← text-tag, uppercase, muted
│ ┌──────────────────────────┐ │
│ │ Hey Sam, can we move…    │ │  ← text-body, max 3 lines
│ └──────────────────────────┘ │
│ [⌘V Paste]  [⌘C]  [★]        │
│ ───────────────────────────  │
│ Profile          [Email ▾]   │  ← DropdownMenu
│ AI cleanup            [ ●─ ] │  ← Switch
│ Mute mic              [─● ]  │
│ ───────────────────────────  │
│ Open History…                │
│ Settings…                    │
│                              │
│ Quit Fluister          ⌘Q    │
└──────────────────────────────┘
```

**Components:**
- Outer container: transparent (vibrancy from NSVisualEffectView), `p-2.5`, gap-y-2
- Last-dictation card: `bg-white/40 dark:bg-black/20`, `rounded-md`, `p-2`, `text-[13px]/[1.45]`, `line-clamp-3`
- Action row: 3 `Button`s — first `variant="default"` (amber bg), other two `variant="ghost"`. Use `<kbd>` for shortcut hint.
- Profile row: `DropdownMenu` triggered by amber-tinted chip showing current profile. Menu lists profiles + `Manage profiles…` at bottom.
- Toggles: shadcn `Switch` (amber when on)
- Menu rows: `<button class="w-full justify-between hover:bg-black/5 dark:hover:bg-white/10">`
- Quit row: `font-mono text-[11px]` for `⌘Q` hint

**Behavior:**
- Open via `webview.show()` on tray click
- Close on click outside (focus-loss listener)
- "Open History…" → `invoke('open_window', { name: 'history' })`
- "Settings…" → opens History window on Settings tab
- Pre-fetch last dictation on open via `invoke('list_history', { limit: 1 })`

**Keyboard:** ↑/↓ moves focus, Enter activates, Esc closes.

---

## Surface 3 · Recording overlay (Variant A — pill, configurable position)

**Window:** undecorated, transparent, always-on-top, click-through, no shadow. ~220×40 pt.

**Position is user-configurable** in Settings → General → "Overlay position":
- `bottom-right` (default)
- `top-center`
- `bottom-left`
- `top-right`
- `bottom-center`

Store in SQLite `settings` table; on load, position the Tauri window via `set_position()` against the active screen's work area.

```
┌──────────────────────────────────────────┐
│  ●  ▁▃▅▇▅▃▁▃▅▇▅▃   0:03                  │  ← rounded-full, dark
└──────────────────────────────────────────┘
```

- Container: `bg-zinc-900/92 backdrop-blur-xl rounded-full px-3 py-1.5 flex items-center gap-2 shadow-2xl`
- Red dot: `w-1.5 h-1.5 rounded-full bg-destructive animate-pulse`
- Waveform: 12 bars, 2px wide, `bg-white`, animated from RMS levels via `audio-level` event channel
- Timer: `font-mono text-[10px] text-zinc-300`

**Lifecycle:**
1. Right-Option pressed (Rust CGEventTap) → emit `recording-started` → React shows window with slide-in: `translateY(20px) → 0`, `200ms ease-out`
2. While held: stream RMS levels for waveform animation
3. Right-Option released → emit `recording-stopped` → slide-out, then `webview.hide()`

---

## Surface 4 · History window (Variant B — three-pane with detail)

**Window:** standard Tauri window with traffic lights, draggable title bar (`data-tauri-drag-region`), ~960×640 pt min, resizable.

### Layout (CSS Grid)

```
grid-template-columns: 44px 220px 1fr;
grid-template-rows: 28px 1fr;   /* 28pt carved for traffic lights */
```

```
┌───────────────────────────────────────────────────┐
│ ● ● ●   [draggable region]                        │  28pt
├────┬─────────────┬────────────────────────────────┤
│ ⌒  │ [⌕ search]  │  TODAY · 10:42 · EMAIL         │
│ ◇  │ ─────────── │  [★] [⌘V paste] [⌘C]           │
│ A  │ Today       │                                │
│ ⚙  │ ┌─────────┐ │  Hey Sam, can we move the     │
│    │ │ Email   │ │  design review to Thursday    │
│    │ │ 10:42   │ │  afternoon? I want to make   │
│    │ │ Hey Sa… │ │  sure we have time to walk    │
│    │ └─────────┘ │  through the recording        │
│    │   Code      │  overlay variants together.   │
│    │   10:14     │                                │
│    │   todo: re… │  ─────────────                │
│    │   Slack     │  RAW TRANSCRIPT                │
│    │   09:51     │  hey sam can we move the…     │
│    │   …         │                                │
└────┴─────────────┴────────────────────────────────┘
```

### Pane 1 — Icon rail (44pt)

- Bottom of column: small "active profile" indicator (amber dot + profile initial)
- Four icon buttons: History (active), Profiles, Vocabulary, Settings (bottom-pinned)
- Active icon: amber-tinted background, rounded-md
- Tooltips on hover (shadcn `Tooltip`)
- `⌘B` collapses/expands a 220pt label rail next to it (optional v2)

### Pane 2 — List (220pt)

- Top: search `Input` with `⌕` prefix, `text-footnote`
- Day-grouped list (sticky day headers — `text-tag uppercase tracking-wider`)
- Each row: `px-2.5 py-1.5 border-b border-dashed border-black/10`, two lines:
  - Top line: profile chip (`text-[9px]`) + time (`font-mono text-[9px] text-muted`), space-between
  - Bottom line: dictation preview (`text-[10px] line-clamp-1`)
- Selected row: `bg-amber text-zinc-900` (full row, not just border)
- Keyboard: ↑/↓ navigates rows, Enter focuses detail pane

### Pane 3 — Detail (flex-1)

- Top bar: meta line (`TODAY · 10:42 · EMAIL PROFILE`) + action chips on the right (`★ favorite`, `⌘V paste`, `⌘C`)
- Body: full cleaned text, `text-[13px]/[1.55]`, selectable
- `Separator`
- "RAW TRANSCRIPT" section (collapsed by default? expanded?): `font-mono text-[10px] text-muted`, in a `bg-paper-warm` box with `border-dashed`
- Below: profile-specific metadata — duration, model used, profile prompt applied (collapsible)

### Row interactions
- **⌘C** / copy → `invoke('copy_history_item', { id })`
- **⌘V** / paste → `invoke('paste_to_frontmost', { id })` — Rust dispatches synthetic ⌘V via `enigo`
- **★** → `invoke('toggle_favorite', { id })`
- **⌘F** → focus search input
- **⌘Backspace** → delete selected (confirm via `Dialog`)
- **Right-click row** → context menu: Copy, Paste, Favorite, Delete, Re-run cleanup

### Other tabs (Profiles / Vocabulary / Settings)

When sidebar selection ≠ History, the **list and detail panes** swap their content but the three-pane shell stays — keeps the user's window mental model intact.

- **Profiles**: list = profiles + `+ New`. Detail = name, description, style_prompt textarea, profile-scoped vocab list.
- **Vocabulary**: list = grouped (Global / per-profile). Detail = term + aliases editor.
- **Settings**: list = sub-tabs (General, Recording, Models, About). Detail = settings cards. Each setting is a `Card` with title (`text-body font-semibold`) + description (`text-footnote text-muted`) + control on right. **No nested cards.**

Settings → General must include **"Overlay position"** picker (5 options) — wires the recording overlay's window placement.

---

## Surface 5 · Onboarding window (Variant A — multi-step stepper)

**Window:** standalone Tauri window, fixed 720×540 pt, not resizable, no minimize/maximize. Reachable from Settings → "Re-run onboarding".

Four steps with a progress strip at the top:

```
[✓ Permissions]──[● Model]──[○ AI cleanup]──[○ Done]

                   Pick a Whisper model
   Whisper runs on your Mac's GPU. Bigger model = better
            accuracy, more disk + RAM.

   ○ Tiny    · 75 MB    · fastest
   ●  Base   · 142 MB   · recommended         ← amber-filled
   ○ Small   · 466 MB   · higher accuracy
   ○ Medium  · 1.5 GB   · best for jargon

   step 2 of 4              [Back]  [Download & continue]
```

### Step 1 — Permissions
- Two cards: Microphone + Accessibility
- Each shows status (`granted` / `not granted`) + a "Grant" button
- "Grant Microphone" → `invoke('request_microphone')`
- "Grant Accessibility" → `invoke('request_accessibility')` (opens System Settings; we poll on focus return)
- "Continue" disabled until both granted

### Step 2 — Whisper model
- Radio list of 4 sizes (Tiny, Base, Small, Medium). Default selected: Base.
- "Download & continue" → `invoke('download_whisper_model', { size })`
- Show inline `<Progress>` during download (subscribe to `whisper-download-progress`)
- Continue auto-fires when download completes

### Step 3 — AI cleanup (optional)
- "Install Ollama" (`↗ Get Ollama` external link) + "Skip for now" buttons
- If Ollama detected on next focus: show available local models in a `Select`; user picks one or skips

### Step 4 — Done
- Big checkmark, "You're set." headline
- Summary list: Whisper model, mic, accessibility, Ollama status
- "Start dictating" button → closes window

**Progress strip:** completed steps → amber-filled with check, current → outlined amber, future → muted dashed border.

---

## Design Tokens

```ts
// Colors
amber:        '#E8A961'  // light primary accent
amberDark:    '#F2B570'  // dark primary accent
amberInk:     '#B27A30'  // amber border / amber-on-amber text
favorite:     '#F4C542'  // yellow — favorites only
destructive:  '#C45844'  // red — destructive only

// Type
SF Pro Text   // UI
SF Mono       // timestamps, kbd, code

// Type scale (Apple HIG)
title: 17px · body: 13px · footnote: 11px · tag: 10px

// Radii
card: 8px · window: 12px · pill: 999px (overlay only)

// Spacing — 4pt grid; most-used vertical rhythm: 14pt and 16pt

// Motion
180–220ms ease-out · hover 120ms · overlay slide-in/out only
no popover animation · no bounce / parallax / wiggle
```

---

## Don't-do list

- ❌ No splash screen, no marketing/upsell
- ❌ No telemetry banners (nothing to disclose)
- ❌ No custom window chrome — real macOS traffic lights
- ❌ No `backdrop-filter: blur()` for popover — real NSVisualEffectView
- ❌ One amber, one yellow (favorites), one red (destructive). No accent-color soup.
- ❌ No nested `Card`s
- ❌ No invented type sizes (stick to 17/13/11/10)
- ❌ No bounce / wiggle / parallax animations

---

## Files

- `Fluister Wireframes.html` — entry point; loads all variants in a pan/zoom canvas
- `wireframes-history.jsx` — implement **`HistoryB`**
- `wireframes-popover.jsx` — implement **`PopoverB`**
- `wireframes-overlay.jsx` — implement **`OverlayA`** (with configurable position)
- `wireframes-onboarding.jsx` — implement **`OnbA`**
- `wireframes-tray.jsx` — reference only; ship a single logo icon
- `wireframes-app.jsx`, `design-canvas.jsx`, `tweaks-panel.jsx` — composition / canvas only, not for implementation
- `BRIEF.md` — original design brief

To **view** the wireframes: open `Fluister Wireframes.html` in any modern browser.

---

## Suggested Build Order

1. Tauri scaffold — multi-window, four Vite entries (`popover`, `overlay`, `history`, `onboarding`)
2. Tray icon (single logo) + click → popover toggle
3. **Popover (B)** — needs vibrancy plugin + `list_history { limit: 1 }`
4. **Recording overlay (A)** — wire to whisper-rs pipeline; defer position-config to Settings
5. **History window (B)** — History tab first (three-pane); defer Profiles/Vocab/Settings panes
6. Settings tab (General + Models first, including overlay position picker)
7. Profiles + Vocabulary tabs
8. **Onboarding (A)** — last; users only see it once

When in doubt: "what would Apple do here?"
