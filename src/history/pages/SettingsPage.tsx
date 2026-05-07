import { useCallback, useEffect, useRef, useState } from "react";
import {
  commands,
  type DownloadProgress,
  type ModelDownloadDone,
  type ModelDownloadFailed,
  type ModelInfo,
  type Settings,
  type Theme,
} from "../../lib/tauri";
import { useTauriEvent } from "../../lib/hooks";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { GeneralPane } from "../panes/GeneralPane";
import { RecordingPane } from "../panes/RecordingPane";
import { ModelsPane } from "../panes/ModelsPane";
import { AboutPane } from "../panes/AboutPane";
import { PageLayout } from "./HistoryPage";

type SettingsTab = "general" | "recording" | "models" | "about";

function applyTheme(theme: Theme) {
  const effective =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.setAttribute("data-theme", effective);
}

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("general");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [whisperModels, setWhisperModels] = useState<ModelInfo[]>([]);
  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(
    () => new Map(),
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const saveTimer = useRef<number | undefined>(undefined);
  const statusTimer = useRef<number | undefined>(undefined);

  // Load settings + whisper models on mount.
  useEffect(() => {
    let cancelled = false;
    Promise.all([commands.getSettings(), commands.listWhisperModels()])
      .then(([s, m]) => {
        if (cancelled) return;
        setSettings(s);
        setWhisperModels(m);
      })
      .catch((err) => console.error("settings load failed", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshWhisperModels = useCallback(async () => {
    try {
      const m = await commands.listWhisperModels();
      setWhisperModels(m);
    } catch (err) {
      console.error("list_whisper_models failed", err);
    }
  }, []);

  const showStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
    window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(
      () => setStatusMessage(null),
      1200,
    );
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((curr) => {
        if (!curr) return curr;
        const next = { ...curr, ...patch };
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(async () => {
          try {
            await commands.updateSettings(next);
            showStatus("Saved");
          } catch (err) {
            console.error("update_settings failed", err);
            showStatus("Save failed");
          }
        }, 400);
        return next;
      });
    },
    [showStatus],
  );

  const handleThemeChange = useCallback(
    (theme: Theme) => {
      applyTheme(theme);
      updateSettings({ theme });
    },
    [updateSettings],
  );

  const beginDownload = useCallback(async (filename: string) => {
    setDownloads((curr) => {
      const next = new Map(curr);
      next.set(filename, {
        filename,
        downloaded: 0,
        total: 0,
        bytes_per_sec: 0,
      });
      return next;
    });
    try {
      await commands.downloadWhisperModel(filename);
    } catch (err) {
      console.error("download_whisper_model failed", err);
      setDownloads((curr) => {
        const next = new Map(curr);
        next.delete(filename);
        return next;
      });
    }
  }, []);

  const useWhisperModel = useCallback(
    async (path: string) => {
      try {
        await commands.setActiveWhisperModel(path);
        await refreshWhisperModels();
        const fresh = await commands.getSettings();
        setSettings(fresh);
        showStatus("Model switched");
      } catch (err) {
        console.error("set_active_whisper_model failed", err);
      }
    },
    [refreshWhisperModels, showStatus],
  );

  useTauriEvent<DownloadProgress>("model-download-progress", (e) => {
    setDownloads((curr) => {
      const next = new Map(curr);
      next.set(e.payload.filename, e.payload);
      return next;
    });
  });

  useTauriEvent<ModelDownloadDone>("model-download-done", async (e) => {
    setDownloads((curr) => {
      const next = new Map(curr);
      next.delete(e.payload.filename);
      return next;
    });
    try {
      const s = await commands.getSettings();
      const stillEnglishOnly = s.whisper_model_path.includes(".en.bin");
      const needsMulti =
        s.language === "auto" || !s.language.startsWith("en");
      if (stillEnglishOnly && needsMulti) {
        await commands.setActiveWhisperModel(e.payload.path);
      }
      await refreshWhisperModels();
      const after = await commands.getSettings();
      setSettings(after);
      showStatus("Model installed");
    } catch (err) {
      console.error(err);
      await refreshWhisperModels();
    }
  });

  useTauriEvent<ModelDownloadFailed>("model-download-failed", (e) => {
    setDownloads((curr) => {
      const next = new Map(curr);
      next.delete(e.payload.filename);
      return next;
    });
    showStatus(`Download failed: ${e.payload.error}`);
  });

  useTauriEvent<unknown>("models-changed", () => {
    refreshWhisperModels();
  });

  // Listen for the popover's "Settings" entry — switch to the General tab.
  useTauriEvent<unknown>("show-settings", () => {
    setTab("general");
  });

  return (
    <PageLayout title="Settings">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as SettingsTab)}
        className="flex-1 min-h-0 flex flex-col"
      >
        <TabsList className="mx-6 mt-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="recording">Recording</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 scrollable">
          {settings ? (
            <>
              <TabsContent value="general">
                <GeneralPane
                  settings={settings}
                  updateSettings={updateSettings}
                  onThemeChange={handleThemeChange}
                />
              </TabsContent>
              <TabsContent value="recording">
                <RecordingPane
                  settings={settings}
                  updateSettings={updateSettings}
                  whisperModels={whisperModels}
                  downloads={downloads}
                  onSwitchModel={useWhisperModel}
                  onDownloadModel={beginDownload}
                  onSwitchToModelsSection={() => setTab("models")}
                />
              </TabsContent>
              <TabsContent value="models">
                <ModelsPane
                  settings={settings}
                  updateSettings={updateSettings}
                  whisperModels={whisperModels}
                  downloads={downloads}
                  onSwitchModel={useWhisperModel}
                  onDownloadModel={beginDownload}
                />
              </TabsContent>
              <TabsContent value="about">
                <AboutPane />
              </TabsContent>
            </>
          ) : null}

          <div
            aria-live="polite"
            className={`mt-4 text-xs text-muted-foreground transition-opacity ${
              statusMessage ? "opacity-100" : "opacity-0"
            }`}
          >
            {statusMessage ?? ""}
          </div>
        </div>
      </Tabs>
    </PageLayout>
  );
}
