import { useCallback, useEffect, useRef, useState } from "react";
import { commands, type Dictation } from "../lib/tauri";
import { Btn, Tag } from "../components/atoms";
import {
  IconCopy,
  IconPlus,
  IconStar,
  IconTrash,
} from "../components/icons";
import { profileDotColor } from "../lib/profiles";

type Props = {
  dictation: Dictation | null;
  onPaste: () => void;
  onCopy: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  copyFlash: boolean;
  onAddedToVocab: (id: number) => void;
  /** Profile id → display name. Null name (or null id on the dictation)
   *  hides the profile chip from the meta line. */
  profileNames: Map<number, string>;
};

function formatHeaderTime(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const itemDay = new Date(d);
  itemDay.setHours(0, 0, 0, 0);

  const dayLabel =
    itemDay.getTime() === today.getTime()
      ? "Today"
      : itemDay.getTime() === today.getTime() - 86_400_000
        ? "Yesterday"
        : d.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          });

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

  if (!dictation) {
    return (
      <div className="flex-1 flex items-center justify-center text-[13px] text-ink-3 bg-window-bg">
        Select a dictation to see the full transcript.
      </div>
    );
  }

  const dotVar = profileDotColor(profileName);
  const showRaw = dictation.raw_text && dictation.raw_text !== dictation.cleaned_text;

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-window-bg">
      {/* Header */}
      <div className="px-6 py-4 border-b-[0.5px] border-hair">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: dotVar }}
            aria-hidden
          />
          <span className="text-[12px] text-ink-2">
            {profileName ?? "No profile"}
          </span>
          <span className="flex-1" />
          {profileName && <Tag tone="amber">{profileName}</Tag>}
          <span className="font-fl-mono text-[11px] text-ink-3">
            {formatHeaderTime(dictation.created_at)}
          </span>
        </div>
      </div>

      {/* Transcript bodies */}
      <div className="flex-1 overflow-y-auto scrollable px-6 py-5">
        <div className="font-sf text-[11px] font-semibold uppercase tracking-[0.4px] text-ink-3 mb-2 flex items-center gap-2">
          <span>Cleaned</span>
        </div>
        <SelectableBody
          text={dictation.cleaned_text}
          onAdded={onAddedToVocab}
        />

        {showRaw && (
          <>
            <div className="mt-6 font-sf text-[11px] font-semibold uppercase tracking-[0.4px] text-ink-3 mb-2 flex items-center gap-2">
              <span>Raw transcript</span>
            </div>
            <p
              className="m-0 font-fl-mono text-[12.5px] text-ink-2"
              style={{ lineHeight: 1.6 }}
            >
              {dictation.raw_text}
            </p>
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t-[0.5px] border-hair">
        <Btn icon={<IconCopy size={12} />} onClick={onCopy}>
          {copyFlash ? "Copied" : "Copy"}
        </Btn>
        <Btn icon={<IconStar size={12} />} onClick={onFavorite}>
          {dictation.favorite ? "Unstar" : "Star"}
        </Btn>
        <Btn kind="primary" onClick={onPaste}>
          Paste ⌘V
        </Btn>
        <span className="flex-1" />
        <Btn kind="danger" icon={<IconTrash size={12} />} onClick={onDelete}>
          Delete
        </Btn>
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
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [selection, setSelection] = useState<{
    text: string;
    rect: DOMRect;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

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

  useEffect(() => {
    if (!selection) return;
    const dismiss = () => setSelection(null);
    const scroller = bodyRef.current?.closest(".scrollable");
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
      <p
        ref={bodyRef}
        className="m-0 text-[15px] text-ink"
        style={{ lineHeight: 1.55, textWrap: "pretty" }}
      >
        {text}
      </p>

      {selection && (
        <div
          className="fixed z-50"
          style={{
            top: selection.rect.bottom + 8,
            left: Math.max(8, selection.rect.left),
          }}
        >
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-ink text-ink-inverse text-[12px] shadow-md hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            <IconPlus size={12} />
            <span>Add to vocabulary</span>
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-3 py-2 rounded-md bg-ink text-ink-inverse text-[12px] shadow-md z-50"
        >
          {errorMsg}
        </div>
      )}
    </>
  );
}
