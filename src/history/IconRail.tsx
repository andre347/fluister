import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";
import {
  IconHistory,
  IconProfile,
  IconVocab,
} from "../components/icons";
import { cn } from "../lib/utils";

export type Section = "history" | "profiles" | "vocabulary" | "settings";

const TOP: { id: Section; label: string; icon: React.ReactNode; shortcut: string }[] = [
  { id: "history",    label: "History",    icon: <IconHistory size={16} strokeWidth={1.6} />, shortcut: "⌘1" },
  { id: "profiles",   label: "Profiles",   icon: <IconProfile size={16} strokeWidth={1.6} />, shortcut: "⌘2" },
  { id: "vocabulary", label: "Vocabulary", icon: <IconVocab   size={16} strokeWidth={1.6} />, shortcut: "⌘3" },
];

type Props = {
  section: Section;
  onSectionChange: (s: Section) => void;
};

export function IconRail({ section, onSectionChange }: Props) {
  return (
    <nav className="hist-rail" aria-label="Sections">
      <div className="flex flex-col items-center gap-1">
        {TOP.map((item) => (
          <RailButton
            key={item.id}
            isActive={section === item.id}
            label={item.label}
            shortcut={item.shortcut}
            onClick={() => onSectionChange(item.id)}
          >
            {item.icon}
          </RailButton>
        ))}
      </div>
    </nav>
  );
}

function RailButton({
  isActive,
  label,
  shortcut,
  onClick,
  children,
}: {
  isActive: boolean;
  label: string;
  shortcut: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        onClick={onClick}
        aria-label={label}
        aria-pressed={isActive}
        className={cn(
          "flex items-center justify-center w-9 h-9 rounded-md transition-colors outline-none",
          isActive
            ? "bg-selection text-ink"
            : "text-ink-2 hover:bg-fl-hover hover:text-ink",
        )}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={6}>
        <span className="inline-flex items-center gap-2">
          <span>{label}</span>
          <span className="font-fl-mono text-[10px] opacity-70">{shortcut}</span>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
