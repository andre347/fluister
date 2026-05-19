import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  commands,
  type LlmBackend,
  type LlmDownloadDone,
  type LlmDownloadFailed,
  type LlmDownloadProgress,
  type LlmModelInfo,
  type OllamaModel,
  type Settings,
} from "../../lib/tauri";
import { Btn, Segmented } from "../../components/atoms";
import { Switch } from "../../components/ui/switch";
import { PrefGroup, PrefRow } from "./Pref";
import { formatBytes } from "../../lib/format";
import { cn } from "../../lib/utils";

const BACKEND_OPTIONS: { value: LlmBackend; label: string }[] = [
  { value: "bundled", label: "Bundled" },
  { value: "external_ollama", label: "Ollama" },
];

type Props = {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
};

export function CleanupPane({ settings, updateSettings }: Props) {
  const cleanup = settings.cleanup_enabled;
  const backend = settings.llm_backend;

  return (
    <>
      <PrefGroup>
        <PrefRow
          label="AI cleanup"
          hint="Removes fillers, fixes punctuation, applies the active profile's style."
        >
          <Switch
            size="sm"
            checked={cleanup}
            onCheckedChange={(v) => updateSettings({ cleanup_enabled: v })}
          />
        </PrefRow>

        <PrefRow
          label="Backend"
          hint={
            backend === "bundled"
              ? "Runs entirely on your Mac. No data leaves the device."
              : "Defers to a separately installed Ollama daemon at 127.0.0.1:11434."
          }
        >
          <div className={cn(!cleanup && "opacity-40 pointer-events-none")}>
            <Segmented
              options={BACKEND_OPTIONS}
              value={backend}
              onChange={(v) => updateSettings({ llm_backend: v })}
              size="sm"
            />
          </div>
        </PrefRow>
      </PrefGroup>

      <PrefGroup
        title={backend === "bundled" ? "Bundled model" : "Ollama model"}
      >
        {backend === "bundled" ? (
          <BundledLlmRows disabled={!cleanup} />
        ) : (
          <OllamaRows
            disabled={!cleanup}
            currentModel={settings.ollama_model}
            onChange={(value) => updateSettings({ ollama_model: value })}
          />
        )}
      </PrefGroup>
    </>
  );
}

