import { useMemo, useRef, useEffect } from "react";
import type { Dictation, Profile } from "../lib/tauri";
import { Segmented } from "../components/atoms";
import { IconStar } from "../components/icons";
import { profileDotColorById } from "../lib/profiles";
import { cn } from "../lib/utils";

export type ListMode = "all" | "clean" | "raw";

type Props = {
  dictations: Dictation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  isLoading: boolean;
  profiles: Profile[];
  /** Profile id → display name. Used by the meta line under each row. */
  profileNames: Map<number, string>;
  totalLabel: string;
  mode: ListMode;
  onModeChange: (next: ListMode) => void;
};

interface DateGroup {
  label: string;
  items: Dictation[];
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function groupByDate(items: Dictation[]): DateGroup[] {
  const todayStart = startOfDay(Date.now());
  const yesterdayStart = todayStart - 86_400_000;
  const weekStart = todayStart - 6 * 86_400_000;

  const buckets: DateGroup[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Earlier this week", items: [] },
    { label: "Earlier", items: [] },
  ];

  for (const item of items) {
    if (item.created_at >= todayStart) buckets[0].items.push(item);
    else if (item.created_at >= yesterdayStart) buckets[1].items.push(item);
    else if (item.created_at >= weekStart) buckets[2].items.push(item);
    else buckets[3].items.push(item);
  }
  return buckets.filter((g) => g.items.length > 0);
}

function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const MODE_OPTIONS = [
  { value: "all" as const, label: "All" },
  { value: "clean" as const, label: "Cleaned" },
  { value: "raw" as const, label: "Raw" },
];

export function HistoryListPane({
  dictations,
  selectedId,
  onSelect,
  isLoading,
  profiles,
  profileNames,
  totalLabel,
  mode,
  onModeChange,
}: Props) {
  const groups = useMemo(() => groupByDate(dictations), [dictations]);

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedId == null || !listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(
      `[data-dict-id="${selectedId}"]`,
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  return (
    <div
      className="flex flex-col flex-shrink-0 border-r-[0.5px] border-hair overflow-hidden"
      style={{ width: 360, background: "var(--color-list-bg)" }}
    >
      <div className="sticky top-0 z-[1] flex items-center justify-between gap-3 px-4 py-2.5 border-b-[0.5px] border-hair bg-[rgba(252,252,250,0.85)] backdrop-blur-xl">
        <span className="text-[12px] text-ink-2">{totalLabel}</span>
        <Segmented
          options={MODE_OPTIONS}
          value={mode}
          onChange={onModeChange}
          size="sm"
        />
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto scrollable">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-[12px] text-ink-3">
            Loading…
          </div>
        ) : dictations.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-ink-3">
            No matches
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <div className="font-sf text-[11px] font-semibold uppercase tracking-[0.4px] text-ink-3 px-4 pt-3 pb-1">
                {group.label}
              </div>
              {group.items.map((d) => (
                <ListRow
                  key={d.id}
                  dictation={d}
                  isSelected={d.id === selectedId}
                  onSelect={() => onSelect(d.id)}
                  mode={mode}
                  profileName={
                    d.profile_id != null
                      ? profileNames.get(d.profile_id) ?? null
                      : null
                  }
                  profileDotVar={profileDotColorById(d.profile_id, profiles)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface RowProps {
  dictation: Dictation;
  isSelected: boolean;
  onSelect: () => void;
  mode: ListMode;
  profileName: string | null;
  profileDotVar: string;
}

function ListRow({
  dictation,
  isSelected,
  onSelect,
  mode,
  profileName,
  profileDotVar,
}: RowProps) {
  const preview = mode === "raw" ? dictation.raw_text : dictation.cleaned_text;
  return (
    <button
      type="button"
      data-dict-id={dictation.id}
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        "w-full flex gap-2.5 px-4 py-2.5 border-b-[0.5px] border-hair text-left cursor-pointer",
        isSelected ? "bg-selection" : "hover:bg-fl-hover",
      )}
    >
      <span
        className="w-2 h-2 rounded-full mt-[7px] flex-shrink-0"
        style={{ background: profileDotVar }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div
          className="text-[12.5px] text-ink leading-[1.4] overflow-hidden"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {preview}
        </div>
        <div className="flex items-center gap-2 mt-1 text-ink-3 text-[11px]">
          <span className="font-fl-mono">{formatClock(dictation.created_at)}</span>
          <span className="w-[2px] h-[2px] rounded-full bg-ink-4" />
          <span className="font-fl-mono">{formatDuration(dictation.duration_ms)}</span>
          {profileName && (
            <>
              <span className="w-[2px] h-[2px] rounded-full bg-ink-4" />
              <span>{profileName}</span>
            </>
          )}
          {dictation.favorite && (
            <>
              <span className="flex-1" />
              <IconStar size={11} filled color="var(--color-amber)" />
            </>
          )}
        </div>
      </div>
    </button>
  );
}
