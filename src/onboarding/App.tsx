import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Eye,
  FolderOpen,
  HardDrive,
  Keyboard,
  Mic,
  Sparkles,
} from "lucide-react";

// Tiny icon wrappers so the permission row markup stays self-documenting.
const MicIcon = () => <Mic size={18} strokeWidth={1.6} aria-hidden />;
const KeyboardIcon = () => <Keyboard size={18} strokeWidth={1.6} aria-hidden />;
const EyeIcon = () => <Eye size={18} strokeWidth={1.6} aria-hidden />;
import {
  commands,
  type DownloadProgress,
  type LlmDownloadDone,
  type LlmDownloadFailed,
  type LlmDownloadProgress,
  type LlmModelInfo,
  type ModelDownloadDone,
  type ModelDownloadFailed,
  type ModelInfo,
  type OnboardingStatus,
  type OverlayPosition,
  type VaultStatus,
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

type StepId = 0 | 1 | 2 | 3 | 4 | 5;

const STEPS: { id: StepId; label: string }[] = [
  { id: 0, label: "Permissions" },
  { id: 1, label: "Overlay" },
  { id: 2, label: "Model" },
  { id: 3, label: "AI cleanup" },
  { id: 4, label: "Storage" },
  { id: 5, label: "Done" },
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
  const [llmModels, setLlmModels] = useState<LlmModelInfo[]>([]);
  const [llmDownloadingId, setLlmDownloadingId] = useState<string | null>(null);
  const [llmDownloadPct, setLlmDownloadPct] = useState(0);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [llmSkipped, setLlmSkipped] = useState(false);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
  const [vaultDefault, setVaultDefault] = useState<string | null>(null);
  const [vaultBusy, setVaultBusy] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [vaultSkipped, setVaultSkipped] = useState(false);

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

  // Load vault status + default suggestion once.
  useEffect(() => {
    let cancelled = false;
    Promise.all([commands.vaultStatus(), commands.suggestedVaultPath()])
      .then(([s, def]) => {
        if (cancelled) return;
        setVaultStatus(s);
        setVaultDefault(def);
      })
      .catch((err) => console.error("vault status load failed", err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the bundled LLM catalog when entering the cleanup step.
  useEffect(() => {
    if (step !== 2) return;
    let cancelled = false;
    commands
      .listLlmModels()
      .then((m) => {
        if (!cancelled) setLlmModels(m);
      })
      .catch(() => {
        if (!cancelled) setLlmModels([]);
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
    setStep((s) => (s === 2 ? 3 : s));
  });

  useTauriEvent<ModelDownloadFailed>("model-download-failed", (e) => {
    if (downloadingFileRef.current !== e.payload.filename) return;
    setDownloadingFile(null);
    setDownloadPct(0);
    console.error("download failed", e.payload.error);
    setRefreshTick((n) => n + 1);
  });

  // ─── Bundled LLM (cleanup model) download lifecycle ─────────────────────

  const llmDownloadingIdRef = useRef<string | null>(null);
  useEffect(() => {
    llmDownloadingIdRef.current = llmDownloadingId;
  }, [llmDownloadingId]);

  useTauriEvent<LlmDownloadProgress>("llm-download-progress", (e) => {
    const p = e.payload;
    if (llmDownloadingIdRef.current !== p.id) return;
    const pct =
      p.total > 0
        ? Math.min(100, Math.floor((p.downloaded / p.total) * 100))
        : 0;
    setLlmDownloadPct(pct);
  });

  useTauriEvent<LlmDownloadDone>("llm-download-done", async (e) => {
    if (llmDownloadingIdRef.current !== e.payload.id) return;
    setLlmDownloadingId(null);
    setLlmDownloadPct(0);
    try {
      await commands.setActiveLlmModel(e.payload.path);
    } catch (err) {
      console.error("set_active_llm_model failed", err);
    }
    setRefreshTick((n) => n + 1);
    // Auto-advance once the model is ready.
    setStep((s) => (s === 3 ? 4 : s));
  });

  useTauriEvent<LlmDownloadFailed>("llm-download-failed", (e) => {
    if (llmDownloadingIdRef.current !== e.payload.id) return;
    setLlmDownloadingId(null);
    setLlmDownloadPct(0);
    setLlmError(e.payload.error);
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

  const handleGrantInputMonitoring = useCallback(async () => {
    // IOHIDRequestAccess shows the system prompt the first time it's
    // called. If the user has already denied, the call is a no-op and
    // we open System Settings to let them flip the toggle manually.
    try {
      await commands.requestInputMonitoringAccess();
    } catch (err) {
      console.error(err);
    }
    setRefreshTick((n) => n + 1);
    const fresh = await commands.onboardingStatus().catch(() => null);
    if (fresh && !fresh.input_monitoring) {
      await commands.openPrivacyPanel("input-monitoring").catch(() => {});
    }
  }, []);

  const handleOverlayPositionChange = useCallback(async (next: OverlayPosition) => {
    try {
      const current = await commands.getSettings();
      // The Rust update_settings handler emits a brief preview of the pill
      // at the new position automatically, so the user gets immediate
      // feedback without us having to wire the preview event manually.
      await commands.updateSettings({ ...current, overlay_position: next });
    } catch (err) {
      console.error("update_settings (overlay_position) failed", err);
    }
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

  const handleDownloadLlm = useCallback(async () => {
    const entry = llmModels[0];
    if (!entry) return;
    setLlmError(null);
    setLlmDownloadingId(entry.id);
    setLlmDownloadPct(0);
    try {
      await commands.downloadLlmModel(entry.id);
    } catch (err) {
      console.error("download_llm_model failed", err);
      setLlmDownloadingId(null);
      setLlmError(String(err));
    }
  }, [llmModels]);

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

  const handleSetVault = useCallback(async (path: string) => {
    setVaultBusy(true);
    setVaultError(null);
    try {
      const next = await commands.setVaultPath(path);
      setVaultStatus(next);
      setVaultSkipped(false);
    } catch (err) {
      console.error("set_vault_path failed", err);
      setVaultError(String(err));
    } finally {
      setVaultBusy(false);
    }
  }, []);

  const handlePickVault = useCallback(async () => {
    setVaultError(null);
    try {
      const picked = await openDialog({
        directory: true,
        multiple: false,
        title: "Choose a folder for your Fluister vault",
      });
      if (typeof picked !== "string") return;
      await handleSetVault(picked);
    } catch (err) {
      console.error("vault picker failed", err);
      setVaultError(String(err));
    }
  }, [handleSetVault]);

  const goNext = useCallback(() => {
    setStep((s) => (s < 5 ? ((s + 1) as StepId) : s));
  }, []);

  const goBack = useCallback(() => {
    setStep((s) => (s > 0 ? ((s - 1) as StepId) : s));
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────

  const permsReady =
    !!status
    && status.microphone === "authorized"
    && status.accessibility
    && status.input_monitoring;

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
            onGrantInputMonitoring={handleGrantInputMonitoring}
          />
        )}
        {step === 1 && <OverlayStep onChange={handleOverlayPositionChange} />}
        {step === 2 && (
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
        {step === 3 && (
          <LlmStep
            llmModels={llmModels}
            llmHasModel={!!status?.has_llm_model}
            downloading={llmDownloadingId !== null}
            downloadPct={llmDownloadPct}
            error={llmError}
            skipped={llmSkipped}
            onDownload={handleDownloadLlm}
            onSkip={() => setLlmSkipped(true)}
            onUnskip={() => setLlmSkipped(false)}
          />
        )}
        {step === 4 && (
          <StorageStep
            status={vaultStatus}
            defaultPath={vaultDefault}
            busy={vaultBusy}
            error={vaultError}
            skipped={vaultSkipped}
            onUseDefault={() => {
              if (vaultDefault) handleSetVault(vaultDefault);
            }}
            onPick={handlePickVault}
            onSkip={() => setVaultSkipped(true)}
            onUnskip={() => setVaultSkipped(false)}
          />
        )}
        {step === 5 && (
          <DoneStep
            language={language}
            activeWhisper={activeWhisper}
            status={status}
            llmSkipped={llmSkipped}
            vaultStatus={vaultStatus}
          />
        )}
      </main>

      <footer className="ob-footer">
        <span className="ob-footer-step">
          step {step + 1} of {STEPS.length}
        </span>
        <div className="ob-footer-actions">
          {step > 0 && step < 5 && (
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
            <Button size="sm" onClick={goNext} className="h-9 px-4 gap-1.5">
              <span>Continue</span>
              <ArrowRight size={14} aria-hidden />
            </Button>
          )}
          {step === 2 && (
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
          {step === 3 && (
            status?.has_llm_model || llmSkipped ? (
              <Button
                size="sm"
                onClick={goNext}
                className="h-9 px-4 gap-1.5"
              >
                <span>Continue</span>
                <ArrowRight size={14} aria-hidden />
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={llmDownloadingId !== null || llmModels.length === 0}
                onClick={handleDownloadLlm}
                className="h-9 px-4 gap-1.5"
              >
                {llmDownloadingId !== null ? (
                  <span>Downloading… {llmDownloadPct}%</span>
                ) : (
                  <>
                    <span>Download &amp; continue</span>
                    <ArrowRight size={14} aria-hidden />
                  </>
                )}
              </Button>
            )
          )}
          {step === 4 && (
            <Button
              size="sm"
              onClick={goNext}
              disabled={vaultBusy}
              className="h-9 px-4 gap-1.5"
            >
              <span>Continue</span>
              <ArrowRight size={14} aria-hidden />
            </Button>
          )}
          {step === 5 && (
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
  onGrantInputMonitoring,
}: {
  status: OnboardingStatus | null;
  micRequesting: boolean;
  onGrantMic: () => void;
  onOpenAccessibility: () => void;
  onGrantInputMonitoring: () => void;
}) {
  const micGranted = status?.microphone === "authorized";
  const a11yGranted = !!status?.accessibility;
  const inputMonitoringGranted = !!status?.input_monitoring;

  return (
    <StepLayout
      title="Grant a few permissions"
      subtitle="Fluister needs the microphone to capture audio, accessibility for synthetic ⌘V paste, and input monitoring so the global hotkey works while you're in other apps."
    >
      <div className="ob-perm-list">
        <PermCard
          icon={<MicIcon />}
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
          icon={<KeyboardIcon />}
          title="Accessibility"
          description="For pasting transcriptions via synthetic ⌘V."
          granted={a11yGranted}
          actionLabel="Open Settings"
          onAction={onOpenAccessibility}
        />
        <PermCard
          icon={<EyeIcon />}
          title="Input Monitoring"
          description="So the Right ⌥ hotkey fires anywhere, not just in Fluister."
          granted={inputMonitoringGranted}
          actionLabel="Open Settings"
          onAction={onGrantInputMonitoring}
        />
      </div>
    </StepLayout>
  );
}

function PermCard({
  icon,
  title,
  description,
  granted,
  actionLabel,
  actionDisabled,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  granted: boolean;
  actionLabel: string;
  actionDisabled?: boolean;
  onAction: () => void;
}) {
  return (
    <div className={cn("ob-perm-row", granted && "ob-perm-row-granted")}>
      <div className="ob-perm-row-icon" aria-hidden>
        {icon}
      </div>
      <div className="ob-perm-row-text">
        <div className="ob-perm-row-title">{title}</div>
        <div className="ob-perm-row-desc">{description}</div>
      </div>
      <div className="ob-perm-row-status">
        {granted ? (
          <span className="ob-perm-pill ob-perm-pill-granted">
            <Check size={11} strokeWidth={2.5} aria-hidden />
            Granted
          </span>
        ) : (
          <span className="ob-perm-pill ob-perm-pill-pending">
            Not granted
          </span>
        )}
      </div>
      <div className="ob-perm-row-action">
        {!granted && (
          <Button
            variant="default"
            size="sm"
            onClick={onAction}
            disabled={actionDisabled}
            className="h-7 px-3"
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

const OVERLAY_POSITIONS: { value: OverlayPosition; row: 0 | 1; col: 0 | 1 | 2; label: string }[] = [
  { value: "top-left", row: 0, col: 0, label: "Top left" },
  { value: "top-center", row: 0, col: 1, label: "Top center" },
  { value: "top-right", row: 0, col: 2, label: "Top right" },
  { value: "bottom-left", row: 1, col: 0, label: "Bottom left" },
  { value: "bottom-center", row: 1, col: 1, label: "Bottom center" },
  { value: "bottom-right", row: 1, col: 2, label: "Bottom right" },
];

function OverlayStep({ onChange }: { onChange: (next: OverlayPosition) => void }) {
  const [selected, setSelected] = useState<OverlayPosition>("bottom-right");

  // Snap the saved value to "bottom-right" on first mount but also seed
  // from settings so re-entering the step shows whatever the user last
  // picked. update_settings on the Rust side will flash a preview, so
  // we don't need to do anything else.
  useEffect(() => {
    let cancelled = false;
    commands.getSettings().then((s) => {
      if (cancelled) return;
      setSelected(s.overlay_position);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const pick = useCallback((value: OverlayPosition) => {
    setSelected(value);
    onChange(value);
  }, [onChange]);

  return (
    <StepLayout
      title="Where should the recording pill appear?"
      subtitle="A small floating pill shows up while you dictate. Pick a corner — you can change it later in Settings."
    >
      <div
        role="radiogroup"
        aria-label="Overlay position"
        className="ob-overlay-screen"
      >
        {OVERLAY_POSITIONS.map((p) => {
          const active = selected === p.value;
          return (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={p.label}
              onClick={() => pick(p.value)}
              className={cn("ob-overlay-dot", active && "ob-overlay-dot-active")}
              style={{
                gridRow: p.row + 1,
                gridColumn: p.col + 1,
              }}
            >
              <span className="ob-overlay-pill" />
            </button>
          );
        })}
      </div>
      <div className="text-footnote text-text-muted text-center">
        Selected: <span className="text-foreground font-medium">
          {OVERLAY_POSITIONS.find((p) => p.value === selected)?.label}
        </span>
      </div>
    </StepLayout>
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

function LlmStep({
  llmModels,
  llmHasModel,
  downloading,
  downloadPct,
  error,
  skipped,
  onDownload,
  onSkip,
  onUnskip,
}: {
  llmModels: LlmModelInfo[];
  llmHasModel: boolean;
  downloading: boolean;
  downloadPct: number;
  error: string | null;
  skipped: boolean;
  onDownload: () => void;
  onUnskip: () => void;
  onSkip: () => void;
}) {
  const entry = llmModels[0];
  const sizeGb = entry ? (entry.size_bytes / 1_073_741_824).toFixed(1) : null;

  return (
    <StepLayout
      title="AI cleanup model"
      subtitle="Fluister includes a local LLM that removes fillers, fixes punctuation, and applies your profile's style — all on-device. It downloads once, then runs from a bundled server."
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
      ) : llmHasModel ? (
        <div className="ob-card">
          <div className="flex items-center gap-2 text-body font-medium text-foreground mb-1">
            <Check size={14} className="text-[color:var(--color-success)]" aria-hidden />
            <span>Cleanup model is ready.</span>
          </div>
          <p className="text-footnote text-text-muted">
            {entry?.label ?? "Default cleanup model"}
            {sizeGb && <span className="ml-2 font-mono text-tag">{sizeGb} GB</span>}
          </p>
        </div>
      ) : (
        <div className="ob-card">
          <div className="flex items-center gap-2 text-body font-medium text-foreground mb-1">
            <Sparkles size={14} aria-hidden />
            <span>{entry?.label ?? "Cleanup model"}</span>
            {sizeGb && (
              <span className="ml-auto font-mono text-tag text-text-muted">
                {sizeGb} GB
              </span>
            )}
          </div>
          <p className="text-footnote text-text-muted mb-3">
            One-time download. Stored locally — no data leaves your Mac.
          </p>

          {downloading && (
            <div className="ob-progress mb-3">
              <div className="ob-progress-bar">
                <div
                  className="ob-progress-fill"
                  style={{ width: `${downloadPct}%` }}
                />
              </div>
              <span className="ob-progress-pct">{downloadPct}%</span>
            </div>
          )}

          {!downloading && (
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={onDownload}
                disabled={!entry}
                className="h-8 flex-1"
              >
                Download model
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
          )}

          {error && (
            <p className="mt-3 text-footnote text-[color:var(--color-danger)]">
              {error}
            </p>
          )}
        </div>
      )}
    </StepLayout>
  );
}

function StorageStep({
  status,
  defaultPath,
  busy,
  error,
  skipped,
  onUseDefault,
  onPick,
  onSkip,
  onUnskip,
}: {
  status: VaultStatus | null;
  defaultPath: string | null;
  busy: boolean;
  error: string | null;
  skipped: boolean;
  onUseDefault: () => void;
  onPick: () => void;
  onSkip: () => void;
  onUnskip: () => void;
}) {
  const configured = status?.path != null;

  return (
    <StepLayout
      title="Where should your data live?"
      subtitle="Profiles and vocabulary become Markdown files you can edit in any text editor and sync via iCloud, Dropbox, or Git. Your dictation history stays local. Optional — you can set this up later in Settings."
    >
      {configured ? (
        <div className="ob-card">
          <div className="flex items-center gap-2 text-body font-medium text-foreground mb-1">
            <Check size={14} className="text-[color:var(--color-success)]" aria-hidden />
            <span>Vault is set up.</span>
          </div>
          <p className="text-footnote text-text-muted mb-3">
            <span className="font-mono text-tag">{status?.path}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onPick} className="h-8">
              Choose a different folder…
            </Button>
          </div>
        </div>
      ) : skipped ? (
        <div className="ob-card text-center">
          <p className="text-body text-foreground mb-3">
            Sticking with the local cache. You can set up a vault later from
            Settings → Storage.
          </p>
          <Button variant="ghost" size="sm" onClick={onUnskip} className="h-8">
            Change my mind
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="ob-card">
            <div className="flex items-center gap-2 text-body font-medium text-foreground mb-1">
              <HardDrive size={14} aria-hidden />
              <span>Use the suggested folder</span>
            </div>
            <p className="text-footnote text-text-muted mb-3">
              <span className="font-mono text-tag">
                {defaultPath ?? "~/Fluister"}
              </span>
            </p>
            <Button
              variant="default"
              size="sm"
              disabled={busy || !defaultPath}
              onClick={onUseDefault}
              className="h-8 w-full"
            >
              {busy ? "Setting up…" : "Use this folder"}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onPick}
              disabled={busy}
              className="h-8 flex-1 gap-1.5"
            >
              <FolderOpen size={13} aria-hidden />
              <span>Choose another folder…</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              disabled={busy}
              className="h-8 flex-1"
            >
              Skip for now
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-footnote text-[color:var(--color-danger)]">
          {error}
        </p>
      )}
    </StepLayout>
  );
}

function DoneStep({
  language,
  activeWhisper,
  status,
  llmSkipped,
  vaultStatus,
}: {
  language: string;
  activeWhisper: ModelInfo | null;
  status: OnboardingStatus | null;
  llmSkipped: boolean;
  vaultStatus: VaultStatus | null;
}) {
  const langName = LANGUAGES.find((l) => l.code === language)?.name ?? language;
  const llmSummary = llmSkipped
    ? "Skipped — enable later in Settings"
    : status?.has_llm_model
      ? "Ready"
      : "Not downloaded";
  const vaultSummary = vaultStatus?.path
    ? vaultStatus.path
    : "Not set up — using local cache";

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
        <SummaryRow label="Cleanup model" value={llmSummary} />
        <SummaryRow label="Vault" value={vaultSummary} />
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
