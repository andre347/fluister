import { useMemo, useRef, useEffect } from "react";
import type { Dictation } from "../lib/tauri";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";

type Props = {
  dictations: Dictation[];
  selectedId: number | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: number) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  isLoading: boolean;
  /** Profile id → display name. Rows whose profile_id is null OR whose
   *  id isn't in the map render no chip. */
  profileNames: Map<number, string>;
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

export function HistoryListPane({
  dictations,
  selectedId,
  search,
  onSearchChange,
  onSelect,
  searchInputRef,
  isLoading,
  profileNames,
}: Props) {
  const groups = useMemo(() => groupByDate(dictations), [dictations]);

  // Scroll selected row into view when selection changes.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedId == null || !listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(
      `[data-dict-id="${selectedId}"]`,
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  return (
    <div className="hist-list-pane">
      <div className="hist-list-search">
        <SearchIcon />
        <Input
          ref={searchInputRef}
          type="search"
          placeholder="Search history"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search dictations"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-7 pl-6 text-footnote bg-transparent border-0 shadow-none focus-visible:ring-0"
        />
      </div>
      <div ref={listRef} className="hist-list-scroll scrollable">
        {isLoading ? (
          <div className="hist-list-empty">Loading…</div>
        ) : dictations.length === 0 ? (
          <div className="hist-list-empty">
            {search ? "No matches" : "No dictations yet"}
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <div className="hist-list-group">{group.label}</div>
              {group.items.map((d) => (
                <ListRow
                  key={d.id}
                  dictation={d}
                  isSelected={d.id === selectedId}
                  onSelect={() => onSelect(d.id)}
                  profileName={
                    d.profile_id != null
                      ? profileNames.get(d.profile_id) ?? null
                      : null
                  }
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ListRow({
  dictation,
  isSelected,
  onSelect,
  profileName,
}: {
  dictation: Dictation;
  isSelected: boolean;
  onSelect: () => void;
  profileName: string | null;
}) {
  return (
    <button
      type="button"
      data-dict-id={dictation.id}
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        "hist-list-row",
        isSelected && "hist-list-row-selected",
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {profileName && (
            <span className="hist-profile-chip" title={profileName}>
              {profileName}
            </span>
          )}
          <span className="font-mono text-tag opacity-80">
            {formatClock(dictation.created_at)}
          </span>
        </div>
        {dictation.favorite && (
          <span className="text-[color:var(--color-accent-yellow)] text-tag" aria-hidden>
            ★
          </span>
        )}
      </div>
      <div className="hist-list-row-text">{dictation.cleaned_text}</div>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg
      className="absolute left-1.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
      viewBox="0 0 16 16"
      width="11"
      height="11"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M11.74 10.32a6 6 0 1 0-1.42 1.42l3.47 3.47a1 1 0 0 0 1.42-1.42l-3.47-3.47ZM3 7a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
      />
    </svg>
  );
}
