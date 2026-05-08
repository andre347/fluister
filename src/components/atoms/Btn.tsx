import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/utils";

type Kind = "default" | "primary" | "plain" | "danger" | "destructive";
type Size = "sm" | "md" | "lg";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: Kind;
  size?: Size;
  icon?: ReactNode;
}

const sizeClasses: Record<Size, string> = {
  sm: "px-[9px] text-[11px] h-[22px] gap-1",
  md: "px-[11px] text-[13px] h-[26px] gap-1.5",
  lg: "px-[14px] text-[13px] h-[32px] gap-2",
};

const kindClasses: Record<Kind, string> = {
  default:
    "text-ink border-[0.5px] border-hair-strong bg-gradient-to-b from-white to-[#fafafa] shadow-[0_1px_0_rgba(0,0,0,0.04)]",
  primary:
    "border-[0.5px] border-amber-ink bg-gradient-to-b from-[#F0B574] to-[#E29A4C] text-[#3a2510] shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_1px_1px_rgba(178,122,48,0.2)]",
  plain:
    "bg-transparent text-ink-2 border-[0.5px] border-transparent hover:bg-fl-hover",
  // Subtle red text on a default-bordered button — used for inline
  // destructive actions inside an editor (e.g. "Delete profile" in the
  // header bar) where red prominence would be too loud.
  danger:
    "text-red border-[0.5px] border-hair-strong bg-gradient-to-b from-white to-[#fafafa]",
  // Bold filled red — the *prominent* destructive action in a
  // confirmation dialog. Matches the visual weight of `primary` so the
  // dialog has a clear default action.
  destructive:
    "border-[0.5px] border-[#C42E25] bg-gradient-to-b from-[#FF6357] to-[#E13E32] text-white shadow-[0_1px_0_rgba(255,255,255,0.3)_inset,0_1px_1px_rgba(196,46,37,0.2)]",
};

export const Btn = forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  { kind = "default", size = "md", icon, type = "button", children, className, style, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      // Belt-and-suspenders: make absolutely sure the button is *not* a
      // drag region, regardless of what its ancestors set. Some macOS +
      // Tauri 2 combinations were swallowing button clicks when a parent
      // had `app-region: drag` even with the global no-drag-on-button CSS
      // rule in place.
      data-tauri-drag-region="false"
      style={{ WebkitAppRegion: "no-drag", ...(style as object) } as React.CSSProperties}
      className={cn(
        "inline-flex items-center justify-center rounded-[5px] font-sf font-medium whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        sizeClasses[size],
        kindClasses[kind],
        className,
      )}
      {...rest}
    >
      {icon && <span className="inline-flex">{icon}</span>}
      {children}
    </button>
  );
});
