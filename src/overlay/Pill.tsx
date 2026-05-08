import { forwardRef } from "react";
import { Waveform, type WaveformHandle } from "./Waveform";

interface PillProps {
  activeProfileName: string;
  /** Display: "0:04" — kept as a child element with mutation by RAF; pass null
   *  to hide the timer entirely (idle, no recording). */
  timerRef: React.RefObject<HTMLSpanElement | null>;
  recording: boolean;
  waveformRef: React.RefObject<WaveformHandle | null>;
}

export const Pill = forwardRef<HTMLDivElement, PillProps>(function Pill(
  { activeProfileName, timerRef, recording, waveformRef },
  ref,
) {
  return (
    <div
      ref={ref}
      className="relative z-10 inline-flex items-center gap-3 pl-3 pr-[14px] py-2 rounded-pill font-sf text-[12px] text-hud-ink bg-hud-bg shadow-[0_12px_36px_rgba(15,10,5,0.30),inset_0_0_0_0.5px_rgba(255,255,255,0.06)] backdrop-blur-[40px] backdrop-saturate-[1.8]"
    >
      <span
        className={`block w-[7px] h-[7px] rounded-full bg-red shadow-[0_0_8px_rgba(255,59,48,0.7)] ${recording ? "animate-flu-pulse" : ""}`}
        aria-hidden
      />
      <Waveform ref={waveformRef} active={recording} />
      <span
        ref={timerRef}
        className="font-fl-mono text-[11px] text-hud-ink-2 tabular-nums min-w-[28px]"
      >
        0:00
      </span>
      <span className="block w-px h-3 bg-hud-stroke" aria-hidden />
      <span className="inline-flex items-center gap-[5px] font-sf text-[11px] font-medium text-hud-ink leading-none">
        <span className="block w-[6px] h-[6px] rounded-full bg-amber" aria-hidden />
        <span>{activeProfileName}</span>
      </span>
    </div>
  );
});
