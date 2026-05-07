import type {
  OverlayPosition,
  Settings,
  Theme,
} from "../../lib/tauri";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const POSITIONS: { value: OverlayPosition; row: 0 | 1; col: 0 | 1 | 2 }[] = [
  { value: "top-left", row: 0, col: 0 },
  { value: "top-center", row: 0, col: 1 },
  { value: "top-right", row: 0, col: 2 },
  { value: "bottom-left", row: 1, col: 0 },
  { value: "bottom-center", row: 1, col: 1 },
  { value: "bottom-right", row: 1, col: 2 },
];

type Props = {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  onThemeChange: (theme: Theme) => void;
};

export function GeneralPane({ settings, updateSettings, onThemeChange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Match the system, or pick light or dark.</CardDescription>
        </CardHeader>
        <CardContent>
          <SegmentedControl
            options={THEMES}
            value={settings.theme}
            onChange={onThemeChange}
            ariaLabel="Theme"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overlay position</CardTitle>
          <CardDescription>
            Where the recording overlay appears on screen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="radiogroup"
            aria-label="Overlay position"
            className="grid grid-cols-3 grid-rows-2 gap-2 max-w-[360px]"
          >
            {POSITIONS.map((p) => {
              const active = settings.overlay_position === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={p.value.replace("-", " ")}
                  onClick={() => updateSettings({ overlay_position: p.value })}
                  className={cn(
                    "relative h-12 rounded-md border bg-muted/40 transition-colors",
                    "hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border",
                  )}
                >
                  <span
                    className={cn(
                      "absolute h-1.5 w-5 rounded-full",
                      active ? "bg-primary" : "bg-foreground/40",
                    )}
                    style={{
                      top: p.row === 0 ? 8 : "auto",
                      bottom: p.row === 1 ? 8 : "auto",
                      left:
                        p.col === 0
                          ? 8
                          : p.col === 1
                            ? "calc(50% - 10px)"
                            : "auto",
                      right: p.col === 2 ? 8 : "auto",
                    }}
                  />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auto-stop after silence</CardTitle>
          <CardDescription>
            Stop recording automatically after this many ms of silence.{" "}
            <code className="bg-muted rounded px-1 py-0.5">0</code> disables.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative w-32">
            <Input
              type="number"
              min={0}
              max={10000}
              step={100}
              value={settings.vad_silence_ms}
              onChange={(e) =>
                updateSettings({
                  vad_silence_ms: Number(e.target.value || 0),
                })
              }
              className="pr-10 h-8 tabular-nums"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
              ms
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex rounded-md bg-muted p-0.5"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            variant="ghost"
            size="sm"
            onClick={() => onChange(o.value)}
            className={cn(
              "h-7 px-3 rounded-[4px] text-xs font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm hover:bg-background"
                : "text-muted-foreground hover:bg-background/40 hover:text-foreground",
            )}
          >
            {o.label}
          </Button>
        );
      })}
    </div>
  );
}
