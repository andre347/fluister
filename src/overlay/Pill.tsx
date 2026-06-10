import { forwardRef } from "react";
import { Waveform, type WaveformHandle } from "./Waveform";

type OverlayState =
  | "idle"
  | "recording"
  | "transcribing"
  | "cleaning"
  | "pasting"
  | "error";

interface PillProps {
  /** Current pipeline phase, drives the entire pill layout. */
  state: OverlayState;
  /** Human-readable detail for the `error` state (and the gentle skip
   *  notices the backend surfaces through it, e.g. "No speech detected"). */
  message: string | null;
  activeProfileName: string;
  /** Display: "0:04" — kept as a child element with mutation by RAF. Only
   *  mounted while recording. */
  timerRef: React.RefObject<HTMLSpanElement | null>;
  waveformRef: React.RefObject<WaveformHandle | null>;
}

const PHASE_LABEL: Partial<Record<OverlayState, string>> = {
  transcribing: "Transcribing…",
  cleaning: "Cleaning…",
  pasting: "Pasting…",
};

export const Pill = forwardRef<HTMLDivElement, PillProps>(function Pill(
  { state, message, activeProfileName, timerRef, waveformRef },
  ref,
) {
  const recording = state === "recording";
  const processing =
    state === "transcribing" || state === "cleaning" || state === "pasting";
  const error = state === "error";

  // Recording: pulsing red. Processing: pulsing amber. Error: steady red.
  const dotClass = processing
    ? "bg-amber shadow-[0_0_8px_rgba(255,159,10,0.7)] animate-flu-pulse"
    : recording
      ? "bg-red shadow-[0_0_8px_rgba(255,59,48,0.7)] animate-flu-pulse"
      : "bg-red shadow-[0_0_8px_rgba(255,59,48,0.7)]";

  return (
    <div
      ref={ref}
      className="relative z-10 inline-flex items-center gap-3 pl-3 pr-[14px] py-2 rounded-pill font-sf text-[12px] text-hud-ink bg-hud-bg shadow-[0_12px_36px_rgba(15,10,5,0.30),inset_0_0_0_0.5px_rgba(255,255,255,0.06)] backdrop-blur-[40px] backdrop-saturate-[1.8]"
    >
      <span
        className={`block w-[7px] h-[7px] rounded-full ${dotClass}`}
        aria-hidden
      />

      {recording && (
        <>
          <Waveform ref={waveformRef} active />
          <span
            ref={timerRef}
            className="font-fl-mono text-[11px] text-hud-ink-2 tabular-nums min-w-[28px]"
          >
            0:00
          </span>
          <span className="block w-px h-3 bg-hud-stroke" aria-hidden />
          <span className="inline-flex items-center gap-[5px] font-sf text-[11px] font-medium text-hud-ink leading-none">
            <span
              className="block w-[6px] h-[6px] rounded-full bg-amber shrink-0"
              aria-hidden
            />
            <span className="max-w-[120px] truncate">{activeProfileName}</span>
          </span>
        </>
      )}

      {processing && (
        <span className="font-sf text-[12px] text-hud-ink leading-none whitespace-nowrap">
          {PHASE_LABEL[state]}
        </span>
      )}

      {error && (
        <span
          className="font-sf text-[12px] text-hud-ink leading-none max-w-[260px] truncate"
          title={message ?? undefined}
        >
          {message ?? "Something went wrong"}
        </span>
      )}
    </div>
  );
});
