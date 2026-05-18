import type { ReactNode } from "react";
import { Children, Fragment } from "react";

interface PrefGroupProps {
  title?: string;
  children: ReactNode;
}

export function PrefGroup({ title, children }: PrefGroupProps) {
  return (
    <div className="pref-group">
      {title && <div className="pref-group-title">{title}</div>}
      {Children.toArray(children).map((child, i) => (
        <Fragment key={i}>
          {i > 0 && <div className="pref-row-divider" />}
          {child}
        </Fragment>
      ))}
    </div>
  );
}

interface PrefRowProps {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}

export function PrefRow({ label, hint, children }: PrefRowProps) {
  return (
    <div className="pref-row">
      <div className="pref-row-label">{label}</div>
      <div className="pref-row-control">
        {children}
        {hint && <div className="pref-row-hint">{hint}</div>}
      </div>
    </div>
  );
}
