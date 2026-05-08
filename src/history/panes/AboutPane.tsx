import { useEffect, useState } from "react";
import { commands } from "../../lib/tauri";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

export function AboutPane() {
  const [version, setVersion] = useState<string | null>(null);

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
          <CardTitle>Onboarding</CardTitle>
          <CardDescription>
            Re-walk the welcome flow — handy if you want to switch the
            Whisper model or revisit Ollama setup.
          </CardDescription>
          <CardAction>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                commands.showOnboardingWindow().catch((err) =>
                  console.error("show_onboarding_window failed", err),
                )
              }
            >
              Re-run onboarding
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
