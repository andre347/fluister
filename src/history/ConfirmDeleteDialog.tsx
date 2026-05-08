import { useEffect, useRef, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
} from "../components/ui/dialog";
import { Btn } from "../components/atoms";

type Props = {
  open: boolean;
  title: string;
  description: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
};

/** macOS-style confirm-destruction sheet. Tight 320–360px content,
 *  no close-X (cancel is the dismiss path), no muted footer band — just
 *  a hairline above the action row. The Delete button is the prominent
 *  filled-red destructive action; Cancel is the default bordered button.
 *  ⏎ activates Delete and ⎋ activates Cancel. */
export function ConfirmDeleteDialog({
  open,
  title,
  description,
  onCancel,
  onConfirm,
}: Props) {
  const deleteRef = useRef<HTMLButtonElement>(null);

  // Focus Delete on open so ⏎ fires it. ⎋ is handled by the dialog
  // primitive (closes via onOpenChange → onCancel).
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => deleteRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[360px] p-0 gap-0 rounded-[10px] bg-sheet-bg ring-0 shadow-[0_24px_60px_rgba(0,0,0,0.18),0_0_0_0.5px_rgba(0,0,0,0.18)]"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onConfirm();
          }
        }}
      >
        <div className="px-5 pt-5 pb-4">
          <h2
            className="m-0 text-[15px] font-semibold text-ink leading-tight"
            style={{
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
            }}
          >
            {title}
          </h2>
          {description && (
            <div className="mt-1.5 text-[12.5px] text-ink-2 leading-[1.45]">
              {description}
            </div>
          )}
        </div>
        <div className="px-5 py-3 flex justify-end gap-2 border-t-[0.5px] border-hair">
          <Btn size="md" onClick={onCancel}>
            Cancel
          </Btn>
          <Btn ref={deleteRef} kind="destructive" size="md" onClick={onConfirm}>
            Delete
          </Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
}
