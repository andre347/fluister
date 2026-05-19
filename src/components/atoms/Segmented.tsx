type Size = "sm" | "md";

interface Option<V extends string> {
  value: V;
  label: string;
}

interface SegmentedProps<V extends string> {
  options: ReadonlyArray<Option<V>>;
  value: V;
  onChange?: (value: V) => void;
  size?: Size;
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
  size = "md",
}: SegmentedProps<V>) {
  const heightClass = size === "sm" ? "h-[22px]" : "h-[26px]";
  const fontSizeClass = size === "sm" ? "text-[11px]" : "text-[12px]";
  return (
    <div
      className={`inline-flex rounded-[6px] p-[2px] ${heightClass} shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.06)] bg-[#EAEAE8] dark:bg-[rgba(255,255,255,0.08)]`}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange?.(opt.value)}
            className={`inline-flex items-center justify-center gap-1.5 px-[11px] rounded-[4px] font-sf cursor-pointer ${fontSizeClass} ${
              selected
                ? "font-medium text-ink shadow-[0_1px_1px_rgba(0,0,0,0.08),0_0_0_0.5px_rgba(0,0,0,0.04)] bg-input-surface"
                : "bg-transparent font-normal text-ink"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
