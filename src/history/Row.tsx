import { useCallback, useState } from "react";
import type { Dictation } from "../lib/tauri";

type Props = {
  dictation: Dictation;
  index: number;
  isExpanded: boolean;
  isSelected: boolean;
  onSelect: (idx: number) => void;
  onToggleExpanded: (id: number) => void;
  onFavorite: (id: number) => void;
  onCopy: (id: number) => Promise<void>;
  onPaste: (id: number) => void;
  onDelete: (id: number) => void;
};

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.max(1, Math.floor(diff / 1000));
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}h ago`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function Row({
  dictation: d,
  index,
  isExpanded,
  isSelected,
  onSelect,
  onToggleExpanded,
  onFavorite,
  onCopy,
  onPaste,
  onDelete,
}: Props) {
  const [copyFlash, setCopyFlash] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await onCopy(d.id);
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 1100);
    } catch {
      /* error already logged in parent */
    }
  }, [onCopy, d.id]);

  const select = () => onSelect(index);

  const meta = `${formatRelative(d.created_at)} · ${(d.duration_ms / 1000).toFixed(1)}s`;

  return (
    <article
      className={`row${isExpanded ? " expanded" : ""}`}
      role="option"
      data-id={d.id}
      data-idx={index}
      aria-selected={isSelected}
    >
      <div
        className="row-body"
        onClick={() => {
          select();
          onToggleExpanded(d.id);
        }}
      >
        <div className="row-text">{d.cleaned_text}</div>
        <div className="row-meta">{meta}</div>
      </div>
      <div className="row-actions">
        <button
          type="button"
          className={`row-action${d.favorite ? " on" : ""}`}
          aria-label={d.favorite ? "Unfavorite" : "Favorite"}
          onClick={(e) => {
            e.stopPropagation();
            select();
            onFavorite(d.id);
          }}
        >
          {d.favorite ? <StarFilled /> : <StarOutline />}
        </button>
        <button
          type="button"
          className="row-action"
          aria-label="Paste into previous app"
          onClick={(e) => {
            e.stopPropagation();
            select();
            onPaste(d.id);
          }}
        >
          <PasteIcon />
        </button>
        <button
          type="button"
          className={`row-action${copyFlash ? " ok" : ""}`}
          aria-label="Copy to clipboard"
          onClick={(e) => {
            e.stopPropagation();
            select();
            handleCopy();
          }}
        >
          {copyFlash ? <CheckIcon /> : <CopyIcon />}
        </button>
        <button
          type="button"
          className="row-action danger"
          aria-label="Delete"
          onClick={(e) => {
            e.stopPropagation();
            select();
            onDelete(d.id);
          }}
        >
          <TrashIcon />
        </button>
      </div>
    </article>
  );
}

const STAR_FILLED_PATH =
  "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21Z";
const STAR_OUTLINE_PATH =
  "m12 15.39-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.39M12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2Z";
const COPY_PATH =
  "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1Zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2Zm0 16H8V7h11v14Z";
const PASTE_PATH =
  "M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2Zm-7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm-1 17-4-4 1.41-1.41L11 16.17l5.59-5.58L18 12l-7 7Z";
const CHECK_PATH = "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z";
const TRASH_PATH =
  "M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z";

function StarFilled() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13">
      <path fill="currentColor" d={STAR_FILLED_PATH} />
    </svg>
  );
}
function StarOutline() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13">
      <path fill="currentColor" d={STAR_OUTLINE_PATH} />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13">
      <path fill="currentColor" d={COPY_PATH} />
    </svg>
  );
}
function PasteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13">
      <path fill="currentColor" d={PASTE_PATH} />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13">
      <path fill="currentColor" d={CHECK_PATH} />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13">
      <path fill="currentColor" d={TRASH_PATH} />
    </svg>
  );
}
