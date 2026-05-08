import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const BAR_COUNT = 18;

export interface WaveformHandle {
  pushLevel(lvl: number): void;
  reset(): void;
}

interface WaveformProps {
  active: boolean;
  className?: string;
}

export const Waveform = forwardRef<WaveformHandle, WaveformProps>(function Waveform(
  { active, className },
  ref,
) {
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const levelHistory = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const display = useRef<number[]>(new Array(BAR_COUNT).fill(0.18));
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useImperativeHandle(ref, () => ({
    pushLevel(lvl) {
      const v = Math.max(0, Math.min(1, lvl));
      const buf = levelHistory.current;
      buf.shift();
      buf.push(v);
    },
    reset() {
      levelHistory.current.fill(0);
    },
  }));

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      const live = activeRef.current;
      for (let i = 0; i < BAR_COUNT; i++) {
        // Per-bar phase so neighbours don't move in lockstep.
        const phase = i * 0.55;
        const breath = 0.5 + 0.5 * Math.sin(now / 360 + phase);
        const idleH = 0.16 + breath * 0.05;
        const lvl = levelHistory.current[i] ?? 0;
        const recH = 0.2 + lvl * 0.78 + breath * 0.04;
        const target = live ? recH : idleH;
        display.current[i] += (target - display.current[i]) * 0.32;
        const h = Math.max(0.12, Math.min(1, display.current[i]));
        const bar = barRefs.current[i];
        if (bar) bar.style.transform = `scaleY(${h})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <span
      className={`inline-flex items-center h-4 gap-[2px] ${className ?? ""}`}
      aria-hidden
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            barRefs.current[i] = el;
          }}
          className="block w-[2px] h-full rounded-[1px] bg-hud-ink opacity-90 origin-center will-change-transform"
        />
      ))}
    </span>
  );
});
