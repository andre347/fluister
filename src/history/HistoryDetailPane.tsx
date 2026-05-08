import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { commands, type Dictation } from "../lib/tauri";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

type Props = {
  dictation: Dictation | null;
  onPaste: () => void;
  onCopy: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  copyFlash: boolean;
  onAddedToVocab: (id: number) => void;
  /** Profile id → display name. Null name (or null id on the dictation)
   *  hides the profile segment from the meta line. */
  profileNames: Map<number, string>;
};

function formatMeta(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const itemDay = new Date(d);
  itemDay.setHours(0, 0, 0, 0);

  const dayLabel =
    itemDay.getTime() === today.getTime()
      ? "TODAY"
      : itemDay.getTime() === today.getTime() - 86_400_000
        ? "YESTERDAY"
        : d
            .toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })
            .toUpperCase();

  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${dayLabel} · ${time}`;
}

export function HistoryDetailPane({
  dictation,
  onPaste,
  onCopy,
  onFavorite,
  onDelete,
  copyFlash,
  onAddedToVocab,
  profileNames,
}: Props) {
  const profileName =
    dictation?.profile_id != null
      ? profileNames.get(dictation.profile_id) ?? null
      : null;
  const [rawOpen, setRawOpen] = useState(true);

  if (!dictation) {
    return (
      <div className="hist-detail-empty">
        <span>Select a dictation to see the full transcript.</span>
      </div>
    );
  }

  return (
    <div className="hist-detail">
      <div className="hist-detail-header">
        <div className="text-tag font-medium uppercase tracking-wider text-faint">
          {formatMeta(dictation.created_at)}
          {profileName && (
            <>
              {" · "}
              <span>{profileName.toUpperCase()} PROFILE</span>
            </>
          )}
          {dictation.duration_ms > 0 && (
            <>
              {" · "}
              <span className="font-mono normal-case tracking-normal">
                {(dictation.duration_ms / 1000).toFixed(1)}s
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onFavorite}
            title={dictation.favorite ? "Unfavorite" : "Favorite"}
            className="h-8 w-9 px-0"
          >
            <Star
              size={14}
              aria-hidden
              className={cn(
                dictation.favorite &&
                  "fill-[color:var(--color-accent-yellow)] text-[color:var(--color-accent-yellow)]",
              )}
            />
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onPaste}
            className="h-8 gap-1.5 text-caption"
          >
            <ClipboardPaste size={13} aria-hidden />
            <span>Paste</span>
            <kbd className="font-mono text-[10px] opacity-80 ml-0.5">⌘V</kbd>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopy}
            title="Copy (⌘C)"
            className={cn(
              "h-8 px-2.5 gap-1 text-caption",
              copyFlash && "text-[color:var(--color-success)]",
            )}
          >
            <Copy size={13} aria-hidden />
            <span>Copy</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            title="Delete (⌘⌫)"
            className="h-8 w-9 px-0 text-text-muted hover:text-[color:var(--color-danger)]"
          >
            <Trash2 size={14} aria-hidden />
          </Button>
        </div>
      </div>

      <div className="hist-detail-scroll scrollable">
        <SelectableBody
          text={dictation.cleaned_text}
          onAdded={onAddedToVocab}
        />

        {dictation.raw_text && dictation.raw_text !== dictation.cleaned_text && (
          <>
            <div className="hist-detail-separator" />
            <button
              type="button"
              onClick={() => setRawOpen((o) => !o)}
              className="flex items-center gap-1 text-tag font-medium uppercase tracking-wider text-faint hover:text-foreground transition-colors"
            >
              {rawOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <span>Raw transcript</span>
            </button>
            {rawOpen && (
              <div className="hist-detail-raw">{dictation.raw_text}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Renders the cleaned-text body and surfaces an "Add to vocabulary" floating
 * chip when the user highlights any 1–60 char fragment inside the body.
 * Clicking the chip creates a vocabulary entry with the selection as term,
 * then calls `onAdded(id)` so the parent can navigate to the Vocabulary tab
 * and pre-select the new entry — letting the user immediately add aliases.
 */
function SelectableBody({
  text,
  onAdded,
}: {
  text: string;
  onAdded: (id: number) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{
    text: string;
    rect: DOMRect;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Recompute selection on mouseup / keyup. selectionchange would also work
  // but fires on every cursor movement and is harder to scope.
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const body = bodyRef.current;
      if (!body || !body.contains(range.commonAncestorContainer)) {
        setSelection(null);
        return;
      }
      const raw = sel.toString().trim();
      if (raw.length === 0 || raw.length > 60) {
        setSelection(null);
        return;
      }
      setSelection({ text: raw, rect: range.getBoundingClientRect() });
    };
    document.addEventListener("mouseup", handler);
    document.addEventListener("keyup", handler);
    return () => {
      document.removeEventListener("mouseup", handler);
      document.removeEventListener("keyup", handler);
    };
  }, []);

  // Dismiss the chip when scrolling — its anchor goes stale.
  useEffect(() => {
    if (!selection) return;
    const dismiss = () => setSelection(null);
    const scroller = bodyRef.current?.closest(".hist-detail-scroll");
    scroller?.addEventListener("scroll", dismiss, { passive: true });
    window.addEventListener("resize", dismiss);
    return () => {
      scroller?.removeEventListener("scroll", dismiss);
      window.removeEventListener("resize", dismiss);
    };
  }, [selection]);

  const handleAdd = useCallback(async () => {
    if (!selection || adding) return;
    setAdding(true);
    try {
      const created = await commands.createVocabularyEntry({
        term: selection.text,
        aliases: [],
      });
      window.getSelection()?.removeAllRanges();
      setSelection(null);
      // Hand off to the parent — it switches to the Vocabulary tab and
      // pre-selects the new entry so the user can add aliases right away.
      onAdded(created.id);
    } catch (err) {
      console.error("create_vocabulary_entry failed", err);
      setErrorMsg("Couldn't add to vocabulary");
      window.setTimeout(() => setErrorMsg(null), 1800);
    } finally {
      setAdding(false);
    }
  }, [selection, adding, onAdded]);

  return (
    <>
      <div ref={bodyRef} className="hist-detail-body">
        {text}
      </div>

      {selection && (
        <div
          className="hist-vocab-floater"
          style={{
            top: selection.rect.bottom + 8,
            left: Math.max(8, selection.rect.left),
          }}
        >
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-foreground text-background text-caption shadow-md hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            <Plus size={12} aria-hidden />
            <span>Add to vocabulary</span>
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="hist-vocab-toast" role="status">
          {errorMsg}
        </div>
      )}
    </>
  );
}
