import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { commands, type InstalledApp } from "../lib/tauri";
import { IconSearch } from "../components/icons";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bundle IDs already bound — these are dimmed in the list and clicking
   *  them is a no-op so the user can't double-bind the same app. */
  excludeBundleIds: string[];
  onPick: (app: InstalledApp) => void;
}

/** Modal app picker. Loads installed apps lazily on first open and caches
 *  for the lifetime of the dialog instance. Filtering is purely
 *  client-side on name + bundle_id substrings. */
export function AppPickerDialog({
  open,
  onOpenChange,
  excludeBundleIds,
  onPick,
}: Props) {
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || apps !== null) return;
    let cancelled = false;
    commands
      .listInstalledApps()
      .then((list) => {
        if (!cancelled) setApps(list);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [open, apps]);

  const excluded = useMemo(
    () => new Set(excludeBundleIds),
    [excludeBundleIds],
  );

  const filtered = useMemo(() => {
    if (!apps) return [];
    const q = search.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.bundle_id.toLowerCase().includes(q),
    );
  }, [apps, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-[14px] font-medium">Add app</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-2">
          <div className="inline-flex items-center gap-2 w-full h-[28px] px-2 bg-fill border-[0.5px] border-hair-strong rounded-ctl">
            <IconSearch size={13} color="var(--color-ink-3)" strokeWidth={1.7} />
            <input
              autoFocus
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search apps"
              className="flex-1 h-full bg-transparent border-0 outline-none font-sf text-[13px] text-ink"
            />
          </div>
        </div>
        <div className="max-h-[360px] overflow-y-auto scrollable border-t-[0.5px] border-hair">
          {error && (
            <div className="px-4 py-3 text-[12px] text-red">{error}</div>
          )}
          {!error && apps === null && (
            <div className="px-4 py-3 text-[12px] text-ink-3">
              Reading /Applications…
            </div>
          )}
          {!error && apps !== null && filtered.length === 0 && (
            <div className="px-4 py-3 text-[12px] text-ink-3">No matches</div>
          )}
          {filtered.map((app) => {
            const isBound = excluded.has(app.bundle_id);
            return (
              <button
                key={app.bundle_id}
                type="button"
                disabled={isBound}
                onClick={() => {
                  onPick(app);
                  onOpenChange(false);
                  setSearch("");
                }}
                className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left hover:bg-fl-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="min-w-0 flex-1 text-[13px] text-ink truncate">
                  {app.name}
                </span>
                {isBound && (
                  <span className="text-[10px] text-ink-3 font-sf uppercase tracking-[0.4px]">
                    Bound
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
