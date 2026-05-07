import { useEffect, useRef, useState } from "react";
import { useTauriEvent } from "../lib/hooks";

type OverlayState =
  | "idle"
  | "recording"
  | "transcribing"
  | "cleaning"
  | "pasting"
  | "error";

interface StatusPayload {
  state: OverlayState;
  message?: string | null;
}

const BAR_COUNT = 12;

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function App() {
  const [state, setState] = useState<OverlayState>("idle");

  // Mirror state into a ref so the RAF loop reads the current value without
  // a stale closure or a dependency-array re-subscribe.
  const stateRef = useRef<OverlayState>("idle");
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // All per-frame quantities live in refs — never trigger a render.
  const levelHistoryRef = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const displayHeightsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0.2));
  const recMixRef = useRef(0);
  const shimMixRef = useRef(0);
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const timerRef = useRef<HTMLSpanElement | null>(null);
  const recordingStartRef = useRef<number | null>(null);

  useTauriEvent<StatusPayload>("status", (e) => {
    const next = e.payload.state;
    setState(next);
    if (next !== "recording") {
      levelHistoryRef.current.fill(0);
    }
    if (next === "recording") {
      recordingStartRef.current = performance.now();
      if (timerRef.current) timerRef.current.textContent = "0:00";
    } else {
      recordingStartRef.current = null;
    }
  });

  useTauriEvent<number>("level", (e) => {
    if (stateRef.current !== "recording") return;
    const lvl = Math.max(0, Math.min(1, e.payload));
    const buf = levelHistoryRef.current;
    buf.shift();
    buf.push(lvl);
  });

  // Timer — drive via interval + DOM mutation so the React tree never
  // re-renders during a recording. 250ms is a comfortable cadence for
  // second precision.
  useEffect(() => {
    const id = setInterval(() => {
      const start = recordingStartRef.current;
      if (start == null || !timerRef.current) return;
      timerRef.current.textContent = formatElapsed(performance.now() - start);
    }, 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let rafId = 0;

    const tick = (now: number) => {
      const cur = stateRef.current;
      const wantsRec = cur === "recording";
      const wantsShim =
        cur === "transcribing" || cur === "cleaning" || cur === "pasting";

      // Cross-fade between idle / recording / processing layers.
      recMixRef.current += ((wantsRec ? 1 : 0) - recMixRef.current) * 0.18;
      shimMixRef.current += ((wantsShim ? 1 : 0) - shimMixRef.current) * 0.12;

      for (let i = 0; i < BAR_COUNT; i++) {
        // Per-bar phase offset so neighbouring bars don't move in lockstep.
        const phase = i * 0.55;

        // Always-on subtle breathing — keeps the wave alive at idle and
        // gives recording/processing organic shimmer instead of pure level
        // metering.
        const breath = 0.5 + 0.5 * Math.sin(now / 360 + phase);
        const idleH = 0.18 + breath * 0.04;

        // Recording layer: scrolling voice history with a touch of wobble
        // so it doesn't look like a flat bargraph when audio is uniform.
        const lvl = levelHistoryRef.current[i] ?? 0;
        const recH = 0.2 + lvl * 0.78 + breath * 0.04;

        // Processing layer: traveling sine wave for continuous activity
        // (not a pulse).
        const wave = 0.5 + 0.5 * Math.sin(now / 320 + phase);
        const shimH = 0.22 + wave * 0.72;

        const idleWeight = Math.max(
          0,
          1 - recMixRef.current - shimMixRef.current,
        );
        const targetH =
          idleH * idleWeight +
          recH * recMixRef.current +
          shimH * shimMixRef.current;

        // Exponential smoothing toward target — fluid 60fps motion.
        displayHeightsRef.current[i] +=
          (targetH - displayHeightsRef.current[i]) * 0.32;

        const h = Math.max(0.15, Math.min(1, displayHeightsRef.current[i]));
        const bar = barRefs.current[i];
        if (bar) bar.style.transform = `scaleY(${h})`;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const isRecording = state === "recording";

  return (
    <div id="pill" className="pill" data-state={state}>
      <div className="glass" />
      <span
        className="dot"
        aria-hidden
        data-visible={isRecording ? "true" : "false"}
      />
      <div className="wave">
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <span
            key={i}
            ref={(el) => {
              barRefs.current[i] = el;
            }}
            className="bar"
          />
        ))}
      </div>
      <span
        className="timer"
        ref={timerRef}
        aria-hidden
        data-visible={isRecording ? "true" : "false"}
      >
        0:00
      </span>
    </div>
  );
}
