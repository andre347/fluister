import { forwardRef, type ChangeEvent } from "react";
import { IconSearch } from "../icons";
import { Kbd } from "./Kbd";

interface SearchBoxProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  width?: number;
  shortcutHint?: string;
}

/** Toolbar search input with a leading magnifying glass and a trailing
 *  ⌘F keyboard hint. Width is fixed because the toolbar is full-bleed and
 *  centering relies on knowing the box width. */
export const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(
  function SearchBox(
    { value, onChange, placeholder = "Search", width = 240, shortcutHint = "⌘F" },
    ref,
  ) {
    return (
      <div
        className="inline-flex items-center gap-1.5 h-[26px] px-[9px] bg-white border-[0.5px] border-hair-strong rounded-ctl shadow-[0_1px_0_rgba(0,0,0,0.02)_inset]"
        style={{ width }}
      >
        <IconSearch size={13} color="var(--color-ink-3)" strokeWidth={1.7} />
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 h-full bg-transparent border-0 outline-none font-sf text-[12px] text-ink placeholder:text-ink-3"
        />
        {shortcutHint && <Kbd>{shortcutHint}</Kbd>}
      </div>
    );
  },
);
