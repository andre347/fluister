import type { CSSProperties } from "react";
import { cn } from "../../lib/utils";

interface FieldBase {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  monospace?: boolean;
  className?: string;
  style?: CSSProperties;
  onChange?: (next: string) => void;
}

interface SingleLine extends FieldBase {
  multiline?: false;
  rows?: never;
}

interface MultiLine extends FieldBase {
  multiline: true;
  rows?: number;
}

type FieldProps = SingleLine | MultiLine;

const baseClasses =
  "w-full text-ink bg-input-surface border-[0.5px] border-hair-strong rounded-ctl shadow-[0_1px_0_rgba(0,0,0,0.02)_inset] outline-none box-border resize-none leading-[1.5]";

export function Field(props: FieldProps) {
  const { placeholder, monospace, className, style, onChange, value, defaultValue } = props;
  const fontClass = monospace ? "font-fl-mono text-[12px]" : "font-sf text-[13px]";

  if (props.multiline) {
    return (
      <textarea
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={props.rows ?? 4}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={cn(baseClasses, "px-[10px] py-2", fontClass, className)}
        style={style}
      />
    );
  }
  return (
    <input
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      className={cn(baseClasses, "px-[9px] py-[5px]", fontClass, className)}
      style={style}
    />
  );
}
