import { Plus } from "lucide-react";
import { Button } from "../components/ui/button";

type Props = {
  label: string;
  selected: boolean;
  onSelect: () => void;
};

export function NewItemToolbar({ label, selected, onSelect }: Props) {
  return (
    <div className="hist-list-toolbar">
      <Button
        size="sm"
        variant="ghost"
        className="w-full justify-start gap-2 h-8 text-item"
        onClick={onSelect}
        aria-pressed={selected}
      >
        <Plus size={13} aria-hidden />
        <span>{label}</span>
      </Button>
    </div>
  );
}
