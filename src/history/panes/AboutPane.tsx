import { useEffect, useState } from "react";
import { commands } from "../../lib/tauri";
import { useUpdater } from "../../lib/useUpdater";
import { Btn, Wordmark } from "../../components/atoms";

export function AboutPane() {
  const [version, setVersion] = useState<string | null>(null);
  const { phase, runCheck, installAndRestart } = useUpdater();

  useEffect(() => {
    let cancelled = false;
    commands
      .appVersion()
      .then((v) => {
        if (!cancelled) setVersion(v);
      })
      .catch(() => {
        if (!cancelled) setVersion(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col items-center text-center gap-3.5 pt-3">
      <span
        className="w-16 h-16 rounded-[14px] inline-flex items-center justify-center"
        style={{
          background: "linear-gradient(180deg, #1f1a14, #0d0a08)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
        }}
      >
        <span
          className="inline-flex items-center"
          style={{
            width: 28,
            height: 8,
            borderRadius: 999,
            background: "#fbf8f2",
            paddingLeft: 4,
            gap: 3,
          }}
        >
          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--color-red)" }} />
          <span style={{ width: 1.5, height: 4, background: "#1a1714", borderRadius: 1 }} />
          <span style={{ width: 1.5, height: 5, background: "#1a1714", borderRadius: 1 }} />
          <span style={{ width: 1.5, height: 3, background: "#1a1714", borderRadius: 1 }} />
        </span>
      </span>

      <Wordmark size={28} />

      <div className="font-fl-mono text-[11px] text-ink-3">
        {version ? `Version ${version}` : "Fluister"}
      </div>

      <div
        className="text-[12px] text-ink-2 leading-[1.55] italic max-w-[360px]"
        style={{ fontFamily: 'var(--font-sf-display), "Iowan Old Style", Georgia, serif' }}
      >
        "fluister" — Dutch, to whisper. The sound your Mac makes when it does
        the work for you.
      </div>

      <UpdateStatusLine
        phase={phase}
        onCheck={runCheck}
        onInstall={installAndRestart}
      />

      <div className="flex gap-2 mt-1">
        <Btn
          size="sm"
          onClick={() =>
            commands
              .showOnboardingWindow()
              .catch((err) => console.error("show_onboarding_window failed", err))
          }
        >
          Re-run onboarding
        </Btn>
        <Btn
          size="sm"
          onClick={() =>
            commands
              .openExternalUrl("https://fluister-web.vercel.app")
              .catch((err) => console.error("open_external_url failed", err))
          }
        >
          Visit website
        </Btn>
        <Btn
          size="sm"
          onClick={() =>
            commands
              .openExternalUrl("https://github.com/andre347/fluister")
              .catch((err) => console.error("open_external_url failed", err))
          }
        >
          Source on GitHub
        </Btn>
      </div>

      <div className="text-[11px] text-ink-4 mt-3">© 2026 · made on a Mac · MIT</div>
    </div>
  );
}

function UpdateStatusLine({
  phase,
  onCheck,
  onInstall,
}: {
  phase: ReturnType<typeof useUpdater>["phase"];
  onCheck: () => void;
  onInstall: () => void;
}) {
  let status: React.ReactNode = null;
  let button: React.ReactNode;

  if (phase.kind === "checking") {
    status = <span className="text-ink-3">Checking…</span>;
    button = (
      <Btn size="sm" disabled>
        Checking…
      </Btn>
    );
  } else if (phase.kind === "available") {
    status = (
      <span className="text-ink-2">
        Update available · Fluister {phase.update.version}
      </span>
    );
    button = (
      <Btn size="sm" onClick={onInstall}>
        Install & restart
      </Btn>
    );
  } else if (phase.kind === "downloading") {
    const pct =
      phase.total && phase.total > 0
        ? Math.min(100, Math.floor((phase.downloaded / phase.total) * 100))
        : null;
    status = (
      <span className="text-ink-3">
        Downloading{pct !== null ? ` · ${pct}%` : "…"}
      </span>
    );
    button = (
      <Btn size="sm" disabled>
        Downloading…
      </Btn>
    );
  } else if (phase.kind === "installing") {
    status = <span className="text-ink-3">Installing…</span>;
    button = (
      <Btn size="sm" disabled>
        Installing…
      </Btn>
    );
  } else if (phase.kind === "up-to-date") {
    status = <span className="text-ink-3">You're up to date.</span>;
    button = (
      <Btn size="sm" onClick={onCheck}>
        Check for updates…
      </Btn>
    );
  } else if (phase.kind === "error") {
    status = (
      <span className="text-red max-w-[280px] truncate" title={phase.message}>
        Couldn't check for updates
      </span>
    );
    button = (
      <Btn size="sm" onClick={onCheck}>
        Try again
      </Btn>
    );
  } else {
    button = (
      <Btn size="sm" onClick={onCheck}>
        Check for updates…
      </Btn>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5 mt-1">
      {button}
      {status && <span className="text-[11px]">{status}</span>}
    </div>
  );
}
