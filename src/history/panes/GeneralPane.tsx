import type {
  OverlayPosition,
  Settings,
  Theme,
} from "../../lib/tauri";
import { Segmented } from "../../components/atoms";
import { PrefGroup, PrefRow } from "./Pref";

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
    <PrefGroup>
      <PrefRow label="Appearance" hint="Match the system, or pick light or dark.">
        <Segmented
          options={THEMES}
          value={settings.theme}
          onChange={onThemeChange}
          size="sm"
        />
      </PrefRow>

      <PrefRow
        label="Overlay position"
        hint="Where the recording pill appears on screen."
      >
        <PositionPicker
          value={settings.overlay_position}
          onChange={(v) => updateSettings({ overlay_position: v })}
        />
      </PrefRow>
    </PrefGroup>
  );
}

function PositionPicker({
  value,
  onChange,
}: {
  value: OverlayPosition;
  onChange: (v: OverlayPosition) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Overlay position"
      className="pref-position"
    >
      {POSITIONS.map((p) => {
        const active = value === p.value;
        return (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={p.value.replace("-", " ")}
            onClick={() => onChange(p.value)}
            className="pref-position-cell"
          />
        );
      })}
    </div>
  );
}
