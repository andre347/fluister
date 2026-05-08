import type { ReactNode } from "react";

type Tone = "neutral" | "amber" | "green" | "blue";

interface TagProps {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}

const toneClasses: Record<Tone, string> = {
  neutral: "bg-fill text-ink-2",
  amber: "bg-amber-tint text-amber-ink",
  green: "bg-[#DDF1D9] text-[#346B2A]",
  blue: "bg-[#DDE9FA] text-[#0856B0]",
};

export function Tag({ children, tone = "neutral", icon }: TagProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-[7px] py-[1px] rounded-[4px] font-sf text-[11px] font-medium leading-[1.5] whitespace-nowrap ${toneClasses[tone]}`}
    >
      {icon && <span className="inline-flex">{icon}</span>}
      {children}
    </span>
  );
}
