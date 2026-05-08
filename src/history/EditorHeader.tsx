import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";

type Props = {
  title: string;
  dirty: boolean;
  isNew: boolean;
  canDelete: boolean;
  saving: boolean;
  canSave: boolean;
  onCancel?: () => void;
  onDelete: () => void;
  onSave: () => void;
  /** Page-specific actions rendered before the standard Cancel/Delete/Save row. */
  children?: ReactNode;
};

export function EditorHeader({
  title,
  dirty,
  isNew,
  canDelete,
  saving,
  canSave,
  onCancel,
  onDelete,
  onSave,
  children,
}: Props) {
  return (
    <div className="hist-detail-header">
      <div className="text-tag font-medium uppercase tracking-wider text-faint">
        {title}
        {dirty && !isNew && (
          <span className="ml-2 normal-case text-text-muted tracking-normal">
            · Unsaved
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {children}
        {isNew && onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-8">
            Cancel
          </Button>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            title="Delete"
            className="h-8 w-9 px-0 text-text-muted hover:text-[color:var(--color-danger)]"
          >
            <Trash2 size={14} aria-hidden />
          </Button>
        )}
        <Button onClick={onSave} disabled={!canSave} size="sm" className="h-8">
          {saving ? "Saving…" : isNew ? "Create" : "Save"}
        </Button>
      </div>
    </div>
  );
}
