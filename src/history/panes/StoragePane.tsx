import { useCallback, useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { commands, type VaultStatus } from "../../lib/tauri";
import { useTauriEvent } from "../../lib/hooks";
import { Btn, Tag } from "../../components/atoms";
import { PrefGroup, PrefRow } from "./Pref";

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
        return;
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
      <PrefGroup>
        <PrefRow label="Vault">
          <span className="pref-row-hint">Loading vault status…</span>
        </PrefRow>
      </PrefGroup>
    );
  }

  const enabled = status.path !== null;

  return (
    <>
      <PrefGroup>
        <PrefRow
          label="Vault"
          hint={
            enabled
              ? "Profiles and vocabulary are stored as plain Markdown files in this folder. Sync via iCloud, Dropbox or Git — your data stays on your machine."
              : "Store profiles and vocabulary as plain Markdown files in a folder of your choosing. Without a vault, Fluister keeps everything in its local SQLite cache."
          }
        >
          <Btn size="sm" onClick={handlePick} disabled={busy}>
            {enabled ? "Change folder…" : "Choose folder…"}
          </Btn>
        </PrefRow>

        {enabled && (
          <>
            <PrefRow label="Folder">
              <span
                className="font-fl-mono text-[11px] text-ink-2 break-all"
                title={status.path ?? ""}
              >
                {status.path}
              </span>
            </PrefRow>
            <PrefRow label="Profiles">
              <span className="font-fl-mono text-[11px] text-ink-2">
                {status.profile_count}
              </span>
            </PrefRow>
            <PrefRow label="Vocabulary">
              <span className="font-fl-mono text-[11px] text-ink-2">
                {status.vocab_count}
              </span>
            </PrefRow>
            <PrefRow label="Status">
              {status.exists ? (
                <Tag tone="green">Reachable</Tag>
              ) : (
                <Tag tone="amber">Folder is missing</Tag>
              )}
            </PrefRow>
          </>
        )}
      </PrefGroup>

      {enabled && (
        <PrefGroup title="Manage">
          <PrefRow
            label="In Finder"
            hint="Open the folder to inspect or edit files directly."
          >
            <Btn size="sm" onClick={handleOpen} disabled={busy}>
              Open in Finder
            </Btn>
          </PrefRow>
          <PrefRow
            label="Disable vault"
            hint="Drop back to SQLite-only mode. Files on disk are kept."
          >
            <Btn size="sm" kind="danger" onClick={handleClear} disabled={busy}>
              Disable
            </Btn>
          </PrefRow>
        </PrefGroup>
      )}

      {error && (
        <PrefGroup title="Vault error">
          <PrefRow label="Details">
            <span className="font-fl-mono text-[11px] text-red">{error}</span>
          </PrefRow>
        </PrefGroup>
      )}
    </>
  );
}
