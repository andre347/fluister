import type { ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className="font-sf text-[11px] text-ink-3 tracking-[0.5px]">
      {children}
    </span>
  );
}
