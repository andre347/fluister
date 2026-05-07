import { useCallback, useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { commands, type VaultStatus } from "../../lib/tauri";
import { useTauriEvent } from "../../lib/hooks";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

export function StoragePane() {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    commands
      .vaultStatus()
      .then(setStatus)
      .catch((err) => {
        console.error("vault_status failed", err);
        setError(String(err));
      });
  }, []);

  useEffect(() => refresh(), [refresh]);
  useTauriEvent<unknown>("vault-changed", () => refresh());

  const handlePick = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const picked = await openDialog({
        directory: true,
        multiple: false,
        title: "Choose a folder for your Fluister vault",
      });
      if (typeof picked !== "string") {
        setBusy(false);
        return; // user cancelled
      }
      const next = await commands.setVaultPath(picked);
      setStatus(next);
    } catch (err) {
      console.error("set_vault_path failed", err);
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const handleClear = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await commands.clearVaultPath();
      setStatus(next);
    } catch (err) {
      console.error("clear_vault_path failed", err);
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const handleOpen = useCallback(() => {
    commands.openVaultInFinder().catch((err) => {
      console.error("open_vault_in_finder failed", err);
      setError(String(err));
    });
  }, []);

  if (!status) {
    return (
      <div className="text-text-muted text-footnote">Loading vault status…</div>
    );
  }

  const enabled = status.path !== null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{enabled ? "Vault" : "Set up a vault"}</CardTitle>
          <CardDescription className="leading-relaxed">
            {enabled
              ? "Profiles and vocabulary are stored as plain Markdown files in this folder. Sync via iCloud, Dropbox, or Git — your data stays on your machine."
              : "Store profiles and vocabulary as plain Markdown files in a folder of your choosing. The folder syncs via iCloud / Dropbox / Git just like any other directory. Without a vault, Fluister keeps everything in its local SQLite cache."}
          </CardDescription>
          <CardAction>
            <Button
              variant={enabled ? "ghost" : "default"}
              size="sm"
              onClick={handlePick}
              disabled={busy}
            >
              {enabled ? "Change folder…" : "Choose folder…"}
            </Button>
          </CardAction>
        </CardHeader>
        {enabled && (
          <CardContent className="flex flex-col gap-2 pt-0">
            <PathRow label="Folder" value={status.path ?? ""} />
            <PathRow label="Profiles" value={`${status.profile_count}`} />
            <PathRow label="Vocabulary" value={`${status.vocab_count}`} />
            <PathRow
              label="Status"
              value={status.exists ? "Reachable" : "Folder is missing"}
              warn={!status.exists}
            />
          </CardContent>
        )}
      </Card>

      {enabled && (
        <Card>
          <CardHeader>
            <CardTitle>Manage</CardTitle>
            <CardDescription>
              Open the folder in Finder to inspect or edit files directly.
              Disable to drop back to SQLite-only mode — files are kept on
              disk.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2 pt-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpen}
              disabled={busy}
            >
              Open in Finder
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={busy}
              className="text-text-muted hover:text-[color:var(--color-danger)]"
            >
              Disable vault
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardHeader>
            <CardTitle className="text-[color:var(--color-danger)]">
              Vault error
            </CardTitle>
            <CardDescription className="font-mono text-[11px]">
              {error}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

function PathRow({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-footnote">
      <span className="text-text-muted shrink-0">{label}</span>
      <span
        className={
          warn
            ? "text-[color:var(--color-danger)] font-mono text-[11px] truncate text-right"
            : "text-foreground font-mono text-[11px] truncate text-right"
        }
        title={value}
      >
        {value || "—"}
      </span>
    </div>
  );
}
