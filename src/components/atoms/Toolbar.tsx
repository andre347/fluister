import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";

interface ToolbarProps {
  /** Section title displayed after the wordmark, e.g. "History". */
  section: string;
  /** Centered slot — typically a SearchBox. */
  center?: ReactNode;
  /** Right-aligned slot — toolbar buttons. */
  trailing?: ReactNode;
}

/** The main-window toolbar — 52px tall hairline-bordered band with the
 *  wordmark + section name on the left, an optional centered control,
 *  and right-aligned actions.
 *
 *  Note: NOT a drag region. The 28px `hist-titlebar` strip above already
 *  provides the window-drag area; making the toolbar drag-able too caused
 *  buttons inside it (e.g. "+ New profile") to lose their clicks under
 *  some Tauri/macOS combinations even with `data-tauri-drag-region="false"`
 *  on the slot. Keeping the toolbar fully clickable is more important than
 *  the extra drag affordance. */
export function Toolbar({ section, center, trailing }: ToolbarProps) {
  return (
    <div className="h-[52px] flex-shrink-0 flex items-center gap-3 px-4 border-b-[0.5px] border-hair bg-transparent">
      <div className="flex items-center gap-2 flex-shrink-0" style={{ minWidth: 220 }}>
        <Wordmark size={13} />
        <span className="text-ink-3 ml-1.5">·</span>
        <span className="text-ink-2 font-medium text-[13px]">{section}</span>
      </div>
      {center && <div className="flex-1 flex justify-center">{center}</div>}
      {!center && <div className="flex-1" />}
      {trailing && (
        <div className="flex-shrink-0 flex gap-1.5">{trailing}</div>
      )}
    </div>
  );
}
