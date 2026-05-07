import { useEffect, useRef } from "react";
import { listen, type EventCallback } from "@tauri-apps/api/event";
import { commands, type Theme } from "./tauri";

/**
 * Subscribe to a Tauri event. Handler can be a fresh closure each render —
 * we keep it in a ref so we never resubscribe on identity changes.
 */
export function useTauriEvent<T>(name: string, handler: EventCallback<T>) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    const unlisten = listen<T>(name, (event) => handlerRef.current(event));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [name]);
}

function applyEffectiveTheme(choice: Theme) {
  const effective =
    choice === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : choice;
  document.documentElement.setAttribute("data-theme", effective);
}

/**
 * Read the user's theme choice from settings and apply it to <html> as
 * `[data-theme="light"|"dark"]`. We always set an explicit value (even
 * for "system") so Tailwind's dark: variant — which we wire to
 * [data-theme="dark"] — fires under macOS dark mode.
 *
 * Re-runs whenever `trigger` changes. When the user has chosen "system",
 * also subscribes to OS theme changes for live updates.
 */
export function useThemeFromSettings(trigger: unknown = null) {
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    commands
      .getSettings()
      .then((s) => {
        if (cancelled) return;
        applyEffectiveTheme(s.theme);

        if (s.theme === "system") {
          const mq = window.matchMedia("(prefers-color-scheme: dark)");
          const handler = () => applyEffectiveTheme("system");
          mq.addEventListener("change", handler);
          unsubscribe = () => mq.removeEventListener("change", handler);
        }
      })
      .catch(() => {
        applyEffectiveTheme("system");
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [trigger]);
}

/**
 * Calls `cb` whenever the window regains focus. Used by popover to
 * refresh content on each show, since hiding doesn't unmount.
 */
export function useWindowFocus(cb: () => void) {
  const cbRef = useRef(cb);
  useEffect(() => {
    cbRef.current = cb;
  });
  useEffect(() => {
    const handler = () => cbRef.current();
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, []);
}
