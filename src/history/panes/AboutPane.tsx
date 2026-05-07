import { useCallback, useEffect, useState } from "react";
import { commands } from "../../lib/tauri";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

type CheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "result"; latest: boolean; version: string }
  | { kind: "error" };

export function AboutPane() {
  const [version, setVersion] = useState<string | null>(null);
  const [check, setCheck] = useState<CheckState>({ kind: "idle" });

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

  const handleCheck = useCallback(async () => {
    setCheck({ kind: "checking" });
    try {
      const status = await commands.checkForUpdates();
      setCheck({
        kind: "result",
        latest: status.up_to_date,
        version: status.latest_version,
      });
    } catch (err) {
      console.error("check_for_updates failed", err);
      setCheck({ kind: "error" });
    }
  }, []);

  let statusText: string;
  switch (check.kind) {
    case "idle":
      statusText = "Latest version";
      break;
    case "checking":
      statusText = "Checking…";
      break;
    case "result":
      statusText = check.latest
        ? "Latest version"
        : `Update available: v${check.version}`;
      break;
    case "error":
      statusText = "Couldn't check";
      break;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Version</CardTitle>
          <CardDescription>
            {version ? `Fluister v${version}` : "Fluister"}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Updates</CardTitle>
          <CardDescription>{statusText}</CardDescription>
          <CardAction>
            <Button
              variant="secondary"
              size="sm"
              disabled={check.kind === "checking"}
              onClick={handleCheck}
            >
              Check for updates
            </Button>
          </CardAction>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
          <CardDescription className="leading-relaxed">
            Fluister is a tiny native macOS dictation utility powered by
            Whisper running on Metal and Ollama for cleanup. Everything runs
            on your machine.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
