import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ExternalLink,
} from "lucide-react";
import {
  commands,
  type DownloadProgress,
  type ModelDownloadDone,
  type ModelDownloadFailed,
  type ModelInfo,
  type OllamaModel,
  type OnboardingStatus,
} from "../lib/tauri";
import {
  useTauriEvent,
  useThemeFromSettings,
  useWindowFocus,
} from "../lib/hooks";
import { LANGUAGES, isEnglishLanguage } from "../languages";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

const STATUS_POLL_MS = 1500;

type StepId = 0 | 1 | 2 | 3;

const STEPS: { id: StepId; label: string }[] = [
  { id: 0, label: "Permissions" },
  { id: 1, label: "Model" },
  { id: 2, label: "AI cleanup" },
  { id: 3, label: "Done" },
];

type ModelSize = "tiny" | "base" | "small" | "medium";

interface ModelChoice {
  size: ModelSize;
  label: string;
  hint: string;
  sizeMb: string;
}

const MODEL_CHOICES: ModelChoice[] = [
  { size: "tiny", label: "Tiny", sizeMb: "75 MB", hint: "fastest" },
  { size: "base", label: "Base", sizeMb: "142 MB", hint: "recommended" },
  { size: "small", label: "Small", sizeMb: "466 MB", hint: "higher accuracy" },
  { size: "medium", label: "Medium", sizeMb: "1.5 GB", hint: "best for jargon" },
];

function filenameFor(size: ModelSize, language: string): string {
  return isEnglishLanguage(language)
    ? `ggml-${size}.en.bin`
    : `ggml-${size}.bin`;
}

