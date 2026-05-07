import { useCallback, useEffect, useMemo, useState } from "react";
import {
  commands,
  type DownloadProgress,
  type ModelDownloadDone,
  type ModelDownloadFailed,
  type ModelInfo,
  type OnboardingStatus,
  type Settings,
} from "../lib/tauri";
import { useTauriEvent, useThemeFromSettings, useWindowFocus } from "../lib/hooks";
import {
  LANGUAGES,
  isEnglishLanguage,
  recommendedWhisperFilename,
  recommendedWhisperLabel,
} from "../languages";

const POLL_INTERVAL_MS = 1500;
const RECOMMENDED_SIZE_MB = 142;

type RowState = "ok" | "warn" | "loading";

export function App() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [whisperModels, setWhisperModels] = useState<ModelInfo[]>([]);
  const [language, setLanguage] = useState<string>("en-US");
  const [downloading, setDownloading] = useState(false);
  const [downloadPct, setDownloadPct] = useState(0);
  const [ollamaSkipped, setOllamaSkipped] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [micRequesting, setMicRequesting] = useState(false);

  useThemeFromSettings(refreshTick);

  // Poll status every 1.5s plus refresh on window focus.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [s, models, settings] = await Promise.all([
          commands.onboardingStatus(),
          commands.listWhisperModels(),
          commands.getSettings(),
        ]);
        if (cancelled) return;
        setStatus(s);
        setWhisperModels(models);
        setLanguage((prev) =>
          settings.language && settings.language !== prev
            ? settings.language
            : prev,
        );
      } catch (err) {
        console.error("onboarding refresh failed", err);
      }
    }

    load();
    const id = window.setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [refreshTick]);

  useWindowFocus(() => setRefreshTick((n) => n + 1));

  // Download progress events.
  useTauriEvent<DownloadProgress>("model-download-progress", (e) => {
    const p = e.payload;
    const pct =
      p.total > 0
        ? Math.min(100, Math.floor((p.downloaded / p.total) * 100))
        : 0;
    setDownloadPct(pct);
  });

  useTauriEvent<ModelDownloadDone>("model-download-done", async (e) => {
    setDownloading(false);
    setDownloadPct(0);
    // Make the just-downloaded model the active one — important when the
    // user picked a non-English language while a .en model was active.
    try {
      await commands.setActiveWhisperModel(e.payload.path);
    } catch (err) {
      console.error("set_active_whisper_model failed", err);
    }
    setRefreshTick((n) => n + 1);
  });

  useTauriEvent<ModelDownloadFailed>("model-download-failed", (e) => {
    setDownloading(false);
    setDownloadPct(0);
    console.error("download failed", e.payload.error);
    setRefreshTick((n) => n + 1);
  });

  const whisperReady = useMemo(() => {
    if (isEnglishLanguage(language)) {
      return whisperModels.some((m) => m.installed);
    }
    return whisperModels.some((m) => m.installed && m.multilingual);
  }, [whisperModels, language]);

  const ctaEnabled =
    !!status &&
    status.microphone === "authorized" &&
    status.accessibility &&
    whisperReady;

  // ─── Action handlers ──────────────────────────────────────────────────────

  const handleLanguageChange = useCallback(
    async (newLang: string) => {
      if (newLang === language) return;
      setLanguage(newLang);
      try {
        const current: Settings = await commands.getSettings();
        await commands.updateSettings({ ...current, language: newLang });
      } catch (err) {
        console.error("save language failed", err);
      }
    },
    [language],
  );

  const handleGrantMic = useCallback(async () => {
    setMicRequesting(true);
    try {
      await commands.requestMicrophoneAccess();
    } catch (err) {
      console.error(err);
    }
    setMicRequesting(false);
    setRefreshTick((n) => n + 1);
    // If the prompt was already declined in a previous session, the call
    // can't re-trigger it — deep-link to Settings as a fallback.
    const fresh = await commands.onboardingStatus().catch(() => null);
    if (
      fresh &&
      (fresh.microphone === "denied" || fresh.microphone === "restricted")
    ) {
      await commands.openPrivacyPanel("microphone").catch(() => {});
    }
  }, []);

  const handleOpenAccessibility = useCallback(() => {
    commands.openPrivacyPanel("accessibility").catch(() => {});
  }, []);

  const handleDownloadWhisper = useCallback(async () => {
    setDownloading(true);
    setDownloadPct(0);
    try {
      await commands.downloadWhisperModel(recommendedWhisperFilename(language));
    } catch (err) {
      console.error("download failed", err);
      setDownloading(false);
    }
  }, [language]);

  const handleOllamaCta = useCallback(async () => {
    if (status?.ollama_running && !status.ollama_has_models) {
      try {
        await navigator.clipboard.writeText("ollama pull llama3.2");
      } catch {
        /* clipboard failures are non-fatal */
      }
    } else {
      await commands.openExternalUrl("https://ollama.com").catch(() => {});
    }
  }, [status]);

  const handleSkipOllama = useCallback(() => setOllamaSkipped(true), []);

  const handleFinish = useCallback(() => {
    commands.finishOnboarding().catch((err) => {
      console.error("finish_onboarding failed", err);
    });
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="ob-body">
      <header data-tauri-drag-region className="ob-header" />

      <main className="ob-main">
        <Hero />

        <ul className="ob-list">
          <MicrophoneRow
            status={status}
            requesting={micRequesting}
            onGrant={handleGrantMic}
          />
          <AccessibilityRow
            status={status}
            onOpen={handleOpenAccessibility}
          />
          <LanguageRow language={language} onChange={handleLanguageChange} />
          <WhisperRow
            ready={whisperReady}
            downloading={downloading}
            downloadPct={downloadPct}
            language={language}
            onDownload={handleDownloadWhisper}
          />
          <OllamaRow
            status={status}
            skipped={ollamaSkipped}
            onAction={handleOllamaCta}
          />
        </ul>

        <div className="ob-footer">
          <button
            type="button"
            className="ob-skip"
            onClick={handleSkipOllama}
          >
            Skip — use raw transcripts
          </button>
          <button
            type="button"
            className="ob-cta"
            disabled={!ctaEnabled}
            onClick={handleFinish}
          >
            Get Started
          </button>
        </div>
      </main>
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function Hero() {
  return (
    <div className="ob-hero" data-tauri-drag-region>
      <div className="ob-icon" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="64" height="64">
          <rect width="64" height="64" rx="14" fill="#1c1c1e" />
          <g fill="#ffffff">
            <rect x="14" y="26" width="4" height="12" rx="2" />
            <rect x="22" y="22" width="4" height="20" rx="2" />
            <rect x="30" y="18" width="4" height="28" rx="2" />
            <rect x="38" y="22" width="4" height="20" rx="2" />
            <rect x="46" y="26" width="4" height="12" rx="2" />
          </g>
        </svg>
      </div>
      <h1 className="ob-title">Welcome to Fluister</h1>
      <p className="ob-subtitle">
        Hold <kbd>Right ⌥</kbd> anywhere, talk, release. Your voice becomes
        text — every step runs on your machine.
      </p>
    </div>
  );
}

function ChecklistRow({
  state,
  title,
  description,
  badge,
  children,
}: {
  state: RowState;
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li className="ob-row" data-state={state}>
      <div className="ob-row-icon" data-state={state} />
      <div className="ob-row-body">
        <div className="ob-row-title">
          {title}
          {badge}
        </div>
        {description && <div className="ob-row-desc">{description}</div>}
      </div>
      {children}
    </li>
  );
}

function MicrophoneRow({
  status,
  requesting,
  onGrant,
}: {
  status: OnboardingStatus | null;
  requesting: boolean;
  onGrant: () => void;
}) {
  if (!status) {
    return (
      <ChecklistRow
        state="loading"
        title="Microphone access"
        description="Required to capture what you say."
      />
    );
  }
  if (status.microphone === "authorized") {
    return (
      <ChecklistRow
        state="ok"
        title="Microphone access"
        description="Required to capture what you say."
      />
    );
  }
  const label =
    status.microphone === "not-determined" ? "Grant access" : "Open Settings";
  return (
    <ChecklistRow
      state="warn"
      title="Microphone access"
      description="Required to capture what you say."
    >
      <button
        type="button"
        className="ob-row-btn"
        onClick={onGrant}
        disabled={requesting}
      >
        {label}
      </button>
    </ChecklistRow>
  );
}

function AccessibilityRow({
  status,
  onOpen,
}: {
  status: OnboardingStatus | null;
  onOpen: () => void;
}) {
  if (!status) {
    return (
      <ChecklistRow
        state="loading"
        title="Accessibility access"
        description="Needed for the global hotkey and for pasting into other apps."
      />
    );
  }
  if (status.accessibility) {
    return (
      <ChecklistRow
        state="ok"
        title="Accessibility access"
        description="Needed for the global hotkey and for pasting into other apps."
      />
    );
  }
  return (
    <ChecklistRow
      state="warn"
      title="Accessibility access"
      description="Needed for the global hotkey and for pasting into other apps."
    >
      <button type="button" className="ob-row-btn" onClick={onOpen}>
        Open Settings
      </button>
    </ChecklistRow>
  );
}

function LanguageRow({
  language,
  onChange,
}: {
  language: string;
  onChange: (code: string) => void;
}) {
  return (
    <ChecklistRow
      state="ok"
      title="Spoken language"
      description="You can change this any time in Settings."
    >
      <select
        className="ob-row-select"
        aria-label="Spoken language"
        value={language}
        onChange={(e) => onChange(e.target.value)}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </ChecklistRow>
  );
}

function WhisperRow({
  ready,
  downloading,
  downloadPct,
  language,
  onDownload,
}: {
  ready: boolean;
  downloading: boolean;
  downloadPct: number;
  language: string;
  onDownload: () => void;
}) {
  const description = `${recommendedWhisperLabel(language)} · ~${RECOMMENDED_SIZE_MB} MB.`;

  if (ready) {
    return (
      <ChecklistRow state="ok" title="Whisper model" description={description} />
    );
  }
  return (
    <ChecklistRow state="warn" title="Whisper model" description={description}>
      {downloading ? (
        <div className="ob-progress">
          <div className="ob-progress-bar">
            <div
              className="ob-progress-fill"
              style={{ width: `${downloadPct}%` }}
            />
          </div>
          <div className="ob-progress-pct">{downloadPct}%</div>
        </div>
      ) : (
        <button type="button" className="ob-row-btn" onClick={onDownload}>
          Download · {RECOMMENDED_SIZE_MB} MB
        </button>
      )}
    </ChecklistRow>
  );
}

function OllamaRow({
  status,
  skipped,
  onAction,
}: {
  status: OnboardingStatus | null;
  skipped: boolean;
  onAction: () => void;
}) {
  const badge = <span className="ob-row-badge">optional</span>;

  if (!status) {
    return (
      <ChecklistRow
        state="loading"
        title="Ollama"
        badge={badge}
        description="Polishes filler words and punctuation. Runs locally."
      />
    );
  }

  if (skipped || (status.ollama_running && status.ollama_has_models)) {
    return (
      <ChecklistRow
        state="ok"
        title="Ollama"
        badge={badge}
        description="Polishes filler words and punctuation. Runs locally."
      />
    );
  }

  if (status.ollama_running && !status.ollama_has_models) {
    return (
      <ChecklistRow
        state="warn"
        title="Ollama"
        badge={badge}
        description={
          <>
            Ollama is running but no models are pulled. Run{" "}
            <code>ollama pull llama3.2</code> in Terminal.
          </>
        }
      >
        <button type="button" className="ob-row-btn" onClick={onAction}>
          Copy pull command
        </button>
      </ChecklistRow>
    );
  }

  return (
    <ChecklistRow
      state="warn"
      title="Ollama"
      badge={badge}
      description="Polishes filler words and punctuation. Runs locally — install once and forget."
    >
      <button type="button" className="ob-row-btn secondary" onClick={onAction}>
        Get Ollama
      </button>
    </ChecklistRow>
  );
}
