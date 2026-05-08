import { useCallback, useEffect, useRef, useState } from "react";
import {
  commands,
  type DownloadProgress,
  type ModelInfo,
  type OllamaModel,
  type Settings,
} from "../../lib/tauri";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Switch } from "../../components/ui/switch";
import { cn } from "../../lib/utils";
import { formatBytes } from "../../lib/format";

type Props = {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  whisperModels: ModelInfo[];
  downloads: Map<string, DownloadProgress>;
  onSwitchModel: (path: string) => void;
  onDownloadModel: (filename: string) => void;
};

export function ModelsPane({
  settings,
  updateSettings,
  whisperModels,
  downloads,
  onSwitchModel,
  onDownloadModel,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Whisper</CardTitle>
          <CardDescription>
            Pick a size and language family. Multilingual models work for any
            language.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {whisperModels.map((m) => (
            <WhisperModelRow
              key={m.filename}
              model={m}
              download={downloads.get(m.filename)}
              onUse={onSwitchModel}
              onDownload={onDownloadModel}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI cleanup</CardTitle>
          <CardDescription>
            Use Ollama to remove fillers and add punctuation.
          </CardDescription>
          <CardAction>
            <Switch
              checked={settings.cleanup_enabled}
              onCheckedChange={(v) => updateSettings({ cleanup_enabled: v })}
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <OllamaPicker
            currentModel={settings.ollama_model}
            onChange={(value) => updateSettings({ ollama_model: value })}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function WhisperModelRow({
  model,
  download,
  onUse,
  onDownload,
}: {
  model: ModelInfo;
  download: DownloadProgress | undefined;
  onUse: (path: string) => void;
  onDownload: (filename: string) => void;
}) {
  let action: React.ReactNode;
  if (download) {
    const pct =
      download.total > 0
        ? Math.min(100, Math.floor((download.downloaded / download.total) * 100))
        : 0;
    action = (
      <div className="flex items-center gap-2 min-w-[120px]">
        <div className="h-1 flex-1 rounded bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground tabular-nums w-8 text-right">
          {pct}%
        </div>
      </div>
    );
  } else if (model.active) {
    action = (
      <Button size="sm" variant="secondary" disabled>
        Active
      </Button>
    );
  } else if (model.installed) {
    action = (
      <Button size="sm" variant="secondary" onClick={() => onUse(model.path)}>
        Use
      </Button>
    );
  } else {
    action = (
      <Button size="sm" onClick={() => onDownload(model.filename)}>
        Download · {formatBytes(model.size_bytes)}
      </Button>
    );
  }

  let meta: string;
  if (download) {
    const downloaded = formatBytes(download.downloaded);
    const total = formatBytes(download.total);
    const speed =
      download.bytes_per_sec > 0
        ? ` · ${formatBytes(download.bytes_per_sec)}/s`
        : "";
    meta = `${downloaded} / ${total}${speed}`;
  } else {
    const tags = [
      model.installed ? "Installed" : "Not installed",
      model.multilingual ? "99 languages" : "English only",
    ];
    meta = `${formatBytes(model.size_bytes)} · ${tags.join(" · ")}`;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2",
        model.active ? "border-primary/40 bg-primary/5" : "border-border",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{model.label}</div>
        <div className="text-xs text-muted-foreground">{meta}</div>
      </div>
      {action}
    </div>
  );
}

type OllamaState =
  | { kind: "loading" }
  | { kind: "ok"; models: OllamaModel[]; missingCurrent: string | null }
  | { kind: "no-models" }
  | { kind: "no-ollama" };

function OllamaPicker({
  currentModel,
  onChange,
}: {
  currentModel: string;
  onChange: (value: string) => void;
}) {
  const [state, setState] = useState<OllamaState>({ kind: "loading" });
  const currentModelRef = useRef(currentModel);
  useEffect(() => {
    currentModelRef.current = currentModel;
  }, [currentModel]);

  const refresh = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const models = await commands.listOllamaModels();
      if (models.length === 0) {
        setState({ kind: "no-models" });
        return;
      }
      const current = currentModelRef.current;
      const installed = new Set(models.map((m) => m.name));
      const missing = current && !installed.has(current) ? current : null;
      setState({ kind: "ok", models, missingCurrent: missing });
    } catch {
      setState({ kind: "no-ollama" });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  let options: { value: string; label: string; fallback?: boolean }[] = [];
  let disabled = false;
  let status: { text: string; error: boolean } | null = null;

  if (state.kind === "loading") {
    options = currentModel
      ? [{ value: currentModel, label: currentModel, fallback: true }]
      : [];
    disabled = true;
  } else if (state.kind === "ok") {
    options = state.models.map((m) => ({
      value: m.name,
      label: m.parameter_size ? `${m.name}  ·  ${m.parameter_size}` : m.name,
    }));
    if (state.missingCurrent) {
      options.push({
        value: state.missingCurrent,
        label: `${state.missingCurrent}  ·  not installed`,
        fallback: true,
      });
      status = {
        text: `${state.missingCurrent} isn't installed locally. Pick another or run \`ollama pull ${state.missingCurrent}\`.`,
        error: true,
      };
    }
  } else if (state.kind === "no-models") {
    if (currentModel) {
      options = [{ value: currentModel, label: currentModel, fallback: true }];
    }
    disabled = true;
    status = {
      text: "Ollama is running but you haven't pulled any models. Run `ollama pull llama3.2` in Terminal.",
      error: false,
    };
  } else {
    if (currentModel) {
      options = [{ value: currentModel, label: currentModel, fallback: true }];
    }
    disabled = true;
    status = {
      text: "Ollama isn't running. Start it from Ollama.app or run `ollama serve` in Terminal.",
      error: true,
    };
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium text-muted-foreground">
        Ollama model
      </div>
      <div className="flex items-center gap-2">
        <select
          disabled={disabled}
          value={currentModel}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs",
            "disabled:cursor-not-allowed disabled:opacity-60",
            "focus:outline-none focus:ring-2 focus:ring-ring",
          )}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label="Refresh model list"
          onClick={refresh}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
            <path
              fill="currentColor"
              d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.74 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z"
            />
          </svg>
        </Button>
      </div>
      {status && (
        <p
          className={cn(
            "text-xs leading-snug",
            status.error ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {status.text}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Models you've already pulled. Run{" "}
        <code className="bg-muted rounded px-1 py-0.5">
          {"ollama pull <name>"}
        </code>{" "}
        to add more.
      </p>
    </div>
  );
}
