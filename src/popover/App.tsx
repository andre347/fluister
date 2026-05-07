import { useCallback, useEffect, useState } from "react";
import {
  commands,
  type Dictation,
  type Profile,
  type UpdateStatus,
} from "../lib/tauri";
import {
  useTauriEvent,
  useThemeFromSettings,
  useWindowFocus,
} from "../lib/hooks";

type RecentsState =
  | { kind: "loading" }
  | { kind: "ready"; items: Dictation[] }
  | { kind: "error" };

type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "result"; status: UpdateStatus }
  | { kind: "error" };

type View = "menu" | "profiles";

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.max(1, Math.floor(diff / 1000));
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}h ago`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function App() {
  const [view, setView] = useState<View>("menu");
  const [focusCount, setFocusCount] = useState(0);
  const [recents, setRecents] = useState<RecentsState>({ kind: "loading" });
  const [version, setVersion] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateState>({ kind: "idle" });
  const [flashId, setFlashId] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);

  useThemeFromSettings(focusCount);
  useWindowFocus(() => {
    setFocusCount((n) => n + 1);
    setView("menu"); // always reset to top-level on (re)show
  });

  // Recents — refresh on each show.
  useEffect(() => {
    let cancelled = false;
    commands
      .listDictations({
        limit: 7,
        offset: 0,
        favoritesOnly: false,
        search: null,
      })
      .then((items) => {
        if (!cancelled) setRecents({ kind: "ready", items });
      })
      .catch(() => {
        if (!cancelled) setRecents({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [focusCount]);

  // Profiles + active id — refresh on each show + on profiles-changed.
  const reloadProfiles = useCallback(() => {
    Promise.all([commands.listProfiles(), commands.getSettings()])
      .then(([list, s]) => {
        setProfiles(list);
        setActiveProfileId(s.active_profile_id);
      })
      .catch((err) => console.error("profiles load failed", err));
  }, []);
  useEffect(() => {
    reloadProfiles();
  }, [focusCount, reloadProfiles]);

  useTauriEvent<unknown>("profiles-changed", () => reloadProfiles());

  // App version: load once.
  useEffect(() => {
    commands
      .appVersion()
      .then((v) => setVersion(v))
      .catch(() => setVersion(null));
  }, []);

  // Esc — close popover from menu, back to menu from profiles.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (view === "profiles") {
        e.preventDefault();
        setView("menu");
      } else {
        commands.closePopover().catch(() => {});
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view]);

  const handleCopy = useCallback((id: number) => {
    commands
      .copyDictation(id)
      .then(() => {
        setFlashId(id);
        setTimeout(
          () => setFlashId((current) => (current === id ? null : current)),
          600,
        );
      })
      .catch((err) => console.error("copy_dictation failed", err));
  }, []);

  const handleCheckUpdates = useCallback(() => {
    setUpdate({ kind: "checking" });
    commands
      .checkForUpdates()
      .then((status) => setUpdate({ kind: "result", status }))
      .catch(() => setUpdate({ kind: "error" }));
  }, []);

  const handleSelectProfile = useCallback(async (id: number) => {
    try {
      await commands.setActiveProfile(id);
      setActiveProfileId(id);
    } catch (err) {
      console.error("set_active_profile failed", err);
    }
    setView("menu");
  }, []);

  const activeProfileName =
    profiles.find((p) => p.id === activeProfileId)?.name ??
    profiles.find((p) => p.name.toLowerCase() === "default")?.name ??
    "Default";

  return (
    <div className="popover">
      {view === "menu" ? (
        <MenuView
          recents={recents}
          flashId={flashId}
          onCopy={handleCopy}
          activeProfileName={activeProfileName}
          onOpenProfiles={() => setView("profiles")}
          version={version}
          update={update}
          onCheckUpdates={handleCheckUpdates}
        />
      ) : (
        <ProfilesView
          profiles={profiles}
          activeProfileId={activeProfileId}
          onBack={() => setView("menu")}
          onSelect={handleSelectProfile}
        />
      )}
    </div>
  );
}

// ─── Views ──────────────────────────────────────────────────────────────────

function MenuView({
  recents,
  flashId,
  onCopy,
  activeProfileName,
  onOpenProfiles,
  version,
  update,
  onCheckUpdates,
}: {
  recents: RecentsState;
  flashId: number | null;
  onCopy: (id: number) => void;
  activeProfileName: string;
  onOpenProfiles: () => void;
  version: string | null;
  update: UpdateState;
  onCheckUpdates: () => void;
}) {
  return (
    <>
      <div className="menu-section">
        <div className="menu-caption">Recent</div>
        <div className="menu-list scrollable">
          <RecentsSection state={recents} flashId={flashId} onCopy={onCopy} />
        </div>
      </div>

      <div className="menu-separator" />

      <div className="menu-section">
        <button
          type="button"
          className="menu-item flex items-center justify-between gap-2"
          onClick={onOpenProfiles}
        >
          <span>Profile</span>
          <span className="flex items-center gap-1.5 text-text-muted">
            <span className="truncate max-w-[160px]">{activeProfileName}</span>
            <ChevronRightIcon />
          </span>
        </button>
      </div>

      <div className="menu-separator" />

      <div className="menu-section">
        <button
          type="button"
          className="menu-item"
          onClick={() => commands.openHistory().catch(() => {})}
        >
          Open History
        </button>
        <button
          type="button"
          className="menu-item"
          onClick={() => commands.openSettingsFromPopover().catch(() => {})}
        >
          Settings
        </button>
      </div>

      <div className="menu-separator" />

      <div className="menu-section">
        <div className="menu-item disabled">
          {version ? `Fluister v${version}` : "Fluister"}
        </div>
        <div
          className={
            update.kind === "checking"
              ? "menu-item disabled checking"
              : "menu-item disabled"
          }
        >
          {updateStatusLabel(update)}
        </div>
        <button type="button" className="menu-item" onClick={onCheckUpdates}>
          Check for updates
        </button>
      </div>

      <div className="menu-separator" />

      <div className="menu-section">
        <button
          type="button"
          className="menu-item"
          onClick={() => commands.quitApp().catch(() => {})}
        >
          Quit Fluister
        </button>
      </div>
    </>
  );
}

function ProfilesView({
  profiles,
  activeProfileId,
  onBack,
  onSelect,
}: {
  profiles: Profile[];
  activeProfileId: number | null;
  onBack: () => void;
  onSelect: (id: number) => void;
}) {
  return (
    <>
      <div className="menu-section">
        <button
          type="button"
          className="menu-item flex items-center gap-2"
          onClick={onBack}
        >
          <ChevronLeftIcon />
          <span>Profiles</span>
        </button>
      </div>

      <div className="menu-separator" />

      <div className="menu-section">
        <div className="menu-list scrollable">
          {profiles.length === 0 ? (
            <div className="menu-empty">No profiles</div>
          ) : (
            profiles.map((p) => {
              const isActive = p.id === activeProfileId;
              return (
                <button
                  key={p.id}
                  type="button"
                  className="menu-item flex items-center justify-between gap-2"
                  onClick={() => onSelect(p.id)}
                >
                  <span className="truncate">{p.name}</span>
                  {isActive && (
                    <span className="text-text-muted shrink-0">
                      <CheckIcon />
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

function updateStatusLabel(state: UpdateState): string {
  switch (state.kind) {
    case "idle":
      return "Latest version";
    case "checking":
      return "Checking…";
    case "result":
      return state.status.up_to_date
        ? "Latest version"
        : `Update available: v${state.status.latest_version}`;
    case "error":
      return "Couldn't check";
  }
}

function RecentsSection({
  state,
  flashId,
  onCopy,
}: {
  state: RecentsState;
  flashId: number | null;
  onCopy: (id: number) => void;
}) {
  if (state.kind === "loading") {
    return <div className="menu-empty">Loading…</div>;
  }
  if (state.kind === "error") {
    return <div className="menu-empty">Couldn&apos;t load history</div>;
  }
  if (state.items.length === 0) {
    return <div className="menu-empty">No dictations yet</div>;
  }
  return (
    <>
      {state.items.map((d) => (
        <button
          key={d.id}
          type="button"
          className={
            flashId === d.id ? "menu-item recent flash" : "menu-item recent"
          }
          onClick={() => onCopy(d.id)}
        >
          <span className="text">{d.cleaned_text}</span>
          <span className="meta">{formatRelative(d.created_at)}</span>
        </button>
      ))}
    </>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5.5 3 11 8.5 5.5 14l-1-1 4.5-4.5L4.5 4l1-1Z"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10.5 3 5 8.5 10.5 14l1-1L7 8.5 11.5 4l-1-1Z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 11.4 2.6 8 1.5 9.1 6 13.6 14.5 5.1 13.4 4 6 11.4Z"
      />
    </svg>
  );
}
