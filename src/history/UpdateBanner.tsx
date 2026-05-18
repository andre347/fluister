import { useUpdater } from "../lib/useUpdater";
import { Btn } from "../components/atoms";
import { IconX } from "../components/icons";

export function UpdateBanner() {
  const { phase, dismissed, dismissBanner, installAndRestart } = useUpdater();

  // Banner only surfaces in two phases: a new update is waiting, or it's
  // currently downloading/installing. Everything else stays silent — the
  // About pane handles "up-to-date" / "checking" / "error" inline.
  const showing =
    !dismissed &&
    (phase.kind === "available" ||
      phase.kind === "downloading" ||
      phase.kind === "installing");

  if (!showing) return null;

  let body: React.ReactNode;
  let action: React.ReactNode = null;

  if (phase.kind === "available") {
    body = (
      <>
        <span className="font-medium">Update available</span>
        <span className="text-ink-3">·</span>
        <span>Fluister {phase.update.version} is ready to install.</span>
      </>
    );
    action = (
      <Btn size="sm" onClick={installAndRestart}>
        Install & restart
      </Btn>
    );
  } else if (phase.kind === "downloading") {
    const pct =
      phase.total && phase.total > 0
        ? Math.min(100, Math.floor((phase.downloaded / phase.total) * 100))
        : null;
    body = (
      <>
        <span className="font-medium">Downloading update…</span>
        {pct !== null && <span className="text-ink-3 tabular-nums">{pct}%</span>}
      </>
    );
  } else {
    body = <span className="font-medium">Installing — restarting Fluister…</span>;
  }

  return (
    <div className="update-banner">
      <div className="update-banner-body">{body}</div>
      <div className="update-banner-actions">
        {action}
        {phase.kind === "available" && (
          <button
            type="button"
            onClick={dismissBanner}
            aria-label="Dismiss"
            className="update-banner-close"
          >
            <IconX size={12} strokeWidth={1.8} />
          </button>
        )}
      </div>
    </div>
  );
}
