import { Tag } from "../../components/atoms";
import { PrefGroup, PrefRow } from "./Pref";

export function HotkeysPane() {
  return (
    <PrefGroup>
      <PrefRow
        label="Dictation"
        hint="Hold to talk, release to paste. Tap ⎋ to cancel."
      >
        <span className="pref-status">⌥ Right Option</span>
      </PrefRow>

      <PrefRow
        label="Cancel"
        hint="While holding the dictation key, tap Escape to discard the recording."
      >
        <span className="pref-status">⎋ Escape</span>
      </PrefRow>

      <PrefRow
        label="Customisation"
        hint="Hotkey rebinding isn't available yet. The Right Option key is fixed for now."
      >
        <Tag tone="neutral">Coming soon</Tag>
      </PrefRow>
    </PrefGroup>
  );
}
