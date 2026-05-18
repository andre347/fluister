import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdaterPhase =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "up-to-date"; checkedAt: number }
  | { kind: "available"; update: Update }
  | { kind: "downloading"; update: Update; downloaded: number; total: number | null }
  | { kind: "installing"; update: Update }
  | { kind: "error"; message: string };

export interface UpdaterState {
  phase: UpdaterPhase;
  dismissed: boolean;
  runCheck: () => Promise<void>;
  installAndRestart: () => Promise<void>;
  dismissBanner: () => void;
}

interface UseUpdaterStateOptions {
  /** Run a silent `check()` once shortly after mount. */
  checkOnMount?: boolean;
}

/**
 * Shared updater state. Built around a phase machine so both the silent
 * check (kicked off on launch) and the manual "Check for updates…" button
 * in the About pane share one source of truth.
 *
 * Errors are swallowed into the `error` phase rather than thrown — a
 * silent check shouldn't disrupt app launch if the network or the GitHub
 * release endpoint is unreachable.
 */
function useUpdaterState({ checkOnMount = false }: UseUpdaterStateOptions = {}): UpdaterState {
  const [phase, setPhase] = useState<UpdaterPhase>({ kind: "idle" });
  const [dismissed, setDismissed] = useState(false);

  // The Update object isn't serialisable into state cleanly across
  // re-renders for some Tauri versions; keep a live reference so
  // `installAndRestart` can find it without racing the setState queue.
  const updateRef = useRef<Update | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runCheck = useCallback(async () => {
    setDismissed(false);
    setPhase({ kind: "checking" });
    try {
      const update = await check();
      if (!mountedRef.current) return;
      if (update) {
        updateRef.current = update;
        setPhase({ kind: "available", update });
      } else {
        updateRef.current = null;
        setPhase({ kind: "up-to-date", checkedAt: Date.now() });
      }
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("updater check failed", err);
      setPhase({ kind: "error", message: String(err) });
    }
  }, []);

  const installAndRestart = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;
    setPhase({ kind: "downloading", update, downloaded: 0, total: null });
    try {
      await update.downloadAndInstall((event) => {
        if (!mountedRef.current) return;
        if (event.event === "Started") {
          setPhase({
            kind: "downloading",
            update,
            downloaded: 0,
            total: event.data.contentLength ?? null,
          });
        } else if (event.event === "Progress") {
          setPhase((curr) => {
            if (curr.kind !== "downloading") return curr;
            return { ...curr, downloaded: curr.downloaded + event.data.chunkLength };
          });
        } else if (event.event === "Finished") {
          setPhase({ kind: "installing", update });
        }
      });
      await relaunch();
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("updater install failed", err);
      setPhase({ kind: "error", message: String(err) });
    }
  }, []);

  const dismissBanner = useCallback(() => setDismissed(true), []);

  useEffect(() => {
    if (!checkOnMount) return;
    // Stagger the check so it doesn't block first paint.
    const t = window.setTimeout(() => {
      runCheck();
    }, 800);
    return () => window.clearTimeout(t);
  }, [checkOnMount, runCheck]);

  return { phase, dismissed, runCheck, installAndRestart, dismissBanner };
}

const UpdaterCtx = createContext<UpdaterState | null>(null);

export function UpdaterProvider({ children }: { children: ReactNode }) {
  const value = useUpdaterState({ checkOnMount: true });
  return createElement(UpdaterCtx.Provider, { value }, children);
}

export function useUpdater(): UpdaterState {
  const ctx = useContext(UpdaterCtx);
  if (!ctx) {
    throw new Error("useUpdater must be used inside <UpdaterProvider>");
  }
  return ctx;
}
