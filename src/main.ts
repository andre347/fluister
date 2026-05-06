import { listen } from "@tauri-apps/api/event";

type State =
  | "idle"
  | "recording"
  | "transcribing"
  | "cleaning"
  | "pasting"
  | "error";

interface StatusPayload {
  state: State;
  message?: string | null;
}

const BAR_COUNT = 7;
const bars = Array.from(document.querySelectorAll<HTMLSpanElement>(".wave .bar"));

// Rolling oscilloscope buffer for the recording state — each bar reads
// `levelHistory[i]`, so audio "scrolls" left-to-right across the wave.
const levelHistory: number[] = new Array(BAR_COUNT).fill(0);

// Smoothed per-bar display heights (0..1). The animation loop tweens these
// toward the computed target every frame, giving the motion a fluid feel
// rather than a snap-to-sample one.
const displayHeights: number[] = new Array(BAR_COUNT).fill(0.2);

let currentState: State = "idle";
let recMix = 0; // smoothed 0..1 weight for the recording layer
let shimMix = 0; // smoothed 0..1 weight for the processing-shimmer layer

function setState(payload: StatusPayload) {
  const pill = document.getElementById("pill");
  if (!pill) return;
  currentState = payload.state;
  pill.dataset.state = payload.state;
  if (payload.state !== "recording") {
    levelHistory.fill(0);
  }
}

function pushLevel(level: number) {
  if (currentState !== "recording") return;
  levelHistory.shift();
  levelHistory.push(Math.max(0, Math.min(1, level)));
}

function frame(now: number) {
  const wantsRec = currentState === "recording";
  const wantsShim =
    currentState === "transcribing" ||
    currentState === "cleaning" ||
    currentState === "pasting";

  // Smooth the layer weights so state transitions cross-fade.
  recMix += ((wantsRec ? 1 : 0) - recMix) * 0.18;
  shimMix += ((wantsShim ? 1 : 0) - shimMix) * 0.12;

  for (let i = 0; i < BAR_COUNT; i++) {
    // Per-bar phase offset so neighboring bars don't move in lockstep.
    const phase = i * 0.55;

    // Always-on subtle breathing — keeps the wave alive at idle and gives
    // recording/processing an organic shimmer instead of pure level metering.
    const breath = 0.5 + 0.5 * Math.sin(now / 360 + phase); // 0..1
    const idleH = 0.18 + breath * 0.04;

    // Recording layer: scrolling voice history with a touch of wobble so it
    // doesn't look like a flat bargraph when the audio is uniform.
    const lvl = levelHistory[i] ?? 0;
    const recH = 0.2 + lvl * 0.78 + breath * 0.04;

    // Processing layer: traveling sine wave left → right at a slower rate so
    // the eye reads continuous activity, not pulsing.
    const wave = 0.5 + 0.5 * Math.sin(now / 320 + phase);
    const shimH = 0.22 + wave * 0.72;

    // Blend layers by their smoothed weights. recording and processing are
    // mutually exclusive states, so the sum stays ≤ 1 across transitions.
    const idleWeight = Math.max(0, 1 - recMix - shimMix);
    const targetH = idleH * idleWeight + recH * recMix + shimH * shimMix;

    // Exponential smoothing toward target — fluid 60fps motion.
    displayHeights[i] += (targetH - displayHeights[i]) * 0.32;

    const h = Math.max(0.15, Math.min(1, displayHeights[i]));
    bars[i].style.transform = `scaleY(${h})`;
  }

  requestAnimationFrame(frame);
}

window.addEventListener("DOMContentLoaded", async () => {
  setState({ state: "idle" });
  await listen<StatusPayload>("status", (e) => setState(e.payload));
  await listen<number>("level", (e) => pushLevel(e.payload));
  requestAnimationFrame(frame);
});
