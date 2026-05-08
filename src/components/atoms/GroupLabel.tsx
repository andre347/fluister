import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../lib/utils";

interface GroupLabelProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Section group header — 11pt SF semibold uppercase, like NSTableView
 *  headers. Reused across sidebars (History "By app", Profiles "Built-in",
 *  Vocab "Scope") and inside the live-preview pane on Profiles. */
export function GroupLabel({ children, className, style }: GroupLabelProps) {
  return (
    <div
      className={cn(
        "font-sf text-[11px] font-semibold uppercase tracking-[0.4px] text-ink-3 px-4 pt-3.5 pb-1",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}
