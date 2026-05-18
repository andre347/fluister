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
  IconAbout,
  IconHotkey,
  IconMic,
  IconModels,
  IconSettings,
  IconSparkle,
  IconStorage,
} from "../../components/icons";
import { GeneralPane } from "../panes/GeneralPane";
import { RecordingPane } from "../panes/RecordingPane";
import { CleanupPane } from "../panes/CleanupPane";
import { HotkeysPane } from "../panes/HotkeysPane";
import { ModelsPane } from "../panes/ModelsPane";
import { StoragePane } from "../panes/StoragePane";
import { AboutPane } from "../panes/AboutPane";
import { cn } from "../../lib/utils";

type SettingsTab =
  | "general"
  | "recording"
  | "cleanup"
  | "hotkeys"
  | "models"
  | "storage"
  | "about";

const TABS: {
  id: SettingsTab;
  label: string;
  icon: (props: { size?: number; strokeWidth?: number }) => React.ReactNode;
}[] = [
  { id: "general",   label: "General",   icon: (p) => <IconSettings {...p} /> },
  { id: "recording", label: "Recording", icon: (p) => <IconMic {...p} /> },
  { id: "cleanup",   label: "Cleanup",   icon: (p) => <IconSparkle {...p} /> },
  { id: "hotkeys",   label: "Hotkeys",   icon: (p) => <IconHotkey {...p} /> },
  { id: "models",    label: "Models",    icon: (p) => <IconModels {...p} /> },
  { id: "storage",   label: "Storage",   icon: (p) => <IconStorage {...p} /> },
  { id: "about",     label: "About",     icon: (p) => <IconAbout {...p} /> },
];

const TAB_TITLE: Record<SettingsTab, string> = {
  general: "General",
  recording: "Recording",
  cleanup: "Cleanup",
  hotkeys: "Hotkeys",
  models: "Models",
  storage: "Storage",
  about: "About",
};

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

  const saveTimer = useRef<number | undefined>(undefined);

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

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((curr) => {
        if (!curr) return curr;
        const next = { ...curr, ...patch };
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(async () => {
          try {
            await commands.updateSettings(next);
          } catch (err) {
            console.error("update_settings failed", err);
          }
        }, 400);
        return next;
      });
    },
    [],
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
      } catch (err) {
        console.error("set_active_whisper_model failed", err);
      }
    },
    [refreshWhisperModels],
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
    console.error(`Download failed: ${e.payload.error}`);
  });

  useTauriEvent<unknown>("models-changed", () => {
    refreshWhisperModels();
  });

  useTauriEvent<unknown>("show-settings", () => {
    setTab("general");
  });

  return (
    <div className="settings-page">
      <div role="tablist" aria-label="Settings sections" className="settings-tabbar">
        {TABS.map((t) => {
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-pressed={selected}
              aria-selected={selected}
              onClick={() => setTab(t.id)}
              className={cn("settings-tab")}
            >
              {t.icon({ size: 20, strokeWidth: 1.5 })}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="settings-scroll scrollable">
        <div className="settings-inner">
          <h2 className="settings-h2">{TAB_TITLE[tab]}</h2>
          {settings ? (
            <>
              {tab === "general" && (
                <GeneralPane
                  settings={settings}
                  updateSettings={updateSettings}
                  onThemeChange={handleThemeChange}
                />
              )}
              {tab === "recording" && (
                <RecordingPane
                  settings={settings}
                  updateSettings={updateSettings}
                  whisperModels={whisperModels}
                  downloads={downloads}
                  onSwitchModel={useWhisperModel}
                  onDownloadModel={beginDownload}
                  onSwitchToModelsSection={() => setTab("models")}
                />
              )}
              {tab === "cleanup" && (
                <CleanupPane
                  settings={settings}
                  updateSettings={updateSettings}
                />
              )}
              {tab === "hotkeys" && <HotkeysPane />}
              {tab === "models" && (
                <ModelsPane
                  whisperModels={whisperModels}
                  downloads={downloads}
                  onSwitchModel={useWhisperModel}
                  onDownloadModel={beginDownload}
                />
              )}
              {tab === "storage" && <StoragePane />}
              {tab === "about" && <AboutPane />}
            </>
          ) : (
            <div className="pref-row-hint">Loading…</div>
          )}
        </div>
      </div>
    </div>
  );
}
