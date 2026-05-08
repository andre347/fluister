import { useMemo } from "react";
import type { Dictation, Profile } from "../lib/tauri";
import { GroupLabel } from "../components/atoms";
import { IconHistory, IconStar } from "../components/icons";
import { profileDotColor } from "../lib/profiles";
import { cn } from "../lib/utils";

export type HistoryFilter =
  | { kind: "all" }
  | { kind: "today" }
  | { kind: "starred" }
  | { kind: "profile"; id: number };

interface SidebarProps {
  dictations: Dictation[];
  profiles: Profile[];
  filter: HistoryFilter;
  onFilterChange: (next: HistoryFilter) => void;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function HistorySidebar({
  dictations,
  profiles,
  filter,
  onFilterChange,
}: SidebarProps) {
  // Counts derived from the unfiltered dictations list — these are global
  // counts, not "items within current filter".
  const counts = useMemo(() => {
    const today = startOfToday();
    let todayCount = 0;
    let starredCount = 0;
    const byProfile = new Map<number, number>();
    for (const d of dictations) {
      if (d.created_at >= today) todayCount++;
      if (d.favorite) starredCount++;
      if (d.profile_id != null) {
        byProfile.set(d.profile_id, (byProfile.get(d.profile_id) ?? 0) + 1);
      }
    }
    return { all: dictations.length, today: todayCount, starred: starredCount, byProfile };
  }, [dictations]);

  const profileRows = profiles.map((p) => ({
    id: p.id,
    label: p.name,
    count: counts.byProfile.get(p.id) ?? 0,
    dot: profileDotColor(p.name),
  }));

  return (
    <aside
      className="flex flex-col flex-shrink-0 overflow-y-auto pt-1 pb-3 border-r-[0.5px] border-hair backdrop-blur-2xl backdrop-saturate-[1.8]"
      style={{ width: 200, background: "var(--color-sidebar-bg)" }}
    >
      <div className="px-2 pt-2 flex flex-col gap-px">
        <SidebarRow
          icon={<IconHistory size={14} />}
          label="All"
          count={counts.all}
          selected={filter.kind === "all"}
          onClick={() => onFilterChange({ kind: "all" })}
        />
        <SidebarRow
          icon={<IconHistory size={14} />}
          label="Today"
          count={counts.today}
          selected={filter.kind === "today"}
          onClick={() => onFilterChange({ kind: "today" })}
        />
        <SidebarRow
          icon={<IconStar size={14} />}
          label="Starred"
          count={counts.starred}
          selected={filter.kind === "starred"}
          onClick={() => onFilterChange({ kind: "starred" })}
        />
      </div>

      {profileRows.length > 0 && (
        <>
          <GroupLabel>By profile</GroupLabel>
          <div className="px-2 flex flex-col gap-px">
            {profileRows.map((r) => (
              <SidebarRow
                key={r.id}
                dot={r.dot}
                label={r.label}
                count={r.count}
                selected={
                  filter.kind === "profile" && filter.id === r.id
                }
                onClick={() =>
                  onFilterChange({ kind: "profile", id: r.id })
                }
              />
            ))}
          </div>
        </>
      )}
    </aside>
  );
}

interface RowProps {
  icon?: React.ReactNode;
  dot?: string;
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}

function SidebarRow({ icon, dot, label, count, selected, onClick }: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-2 h-6 rounded-[5px] text-left text-[13px] text-ink",
        selected ? "bg-selection" : "hover:bg-fl-hover",
      )}
    >
      <span className="w-4 h-4 inline-flex items-center justify-center text-ink-2 flex-shrink-0">
        {icon}
        {dot && (
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: dot }}
            aria-hidden
          />
        )}
      </span>
      <span className={cn("flex-1 truncate", selected && "font-medium")}>
        {label}
      </span>
      <span className="font-fl-mono text-[11px] text-ink-3">{count}</span>
    </button>
  );
}

