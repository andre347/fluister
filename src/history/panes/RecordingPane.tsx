import type {
  DownloadProgress,
  ModelInfo,
  Settings,
} from "../../lib/tauri";
import { LANGUAGES, languageDisplayName } from "../../languages";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { cn } from "../../lib/utils";

function isEnglishOnly(code: string): boolean {
  return code === "en" || code.startsWith("en-");
}

function formatBytes(b: number): string {
  if (b >= 1_000_000_000) return `${(b / 1_000_000_000).toFixed(1)} GB`;
  if (b >= 1_000_000) return `${Math.round(b / 1_000_000)} MB`;
  if (b >= 1_000) return `${Math.round(b / 1_000)} KB`;
  return `${b} B`;
}

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
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Spoken language</CardTitle>
          <CardDescription>
            Whisper transcribes in this language. Pick the closest match for
            best accuracy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={settings.language}
            onChange={(e) => updateSettings({ language: e.target.value })}
            className={cn(
              "h-9 w-full max-w-sm rounded-md border border-input bg-transparent px-3 text-sm shadow-xs",
              "focus:outline-none focus:ring-2 focus:ring-ring",
            )}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <ModelWarning
        settings={settings}
        whisperModels={whisperModels}
        downloads={downloads}
        onSwitchModel={onSwitchModel}
        onDownloadModel={onDownloadModel}
        onOpenModels={onSwitchToModelsSection}
      />
    </div>
  );
}

function ModelWarning({
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
      <Button size="sm" onClick={() => onSwitchModel(multi.path)}>
        Switch to {multi.label.split(" — ")[0]}
      </Button>
    );
  } else if (multi) {
    const isDownloading = downloads.has(multi.filename);
    actionButton = (
      <Button
        size="sm"
        disabled={isDownloading}
        onClick={() => onDownloadModel(multi.filename)}
      >
        Download · {formatBytes(multi.size_bytes)}
      </Button>
    );
  } else {
    actionButton = (
      <Button size="sm" variant="secondary" onClick={onOpenModels}>
        Open Models
      </Button>
    );
  }

  return (
    <Card className="border-amber-500/40 bg-amber-500/5 ring-amber-500/20">
      <CardContent className="flex items-start gap-3">
        <div className="mt-0.5 text-amber-500">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 2 1 21h22L12 2Zm0 6 7.5 13h-15L12 8Zm-1 4h2v4h-2v-4Zm0 5h2v2h-2v-2Z"
            />
          </svg>
        </div>
        <div className="flex-1 text-sm leading-relaxed">
          <strong className="font-medium">{langName}</strong> needs the
          multilingual model. The current model is English-only.
        </div>
        {actionButton}
      </CardContent>
    </Card>
  );
}
