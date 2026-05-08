// Shared hero primitives: animated waveform, recording pill, fake mac windows,
// and the cycling demo content for the "live demo" hero.

// — Animated waveform (12 bars by default), driven from random RMS-ish noise
function useWaveLevels(bars = 12, fps = 18) {
  const [levels, setLevels] = React.useState(() =>
    Array.from({ length: bars }, () => 0.3 + Math.random() * 0.5)
  );
  React.useEffect(() => {
    let raf, last = 0;
    const step = (t) => {
      if (t - last > 1000 / fps) {
        last = t;
        setLevels((prev) =>
          prev.map((v, i) => {
            // smooth random walk, biased to mid amplitudes
            const target = 0.18 + Math.abs(Math.sin((t / 280) + i * 0.7)) * 0.7 + (Math.random() - 0.5) * 0.25;
            return Math.max(0.08, Math.min(1, v * 0.55 + target * 0.45));
          })
        );
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [bars, fps]);
  return levels;
}

function Wave({ bars = 12, height = 14, color }) {
  const levels = useWaveLevels(bars);
  return (
    <span className="wave" style={{ height, color }}>
      {levels.map((v, i) => (
        <i key={i} style={{ height: Math.max(2, Math.round(v * height)) }} />
      ))}
    </span>
  );
}

// — Mono timer that counts up from 0:00
function Timer({ runningKey = 0, format = "mm:ss" }) {
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    setT(0);
    const start = performance.now();
    const id = setInterval(() => setT((performance.now() - start) / 1000), 200);
    return () => clearInterval(id);
  }, [runningKey]);
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return <span className="timer mono">{m}:{s.toString().padStart(2, "0")}</span>;
}

// — The reusable recording pill HUD
function Pill({ width, label, showTimer = true, ghost = false, runningKey }) {
  return (
    <span className="pill" style={{
      ...(width ? { minWidth: width } : null),
      ...(ghost ? { background: "rgba(26,23,20,0.7)" } : null),
    }}>
      <span className="dot" />
      <Wave bars={12} height={14} color="#fbf8f2" />
      {label && <span style={{ fontSize: 11, color: "#c8bfb4" }}>{label}</span>}
      {showTimer && <Timer runningKey={runningKey} />}
    </span>
  );
}

// — Tiny mac window scaffold for hero vignettes
function MacWindow({ title, children, width, height, style }) {
  return (
    <div className="mac-win" style={{ width, height, ...style }}>
      <div className="titlebar">
        <span className="tl"><span/><span/><span/></span>
        {title && <span className="title">{title}</span>}
      </div>
      <div style={{ position: "relative", height: height ? height - 28 : "auto" }}>
        {children}
      </div>
    </div>
  );
}

// — Profile-cycling demo content (Email / Slack / Notes / Code)
const DEMO_PROFILES = [
  {
    id: "email",
    name: "Email",
    appName: "Mail",
    title: "Compose — Mail",
    contextLines: [
      ["To:", "sam@studio.com"],
      ["Subject:", "design review"],
    ],
    raw: "hey sam can we move the design review to thursday afternoon i want to make sure we have time to walk through the recording overlay variants together",
    cleaned: "Hey Sam — could we move the design review to Thursday afternoon? I want to make sure we have time to walk through the recording overlay variants together.",
  },
  {
    id: "slack",
    name: "Slack",
    appName: "Slack",
    title: "#design-team — Slack",
    contextLines: [
      ["#", "design-team"],
    ],
    raw: "shipping the popover variant b today its going to land behind a flag while we wire vibrancy",
    cleaned: "shipping popover variant B today — landing behind a flag while we wire up vibrancy 🛠️",
  },
  {
    id: "notes",
    name: "Notes",
    appName: "Notes",
    title: "Untitled — Notes",
    contextLines: [
      ["", "Tuesday · 10:42"],
    ],
    raw: "todo follow up with marco about the whisper model picker onboarding step three is still rough",
    cleaned: "Todo: follow up with Marco about the Whisper model picker. Onboarding step 3 is still rough.",
  },
  {
    id: "code",
    name: "Code",
    appName: "Cursor",
    title: "history.tsx — Cursor",
    contextLines: [
      ["", "src/windows/history/HistoryList.tsx"],
    ],
    raw: "todo fix the keyboard nav so cmd up jumps to the first item in the day group",
    cleaned: "// TODO: fix keyboard nav so ⌘↑ jumps to the first item in the day group.",
  },
];

// — Cycle hook
function useCycle(items, periodMs = 4200) {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % items.length), periodMs);
    return () => clearInterval(id);
  }, [items.length, periodMs]);
  return [items[i], i, setI];
}

// — Typewriter that emits chars over `ms` total
function useTypewriter(text, ms = 1600, key = 0) {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    setN(0);
    if (!text) return;
    const start = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / ms);
      setN(Math.floor(p * text.length));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, ms, key]);
  return text.slice(0, n);
}

Object.assign(window, {
  Wave, Timer, Pill, MacWindow,
  DEMO_PROFILES, useCycle, useTypewriter, useWaveLevels,
});
