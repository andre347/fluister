import { useMemo } from "react";
import type { Dictation } from "../lib/tauri";
import { Row } from "./Row";

type Props = {
  dictations: Dictation[];
  expanded: Set<number>;
  selectedIndex: number;
  isFiltered: boolean;
  onSelect: (idx: number) => void;
  onToggleExpanded: (id: number) => void;
  onFavorite: (id: number) => void;
  onCopy: (id: number) => Promise<void>;
  onPaste: (id: number) => void;
  onDelete: (id: number) => void;
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

/**
 * Bucket dictations into Today / Yesterday / Earlier this week / Earlier so
 * the user can scan a long history quickly. Empty buckets are dropped.
 */
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

export function HistoryList({
  dictations,
  expanded,
  selectedIndex,
  isFiltered,
  onSelect,
  onToggleExpanded,
  onFavorite,
  onCopy,
  onPaste,
  onDelete,
}: Props) {
  const groups = useMemo(() => groupByDate(dictations), [dictations]);

  if (dictations.length === 0) {
    return <EmptyState isFiltered={isFiltered} />;
  }

  let flatIndex = 0;
  return (
    <main
      role="listbox"
      aria-label="Dictations"
      aria-live="polite"
      tabIndex={0}
      className="flex-1 overflow-y-auto pb-1 scrollable"
    >
      {groups.map((group) => (
        <div key={group.label}>
          <div className="group-header">{group.label}</div>
          {group.items.map((d) => {
            const idx = flatIndex++;
            return (
              <Row
                key={d.id}
                dictation={d}
                index={idx}
                isExpanded={expanded.has(d.id)}
                isSelected={idx === selectedIndex}
                onSelect={onSelect}
                onToggleExpanded={onToggleExpanded}
                onFavorite={onFavorite}
                onCopy={onCopy}
                onPaste={onPaste}
                onDelete={onDelete}
              />
            );
          })}
        </div>
      ))}
    </main>
  );
}

function EmptyState({ isFiltered }: { isFiltered: boolean }) {
  return (
    <div className="absolute inset-x-0 top-[50px] bottom-0 flex flex-col items-center justify-center text-center pointer-events-none px-6">
      <svg
        className="empty-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 18.5c-3.6 0-6.5-2.9-6.5-6.5" />
        <path d="M18.5 12c0 3.6-2.9 6.5-6.5 6.5" />
        <line x1="12" y1="18.5" x2="12" y2="22" />
        <line x1="9" y1="22" x2="15" y2="22" />
        <rect x="9" y="2" width="6" height="13" rx="3" />
      </svg>
      <p className="text-body font-medium text-muted-foreground m-0">
        {isFiltered ? "No matches" : "No dictations yet"}
      </p>
      <p className="text-footnote text-faint mt-1 m-0">
        {isFiltered
          ? "Try a different search or filter"
          : "Hold Right ⌥ Option anywhere to start"}
      </p>
    </div>
  );
}