function BundledLlmRows({ disabled }: { disabled: boolean }) {
  const [models, setModels] = useState<LlmModelInfo[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadPct, setDownloadPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await commands.listLlmModels();
      setModels(list);
    } catch (e) {
      console.error("listLlmModels failed", e);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const downloadingIdRef = useRef<string | null>(null);
  useEffect(() => {
    downloadingIdRef.current = downloadingId;
  }, [downloadingId]);

  useEffect(() => {
    const unlistens: Array<() => void> = [];
    listen<LlmDownloadProgress>("llm-download-progress", (e) => {
      if (downloadingIdRef.current !== e.payload.id) return;
      const pct =
        e.payload.total > 0
          ? Math.min(
              100,
              Math.floor((e.payload.downloaded / e.payload.total) * 100),
            )
          : 0;
      setDownloadPct(pct);
    }).then((un) => unlistens.push(un));
    listen<LlmDownloadDone>("llm-download-done", async (e) => {
      if (downloadingIdRef.current !== e.payload.id) return;
      setDownloadingId(null);
      setDownloadPct(0);
      try {
        await commands.setActiveLlmModel(e.payload.path);
      } catch (err) {
        console.error("set_active_llm_model failed", err);
      }
      refresh();
    }).then((un) => unlistens.push(un));
    listen<LlmDownloadFailed>("llm-download-failed", (e) => {
      if (downloadingIdRef.current !== e.payload.id) return;
      setDownloadingId(null);
      setDownloadPct(0);
      setError(e.payload.error);
    }).then((un) => unlistens.push(un));
    return () => {
      unlistens.forEach((un) => un());
    };
  }, [refresh]);

  const handleDownload = useCallback(async (id: string) => {
    setError(null);
    setDownloadingId(id);
    setDownloadPct(0);
    try {
      await commands.downloadLlmModel(id);
    } catch (e) {
      console.error("downloadLlmModel failed", e);
      setDownloadingId(null);
      setError(String(e));
    }
  }, []);

  if (models.length === 0) {
    return (
      <PrefRow label="Loading…">
        <span className="pref-row-hint">Discovering local models…</span>
      </PrefRow>
    );
  }

  return (
    <div className={cn(disabled && "opacity-40 pointer-events-none")}>
      {models.map((m) => {
        const isDownloading = downloadingId === m.id;
        let action: React.ReactNode;
        if (isDownloading) {
          action = (
            <div className="flex items-center gap-2 min-w-[140px]">
              <div className="h-1 flex-1 rounded bg-fill overflow-hidden">
                <div
                  className="h-full bg-amber transition-[width]"
                  style={{ width: `${downloadPct}%` }}
                />
              </div>
              <span className="text-[11px] text-ink-3 tabular-nums w-8 text-right">
                {downloadPct}%
              </span>
            </div>
          );
        } else if (m.installed) {
          action = (
            <Btn size="sm" onClick={() => handleDownload(m.id)}>
              Re-download
            </Btn>
          );
        } else {
          action = (
            <Btn size="sm" onClick={() => handleDownload(m.id)}>
              Download · {formatBytes(m.size_bytes)}
            </Btn>
          );
        }
        return (
          <PrefRow
            key={m.id}
            label={m.label}
            hint={`${formatBytes(m.size_bytes)} · ${m.installed ? "Installed" : "Not installed"}`}
          >
            {action}
          </PrefRow>
        );
      })}
      {error && (
        <PrefRow label="Error">
          <span className="text-[12px] text-red">{error}</span>
        </PrefRow>
      )}
    </div>
  );
}

type OllamaState =
  | { kind: "loading" }
  | { kind: "ok"; models: OllamaModel[]; missingCurrent: string | null }
  | { kind: "no-models" }
  | { kind: "no-ollama" };

function OllamaRows({
  disabled,
  currentModel,
  onChange,
}: {
  disabled: boolean;
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

  let options: { value: string; label: string }[] = [];
  let selectDisabled = false;
  let status: { text: string; error: boolean } | null = null;

  if (state.kind === "loading") {
    options = currentModel ? [{ value: currentModel, label: currentModel }] : [];
    selectDisabled = true;
  } else if (state.kind === "ok") {
    options = state.models.map((m) => ({
      value: m.name,
      label: m.parameter_size ? `${m.name}  ·  ${m.parameter_size}` : m.name,
    }));
    if (state.missingCurrent) {
      options.push({
        value: state.missingCurrent,
        label: `${state.missingCurrent}  ·  not installed`,
      });
      status = {
        text: `${state.missingCurrent} isn't installed. Run \`ollama pull ${state.missingCurrent}\`.`,
        error: true,
      };
    }
  } else if (state.kind === "no-models") {
    if (currentModel) options = [{ value: currentModel, label: currentModel }];
    selectDisabled = true;
    status = {
      text: "Ollama is running but you haven't pulled any models. Run `ollama pull llama3.2`.",
      error: false,
    };
  } else {
    if (currentModel) options = [{ value: currentModel, label: currentModel }];
    selectDisabled = true;
    status = {
      text: "Ollama isn't running. Start Ollama.app or run `ollama serve`.",
      error: true,
    };
  }

  return (
    <div className={cn(disabled && "opacity-40 pointer-events-none")}>
      <PrefRow
        label="Model"
        hint={
          status ? (
            <span className={status.error ? "text-red" : undefined}>
              {status.text}
            </span>
          ) : (
            <>
              Run{" "}
              <code className="bg-fill rounded px-1 py-[1px] font-fl-mono">
                ollama pull &lt;name&gt;
              </code>{" "}
              to add more.
            </>
          )
        }
      >
        <div className="flex items-center gap-2">
          <select
            disabled={selectDisabled}
            value={currentModel}
            onChange={(e) => onChange(e.target.value)}
            className="h-[26px] rounded-[5px] border-[0.5px] border-hair-strong bg-input-surface text-ink text-[13px] px-2 pr-7 disabled:opacity-60"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Btn size="sm" kind="plain" onClick={refresh} aria-label="Refresh">
            ↻
          </Btn>
        </div>
      </PrefRow>
    </div>
  );
}
