import { useMemo } from "react";
import type {
  DownloadProgress,
  ModelInfo,
  Settings,
} from "../../lib/tauri";
import { LANGUAGES, languageDisplayName } from "../../languages";
import { Btn, Segmented } from "../../components/atoms";
import { Switch } from "../../components/ui/switch";
import { PrefGroup, PrefRow } from "./Pref";
import { formatBytes } from "../../lib/format";
import { cn } from "../../lib/utils";

function isEnglishOnly(code: string): boolean {
  return code === "en" || code.startsWith("en-");
}

const SILENCE_OPTIONS = [
  { value: "1000", label: "1.0s" },
  { value: "1500", label: "1.5s" },
  { value: "2000", label: "2.0s" },
  { value: "3000", label: "3.0s" },
] as const;

const DEFAULT_SILENCE_MS = 1500;

type Props = {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  whisperModels: ModelInfo[];
  downloads: Map<string, DownloadProgress>;
  onSwitchModel: (path: string) => void;
  onDownloadModel: (filename: string) => void;
  onSwitchToModelsSection: () => void;
};

export function RecordingPane({
  settings,
  updateSettings,
  whisperModels,
  downloads,
  onSwitchModel,
  onDownloadModel,
  onSwitchToModelsSection,
}: Props) {
  // Pick the closest preset for the toggle's right-hand segmented control.
  // When vad is disabled (0), fall back to the default-ish 1.5s so flipping
  // the toggle back on doesn't land on a weird value.
  const silenceValue = useMemo(() => {
    const ms = settings.vad_silence_ms || DEFAULT_SILENCE_MS;
    const found = SILENCE_OPTIONS.find((o) => Number(o.value) === ms);
    return found ? found.value : "1500";
  }, [settings.vad_silence_ms]);

  const vadEnabled = settings.vad_silence_ms > 0;

  return (
    <>
      <PrefGroup>
        <PrefRow
          label="Spoken language"
          hint="Pick the closest match for best Whisper accuracy."
        >
          <select
            value={settings.language}
            onChange={(e) => updateSettings({ language: e.target.value })}
            className="h-[26px] rounded-[5px] border-[0.5px] border-hair-strong bg-input-surface text-ink text-[13px] px-2 pr-7"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </PrefRow>

        <PrefRow
          label="Auto-stop after silence"
          hint="Stops recording if you go quiet for this long."
        >
          <div className="flex items-center gap-2.5">
            <Switch
              size="sm"
              checked={vadEnabled}
              onCheckedChange={(v) =>
                updateSettings({
                  vad_silence_ms: v ? Number(silenceValue) : 0,
                })
              }
            />
            <div className={cn(!vadEnabled && "opacity-40 pointer-events-none")}>
              <Segmented
                options={SILENCE_OPTIONS}
                value={silenceValue}
                onChange={(v) => updateSettings({ vad_silence_ms: Number(v) })}
                size="sm"
              />
            </div>
          </div>
        </PrefRow>
      </PrefGroup>

      <ModelLanguageWarning
        settings={settings}
        whisperModels={whisperModels}
        downloads={downloads}
        onSwitchModel={onSwitchModel}
        onDownloadModel={onDownloadModel}
        onOpenModels={onSwitchToModelsSection}
      />
    </>
  );
}

function ModelLanguageWarning({
  settings,
  whisperModels,
  downloads,
  onSwitchModel,
  onDownloadModel,
  onOpenModels,
}: {
  settings: Settings;
  whisperModels: ModelInfo[];
  downloads: Map<string, DownloadProgress>;
  onSwitchModel: (path: string) => void;
  onDownloadModel: (filename: string) => void;
  onOpenModels: () => void;
}) {
  const lang = settings.language;
  const path = settings.whisper_model_path || "";
  const usingEnglishOnlyModel = path.includes(".en.bin");
  const needsMultilingual = lang === "auto" || !isEnglishOnly(lang);

  if (!usingEnglishOnlyModel || !needsMultilingual) return null;

  const langName = languageDisplayName(lang);
  const currentFilename = path.split("/").pop() || "";
  const multiFilename = currentFilename.replace(/\.en\.bin$/, ".bin");
  const multi = whisperModels.find((m) => m.filename === multiFilename);

  let actionButton: React.ReactNode;
  if (multi?.installed) {
    actionButton = (
      <Btn size="sm" onClick={() => onSwitchModel(multi.path)}>
        Switch to {multi.label.split(" — ")[0]}
      </Btn>
    );
  } else if (multi) {
    const isDownloading = downloads.has(multi.filename);
    actionButton = (
      <Btn
        size="sm"
        disabled={isDownloading}
        onClick={() => onDownloadModel(multi.filename)}
      >
        Download · {formatBytes(multi.size_bytes)}
      </Btn>
    );
  } else {
    actionButton = (
      <Btn size="sm" onClick={onOpenModels}>
        Open Models
      </Btn>
    );
  }

  return (
    <div className="pref-group" style={{ borderColor: "var(--color-amber)" }}>
      <div className="pref-row" style={{ alignItems: "center" }}>
        <div className="pref-row-label" style={{ color: "var(--color-amber-ink)" }}>
          ⚠︎ Model mismatch
        </div>
        <div className="pref-row-control flex items-center justify-between gap-3">
          <div className="text-[13px] leading-snug">
            <strong className="font-medium">{langName}</strong> needs the
            multilingual model — the current model is English-only.
          </div>
          {actionButton}
        </div>
      </div>
    </div>
  );
}
