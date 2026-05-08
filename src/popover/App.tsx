import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ClipboardPaste, Copy, Star } from "lucide-react";
import {
  commands,
  type Dictation,
  type Profile,
  type Settings,
} from "../lib/tauri";
import {
  useTauriEvent,
  useThemeFromSettings,
  useWindowFocus,
} from "../lib/hooks";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type LastState =
  | { kind: "loading" }
  | { kind: "ready"; item: Dictation | null }
  | { kind: "error" };

function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function App() {
  const [focusCount, setFocusCount] = useState(0);
  const [last, setLast] = useState<LastState>({ kind: "loading" });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  // Mute mic isn't persisted yet — Settings has no `muted` field on the Rust
  // side. Local state keeps the toggle responsive in the popover; we'll
  // plumb persistence when the Recording settings surface lands.
  const [muted, setMuted] = useState(false);
  const [copyFlash, setCopyFlash] = useState(false);
  const [favBusy, setFavBusy] = useState(false);

  useThemeFromSettings(focusCount);
  useWindowFocus(() => setFocusCount((n) => n + 1));

  // Last dictation — refresh on each show.
  useEffect(() => {
    let cancelled = false;
    commands
      .listDictations({
        limit: 1,
        offset: 0,
        favoritesOnly: false,
        search: null,
      })
      .then((items) => {
        if (!cancelled) setLast({ kind: "ready", item: items[0] ?? null });
      })
      .catch(() => {
        if (!cancelled) setLast({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [focusCount]);

  // Profiles + settings — refresh on each show + on profile changes.
  const reload = useCallback(() => {
    Promise.all([commands.listProfiles(), commands.getSettings()])
      .then(([list, s]) => {
        setProfiles(list);
        setSettings(s);
      })
      .catch((err) => console.error("popover load failed", err));
  }, []);
  useEffect(() => reload(), [focusCount, reload]);
  useTauriEvent<unknown>("profiles-changed", () => reload());

  const lastItem = last.kind === "ready" ? last.item : null;
  const hasItem = lastItem !== null;

  const handlePaste = useCallback(() => {
    if (!lastItem) return;
    commands
      .pasteDictation(lastItem.id)
      .then(() => commands.closePopover())
      .catch((err) => console.error("paste_dictation failed", err));
  }, [lastItem]);

  const handleCopy = useCallback(() => {
    if (!lastItem) return;
    commands
      .copyDictation(lastItem.id)
      .then(() => {
        setCopyFlash(true);
        setTimeout(() => setCopyFlash(false), 700);
      })
      .catch((err) => console.error("copy_dictation failed", err));
  }, [lastItem]);

  const handleToggleFavorite = useCallback(() => {
    if (!lastItem || favBusy) return;
    setFavBusy(true);
    commands
      .toggleFavorite(lastItem.id)
      .then((favorite) => {
        setLast((prev) =>
          prev.kind === "ready" && prev.item
            ? { kind: "ready", item: { ...prev.item, favorite } }
            : prev,
        );
      })
      .catch((err) => console.error("toggle_favorite failed", err))
      .finally(() => setFavBusy(false));
  }, [lastItem, favBusy]);

  const handleSelectProfile = useCallback((id: number) => {
    commands
      .setActiveProfile(id)
      .then(() =>
        setSettings((s) => (s ? { ...s, active_profile_id: id } : s)),
      )
      .catch((err) => console.error("set_active_profile failed", err));
  }, []);

  const handleToggleCleanup = useCallback(
    (next: boolean) => {
      if (!settings) return;
      const updated = { ...settings, cleanup_enabled: next };
      setSettings(updated);
      commands.updateSettings(updated).catch((err) => {
        console.error("update_settings(cleanup) failed", err);
        setSettings(settings); // rollback
      });
    },
    [settings],
  );

  // Esc closes; ⌘V pastes; ⌘C copies. Only fire shortcuts when an item exists.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        commands.closePopover().catch(() => {});
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        if (e.key === "v" && hasItem) {
          e.preventDefault();
          handlePaste();
        } else if (e.key === "c" && hasItem) {
          e.preventDefault();
          handleCopy();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasItem, handlePaste, handleCopy]);

  const activeProfile =
    profiles.find((p) => p.id === settings?.active_profile_id) ??
    profiles.find((p) => p.name.toLowerCase() === "default") ??
    null;
  const activeProfileName = activeProfile?.name ?? "Default";

  return (
    <div className="popover">
      {/* Last dictation card + actions */}
      <div className="px-4 pt-3.5 pb-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-tag font-medium uppercase tracking-wider text-faint">
          <span>Last dictation</span>
          {lastItem && (
            <span className="font-mono normal-case tracking-normal">
              {formatClock(lastItem.created_at)}
            </span>
          )}
        </div>
        <LastDictationCard state={last} />
        <ActionRow
          disabled={!hasItem}
          favorite={lastItem?.favorite ?? false}
          copyFlash={copyFlash}
          onPaste={handlePaste}
          onCopy={handleCopy}
          onFavorite={handleToggleFavorite}
        />
      </div>

      <div className="menu-separator" />

      {/* Profile + toggles */}
      <div className="px-4 py-2.5 flex flex-col gap-1">
        <div className="flex items-center justify-between h-8 text-item">
          <span>Profile</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center gap-1 rounded-md px-2 h-6 text-caption font-medium bg-[color-mix(in_oklch,var(--color-brand)_22%,transparent)] text-[color-mix(in_oklch,var(--color-brand-strong)_92%,black)] dark:text-[color-mix(in_oklch,var(--color-brand)_92%,white)] hover:bg-[color-mix(in_oklch,var(--color-brand)_30%,transparent)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="truncate max-w-[140px]">
                {activeProfileName}
              </span>
              <ChevronDown size={11} aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="min-w-[180px]"
            >
              {profiles.length === 0 ? (
                <div className="px-2 py-1.5 text-caption text-text-muted">
                  No profiles
                </div>
              ) : (
                profiles.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => handleSelectProfile(p.id)}
                    className="justify-between"
                  >
                    <span className="truncate">{p.name}</span>
                    {p.id === activeProfile?.id && (
                      <span className="size-1.5 rounded-full bg-primary" />
                    )}
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => commands.openHistory().catch(() => {})}
              >
                Manage profiles…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <ToggleRow
          label="AI cleanup"
          checked={settings?.cleanup_enabled ?? false}
          disabled={!settings}
          onChange={handleToggleCleanup}
        />
        <ToggleRow label="Mute mic" checked={muted} onChange={setMuted} />
      </div>

      <div className="menu-separator" />

      <div className="menu-section">
        <button
          type="button"
          className="menu-item"
          onClick={() => commands.openHistory().catch(() => {})}
        >
          Open History…
        </button>
        <button
          type="button"
          className="menu-item"
          onClick={() => commands.openSettingsFromPopover().catch(() => {})}
        >
          Settings…
        </button>
      </div>

      <div className="flex-1" />

      <div className="menu-separator" />

      <div className="menu-section">
        <button
          type="button"
          className="menu-item flex items-center justify-between"
          onClick={() => commands.quitApp().catch(() => {})}
        >
          <span>Quit Fluister</span>
          <kbd className="font-mono text-tag text-faint">⌘Q</kbd>
        </button>
      </div>
    </div>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function LastDictationCard({ state }: { state: LastState }) {
  if (state.kind === "loading") {
    return (
      <CardShell>
        <span className="text-text-muted">Loading…</span>
      </CardShell>
    );
  }
  if (state.kind === "error") {
    return (
      <CardShell>
        <span className="text-text-muted">Couldn’t load history</span>
      </CardShell>
    );
  }
  if (!state.item) {
    return (
      <CardShell>
        <span className="text-text-muted">
          No dictations yet — hold{" "}
          <kbd className="font-mono text-tag bg-[color:var(--color-elev)] px-1 py-0.5 rounded">
            ⌥
          </kbd>{" "}
          to start.
        </span>
      </CardShell>
    );
  }
  return (
    <CardShell>
      <span className="line-clamp-3 leading-snug">
        {state.item.cleaned_text}
      </span>
    </CardShell>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-[color-mix(in_oklch,white_42%,transparent)] dark:bg-[color-mix(in_oklch,black_24%,transparent)] px-3 py-2.5 text-body min-h-[64px] flex items-start leading-snug">
      {children}
    </div>
  );
}

function ActionRow({
  disabled,
  favorite,
  copyFlash,
  onPaste,
  onCopy,
  onFavorite,
}: {
  disabled: boolean;
  favorite: boolean;
  copyFlash: boolean;
  onPaste: () => void;
  onCopy: () => void;
  onFavorite: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="default"
        size="sm"
        disabled={disabled}
        onClick={onPaste}
        className="flex-1 h-8 text-caption gap-1.5"
      >
        <ClipboardPaste size={13} aria-hidden />
        <span>Paste</span>
        <kbd className="font-mono text-[10px] opacity-80 ml-0.5">⌘V</kbd>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={onCopy}
        title="Copy (⌘C)"
        className={cn(
          "h-8 w-10 px-0",
          copyFlash && "text-[color:var(--color-success)]",
        )}
      >
        <Copy size={13} aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={onFavorite}
        title={favorite ? "Unfavorite" : "Favorite"}
        className="h-8 w-10 px-0"
      >
        <Star
          size={14}
          aria-hidden
          className={cn(
            favorite &&
              "fill-[color:var(--color-accent-yellow)] text-[color:var(--color-accent-yellow)]",
          )}
        />
      </Button>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-center justify-between h-8 text-item cursor-default",
        disabled && "opacity-50",
      )}
    >
      <span>{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );
}
