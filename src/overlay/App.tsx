import { useEffect, useMemo, useRef, useState } from "react";
import { commands, type Profile } from "../lib/tauri";
import { useTauriEvent } from "../lib/hooks";
import { Pill } from "./Pill";
import type { WaveformHandle } from "./Waveform";

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

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function App() {
  const [state, setState] = useState<OverlayState>("idle");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);

  const stateRef = useRef<OverlayState>("idle");
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const recordingStartRef = useRef<number | null>(null);
  const timerRef = useRef<HTMLSpanElement | null>(null);
  const waveformRef = useRef<WaveformHandle | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);

  // Load profiles + active id on mount, and again whenever the backend
  // tells us they changed. The pill displays the active profile name as a
  // read-only label — switching happens elsewhere (Settings → Profiles).
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const [list, settings] = await Promise.all([
          commands.listProfiles(),
          commands.getSettings(),
        ]);
        if (cancelled) return;
        setProfiles(list);
        setActiveId(settings.active_profile_id);
      } catch {
        // ignore — pill falls back to "Default" label
      }
    };
    refresh();
    return () => {
      cancelled = true;
    };
  }, []);

  useTauriEvent<void>("profiles-changed", async () => {
    try {
      const [list, settings] = await Promise.all([
        commands.listProfiles(),
        commands.getSettings(),
      ]);
      setProfiles(list);
      setActiveId(settings.active_profile_id);
    } catch {
      // ignore
    }
  });

  // Status drives the entire HUD lifecycle.
  useTauriEvent<StatusPayload>("status", (e) => {
    const next = e.payload.state;
    setState(next);
    if (next === "recording") {
      recordingStartRef.current = performance.now();
      if (timerRef.current) timerRef.current.textContent = "0:00";
    } else {
      recordingStartRef.current = null;
      waveformRef.current?.reset();
    }
  });

  // Real audio levels → waveform, no React state churn.
  useTauriEvent<number>("level", (e) => {
    if (stateRef.current !== "recording") return;
    waveformRef.current?.pushLevel(e.payload);
  });

  // Timer mutates the DOM directly — never causes a re-render.
  useEffect(() => {
    const id = window.setInterval(() => {
      const start = recordingStartRef.current;
      if (start == null || !timerRef.current) return;
      timerRef.current.textContent = formatElapsed(performance.now() - start);
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  const recording = state === "recording";
  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeId) ?? null,
    [profiles, activeId],
  );

  return (
    <div className="w-full h-full flex flex-col items-center justify-end pb-[6px]">
      <Pill
        ref={pillRef}
        activeProfileName={activeProfile?.name ?? "Default"}
        timerRef={timerRef}
        recording={recording}
        waveformRef={waveformRef}
      />
    </div>
  );
}