export function App() {
  const [step, setStep] = useState<StepId>(0);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [whisperModels, setWhisperModels] = useState<ModelInfo[]>([]);
  const [language, setLanguage] = useState<string>("en-US");
  const [pickedSize, setPickedSize] = useState<ModelSize>("base");
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [downloadPct, setDownloadPct] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [micRequesting, setMicRequesting] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [ollamaSkipped, setOllamaSkipped] = useState(false);

  useThemeFromSettings(refreshTick);

  // Poll permissions + status every 1.5s plus refresh on window focus.
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
    const id = window.setInterval(load, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [refreshTick]);

  useWindowFocus(() => setRefreshTick((n) => n + 1));

  // Load local Ollama model list when entering step 3 + on focus there.
  useEffect(() => {
    if (step !== 2) return;
    let cancelled = false;
    commands
      .listOllamaModels()
      .then((m) => {
        if (!cancelled) setOllamaModels(m);
      })
      .catch(() => {
        if (!cancelled) setOllamaModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [step, refreshTick]);

  // Download progress & lifecycle.
  useTauriEvent<DownloadProgress>("model-download-progress", (e) => {
    const p = e.payload;
    if (downloadingFileRef.current !== p.filename) return;
    const pct =
      p.total > 0
        ? Math.min(100, Math.floor((p.downloaded / p.total) * 100))
        : 0;
    setDownloadPct(pct);
  });

  useTauriEvent<ModelDownloadDone>("model-download-done", async (e) => {
    if (downloadingFileRef.current !== e.payload.filename) return;
    setDownloadingFile(null);
    setDownloadPct(0);
    try {
      await commands.setActiveWhisperModel(e.payload.path);
    } catch (err) {
      console.error("set_active_whisper_model failed", err);
    }
    setRefreshTick((n) => n + 1);
    // Auto-advance once the chosen model is in.
    setStep((s) => (s === 1 ? 2 : s));
  });

  useTauriEvent<ModelDownloadFailed>("model-download-failed", (e) => {
    if (downloadingFileRef.current !== e.payload.filename) return;
    setDownloadingFile(null);
    setDownloadPct(0);
    console.error("download failed", e.payload.error);
    setRefreshTick((n) => n + 1);
  });

  // Keep a ref for the event listeners so they read the live filename.
  const downloadingFileRef = useRef<string | null>(null);
  useEffect(() => {
    downloadingFileRef.current = downloadingFile;
  }, [downloadingFile]);

  // Memoised: which Whisper model file would the chosen size + language pick?
  const targetFilename = useMemo(
    () => filenameFor(pickedSize, language),
    [pickedSize, language],
  );

  const targetInstalled = useMemo(
    () => whisperModels.some((m) => m.filename === targetFilename && m.installed),
    [whisperModels, targetFilename],
  );

  const activeWhisper = useMemo(
    () => whisperModels.find((m) => m.active) ?? null,
    [whisperModels],
  );

  // ─── Action handlers ────────────────────────────────────────────────────

  const handleGrantMic = useCallback(async () => {
    setMicRequesting(true);
    try {
      await commands.requestMicrophoneAccess();
    } catch (err) {
      console.error(err);
    }
    setMicRequesting(false);
    setRefreshTick((n) => n + 1);
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

  const handleLanguageChange = useCallback(async (newLang: string) => {
    setLanguage(newLang);
    try {
      const current = await commands.getSettings();
      await commands.updateSettings({ ...current, language: newLang });
    } catch (err) {
      console.error("save language failed", err);
    }
  }, []);

  const handleDownload = useCallback(async () => {
    setDownloadingFile(targetFilename);
    setDownloadPct(0);
    try {
      await commands.downloadWhisperModel(targetFilename);
    } catch (err) {
      console.error("download failed", err);
      setDownloadingFile(null);
    }
  }, [targetFilename]);

  const handleSetWhisperActive = useCallback(async () => {
    const target = whisperModels.find((m) => m.filename === targetFilename);
    if (!target) return;
    try {
      await commands.setActiveWhisperModel(target.path);
      setRefreshTick((n) => n + 1);
    } catch (err) {
      console.error("set_active_whisper_model failed", err);
    }
  }, [whisperModels, targetFilename]);

  const handleFinish = useCallback(() => {
    commands.finishOnboarding().catch((err) => {
      console.error("finish_onboarding failed", err);
    });
  }, []);

  const goNext = useCallback(() => {
    setStep((s) => (s < 3 ? ((s + 1) as StepId) : s));
  }, []);

  const goBack = useCallback(() => {
    setStep((s) => (s > 0 ? ((s - 1) as StepId) : s));
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────

  const permsReady =
    !!status && status.microphone === "authorized" && status.accessibility;

  return (
    <div className="ob-shell">
      <div className="ob-titlebar" data-tauri-drag-region />

      <div className="ob-stepper">
        {STEPS.map((s, i) => {
          const state =
            s.id < step ? "done" : s.id === step ? "current" : "future";
          return (
            <div key={s.id} className="ob-step-wrap">
              <div className={cn("ob-step-node", `ob-step-${state}`)}>
                {state === "done" ? <Check size={11} aria-hidden /> : i + 1}
              </div>
              <span className={cn("ob-step-label", `ob-step-label-${state}`)}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <div className="ob-step-line" />}
            </div>
          );
        })}
      </div>

      <main className="ob-step-body">
        {step === 0 && (
          <PermissionsStep
            status={status}
            micRequesting={micRequesting}
            onGrantMic={handleGrantMic}
            onOpenAccessibility={handleOpenAccessibility}
          />
        )}
        {step === 1 && (
          <ModelStep
            pickedSize={pickedSize}
            onPick={setPickedSize}
            language={language}
            onLanguageChange={handleLanguageChange}
            downloading={downloadingFile !== null}
            downloadPct={downloadPct}
            targetInstalled={targetInstalled}
          />
        )}
        {step === 2 && (
          <OllamaStep
            status={status}
            ollamaModels={ollamaModels}
            skipped={ollamaSkipped}
            onSkip={() => setOllamaSkipped(true)}
            onUnskip={() => setOllamaSkipped(false)}
          />
        )}
        {step === 3 && (
          <DoneStep
            language={language}
            activeWhisper={activeWhisper}
            status={status}
            ollamaSkipped={ollamaSkipped}
          />
        )}
      </main>

      <footer className="ob-footer">
        <span className="ob-footer-step">
          step {step + 1} of {STEPS.length}
        </span>
        <div className="ob-footer-actions">
          {step > 0 && step < 3 && (
            <Button variant="ghost" size="sm" onClick={goBack} className="h-9 px-4 gap-1.5">
              <ChevronLeft size={14} aria-hidden />
              <span>Back</span>
            </Button>
          )}
          {step === 0 && (
            <Button
              size="sm"
              disabled={!permsReady}
              onClick={goNext}
              className="h-9 px-4 gap-1.5"
            >
              <span>Continue</span>
              <ArrowRight size={14} aria-hidden />
            </Button>
          )}
          {step === 1 && (
            targetInstalled ? (
              <Button
                size="sm"
                onClick={async () => {
                  await handleSetWhisperActive();
                  goNext();
                }}
                className="h-9 px-4 gap-1.5"
              >
                <span>Continue</span>
                <ArrowRight size={14} aria-hidden />
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={downloadingFile !== null}
                onClick={handleDownload}
                className="h-9 px-4 gap-1.5"
              >
                {downloadingFile !== null ? (
                  <span>Downloading… {downloadPct}%</span>
                ) : (
                  <>
                    <span>Download &amp; continue</span>
                    <ArrowRight size={14} aria-hidden />
                  </>
                )}
              </Button>
            )
          )}
          {step === 2 && (
            <Button
              size="sm"
              onClick={goNext}
              className="h-9 px-4 gap-1.5"
            >
              <span>Continue</span>
              <ArrowRight size={14} aria-hidden />
            </Button>
          )}
          {step === 3 && (
            <Button size="sm" onClick={handleFinish} className="h-9 px-5">
              Start dictating
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

// ─── Steps ─────────────────────────────────────────────────────────────────

function PermissionsStep({
  status,
  micRequesting,
  onGrantMic,
  onOpenAccessibility,
}: {
  status: OnboardingStatus | null;
  micRequesting: boolean;
  onGrantMic: () => void;
  onOpenAccessibility: () => void;
}) {
  const micGranted = status?.microphone === "authorized";
  const a11yGranted = !!status?.accessibility;

  return (
    <StepLayout
      title="Grant a few permissions"
      subtitle="Fluister needs the microphone to capture audio and accessibility access for the global hotkey + paste."
    >
      <div className="ob-perm-grid">
        <PermCard
          title="Microphone"
          description="So Fluister can record what you say."
          granted={micGranted}
          actionLabel={
            status?.microphone === "not-determined" ? "Grant access" : "Open Settings"
          }
          actionDisabled={micRequesting}
          onAction={onGrantMic}
        />
        <PermCard
          title="Accessibility"
          description="For the Right ⌥ hotkey and synthetic ⌘V paste."
          granted={a11yGranted}
          actionLabel="Open Settings"
          onAction={onOpenAccessibility}
        />
      </div>
    </StepLayout>
  );
}

function PermCard({
  title,
  description,
  granted,
  actionLabel,
  actionDisabled,
  onAction,
}: {
  title: string;
  description: string;
  granted: boolean;
  actionLabel: string;
  actionDisabled?: boolean;
  onAction: () => void;
}) {
  return (
    <div className={cn("ob-perm-card", granted && "ob-perm-card-granted")}>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="text-body font-semibold text-foreground">{title}</div>
        <span
          className={cn(
            "text-tag font-medium uppercase tracking-wider",
            granted ? "text-[color:var(--color-success)]" : "text-faint",
          )}
        >
          {granted ? "Granted" : "Not granted"}
        </span>
      </div>
      <p className="text-footnote text-text-muted leading-snug mb-4">
        {description}
      </p>
      {granted ? (
        <Button
          variant="ghost"
          size="sm"
          disabled
          className="h-8 w-full pointer-events-none gap-1.5"
        >
          <Check size={13} aria-hidden />
          <span>Done</span>
        </Button>
      ) : (
        <Button
          variant="default"
          size="sm"
          onClick={onAction}
          disabled={actionDisabled}
          className="h-8 w-full"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

function ModelStep({
  pickedSize,
  onPick,
  language,
  onLanguageChange,
  downloading,
  downloadPct,
  targetInstalled,
}: {
  pickedSize: ModelSize;
  onPick: (s: ModelSize) => void;
  language: string;
  onLanguageChange: (code: string) => void;
  downloading: boolean;
  downloadPct: number;
  targetInstalled: boolean;
}) {
  return (
    <StepLayout
      title="Pick a Whisper model"
      subtitle="Whisper runs on your Mac's GPU. Bigger model = better accuracy, more disk + RAM."
    >
      <div className="flex flex-col gap-4">
        <div className="ob-language">
          <label className="text-footnote text-text-muted" htmlFor="ob-lang">
            Spoken language
          </label>
          <select
            id="ob-lang"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="ob-select"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          {MODEL_CHOICES.map((m) => (
            <button
              type="button"
              key={m.size}
              onClick={() => onPick(m.size)}
              disabled={downloading}
              className={cn(
                "ob-model-row",
                pickedSize === m.size && "ob-model-row-selected",
              )}
            >
              <span
                className={cn(
                  "ob-radio",
                  pickedSize === m.size && "ob-radio-on",
                )}
                aria-hidden
              />
              <span className="text-body font-medium text-foreground flex-1 text-left">
                {m.label}
              </span>
              <span className="text-footnote text-text-muted font-mono">
                {m.sizeMb}
              </span>
              <span className="text-footnote text-text-muted ml-3 w-[120px] text-right">
                {m.hint}
              </span>
            </button>
          ))}
        </div>

        {downloading && (
          <div className="ob-progress">
            <div className="ob-progress-bar">
              <div
                className="ob-progress-fill"
                style={{ width: `${downloadPct}%` }}
              />
            </div>
            <span className="ob-progress-pct">{downloadPct}%</span>
          </div>
        )}

        {!downloading && targetInstalled && (
          <div className="text-footnote text-[color:var(--color-success)] flex items-center gap-1.5">
            <Check size={12} aria-hidden />
            <span>Already installed</span>
          </div>
        )}
      </div>
    </StepLayout>
  );
}

function OllamaStep({
  status,
  ollamaModels,
  skipped,
  onSkip,
  onUnskip,
}: {
  status: OnboardingStatus | null;
  ollamaModels: OllamaModel[];
  skipped: boolean;
  onSkip: () => void;
  onUnskip: () => void;
}) {
  const running = !!status?.ollama_running;

  return (
    <StepLayout
      title="AI cleanup (optional)"
      subtitle="Ollama runs an LLM locally to remove fillers, fix punctuation, and apply the active profile's style. You can skip this and add it later."
    >
      {skipped ? (
        <div className="ob-card text-center">
          <p className="text-body text-foreground mb-3">
            You'll get the raw transcript — no cleanup.
          </p>
          <Button variant="ghost" size="sm" onClick={onUnskip} className="h-8">
            Change my mind
          </Button>
        </div>
      ) : running && ollamaModels.length > 0 ? (
        <div className="ob-card">
          <div className="text-body font-medium text-foreground mb-1">
            Ollama is running.
          </div>
          <p className="text-footnote text-text-muted mb-3">
            {ollamaModels.length} model{ollamaModels.length === 1 ? "" : "s"} installed.
            Cleanup will use whichever model you select in Settings.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ollamaModels.slice(0, 6).map((m) => (
              <span
                key={m.name}
                className="text-caption rounded-md bg-[color:var(--color-elev)] px-2 py-1"
              >
                {m.name}
              </span>
            ))}
          </div>
        </div>
      ) : running ? (
        <div className="ob-card">
          <div className="text-body font-medium text-foreground mb-1">
            Ollama is running, but no models are pulled.
          </div>
          <p className="text-footnote text-text-muted mb-3">
            In Terminal:{" "}
            <code className="bg-[color:var(--color-elev)] px-1.5 py-0.5 rounded font-mono text-tag">
              ollama pull llama3.2
            </code>
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="h-8 w-full"
          >
            Skip for now
          </Button>
        </div>
      ) : (
        <div className="ob-card">
          <div className="text-body font-medium text-foreground mb-1">
            Install Ollama to enable AI cleanup.
          </div>
          <p className="text-footnote text-text-muted mb-3">
            It's a small free app that runs LLMs locally. Once installed, pull a
            model like <code className="bg-[color:var(--color-elev)] px-1.5 py-0.5 rounded font-mono text-tag">llama3.2</code> and Fluister picks it up automatically.
          </p>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() =>
                commands.openExternalUrl("https://ollama.com").catch(() => {})
              }
              className="h-8 flex-1 gap-1.5"
            >
              <ExternalLink size={13} aria-hidden />
              <span>Get Ollama</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="h-8 flex-1"
            >
              Skip for now
            </Button>
          </div>
        </div>
      )}
    </StepLayout>
  );
}

function DoneStep({
  language,
  activeWhisper,
  status,
  ollamaSkipped,
}: {
  language: string;
  activeWhisper: ModelInfo | null;
  status: OnboardingStatus | null;
  ollamaSkipped: boolean;
}) {
  const langName = LANGUAGES.find((l) => l.code === language)?.name ?? language;
  const ollamaSummary = ollamaSkipped
    ? "Skipped — enable later in Settings"
    : status?.ollama_running && status.ollama_has_models
      ? "Ready"
      : status?.ollama_running
        ? "Running, no models yet"
        : "Not installed";

  return (
    <div className="flex flex-col items-center text-center px-12 pt-2">
      <div className="ob-done-check" aria-hidden>
        <Check size={28} strokeWidth={3} />
      </div>
      <h1 className="text-display font-semibold text-foreground mt-4 mb-2">
        You're set.
      </h1>
      <p className="text-footnote text-text-muted max-w-[420px] mb-6">
        Hold <kbd className="font-mono text-tag bg-[color:var(--color-elev)] px-1 py-0.5 rounded">Right ⌥</kbd> anywhere on macOS, speak, release.
      </p>
      <ul className="ob-summary">
        <SummaryRow
          label="Whisper model"
          value={activeWhisper?.label ?? "—"}
        />
        <SummaryRow label="Language" value={langName} />
        <SummaryRow
          label="Microphone"
          value={status?.microphone === "authorized" ? "Granted" : "Not granted"}
        />
        <SummaryRow
          label="Accessibility"
          value={status?.accessibility ? "Granted" : "Not granted"}
        />
        <SummaryRow label="Ollama (cleanup)" value={ollamaSummary} />
      </ul>
    </div>
  );
}

function StepLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ob-step-content">
      <h1 className="ob-step-title">{title}</h1>
      <p className="ob-step-subtitle">{subtitle}</p>
      <div className="ob-step-form">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="ob-summary-row">
      <span className="text-footnote text-text-muted">{label}</span>
      <span className="text-footnote text-foreground font-medium">{value}</span>
    </li>
  );
}
