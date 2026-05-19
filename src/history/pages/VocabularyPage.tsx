import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { commands, type VocabularyEntry } from "../../lib/tauri";
import { useTauriEvent } from "../../lib/hooks";
import {
  Btn,
  GroupLabel,
  SearchBox,
  Toolbar,
} from "../../components/atoms";
import { IconGrip, IconPlus, IconTrash, IconX } from "../../components/icons";
// Note: Btn is still used by InlineAddRow's "Add ⏎" submit button below.
import { ConfirmDeleteDialog } from "../ConfirmDeleteDialog";

type Props = {
  /** When set on mount, the table scrolls the matching entry into view
   *  and flashes a focus ring on its term cell so the user knows where the
   *  "Add to vocabulary" handoff from History landed them. */
  focusEntryId?: number | null;
  onFocusConsumed?: () => void;
};

export function VocabularyPage({
  focusEntryId = null,
  onFocusConsumed,
}: Props) {
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [search, setSearch] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<VocabularyEntry | null>(null);
  const [flashedId, setFlashedId] = useState<number | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    commands
      .listVocabulary()
      .then((items) => {
        if (cancelled) return;
        setEntries(items);
        if (
          focusEntryId !== null &&
          items.some((e) => e.id === focusEntryId)
        ) {
          setFlashedId(focusEntryId);
          window.setTimeout(() => setFlashedId(null), 1600);
          onFocusConsumed?.();
        }
      })
      .catch((err) => console.error("list_vocabulary failed", err));
    return () => {
      cancelled = true;
    };
  }, [refreshTick, focusEntryId, onFocusConsumed]);

  useTauriEvent<unknown>("vocabulary-changed", () => {
    setRefreshTick((n) => n + 1);
  });

  // Scroll the flashed row into view once the table renders it.
  useEffect(() => {
    if (flashedId == null || !tableRef.current) return;
    const row = tableRef.current.querySelector<HTMLElement>(
      `[data-vocab-id="${flashedId}"]`,
    );
    row?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [flashedId, entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.term.toLowerCase().includes(q) ||
        e.aliases.some((a) => a.toLowerCase().includes(q)),
    );
  }, [entries, search]);

  const handleCreate = useCallback(
    async (term: string, aliasInput: string) => {
      const aliases = aliasInput
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      try {
        await commands.createVocabularyEntry({ term: term.trim(), aliases });
      } catch (err) {
        console.error("create_vocabulary_entry failed", err);
      }
    },
    [],
  );

  const handleUpdateAliases = useCallback(
    async (entry: VocabularyEntry, nextAliases: string[]) => {
      try {
        await commands.updateVocabularyEntry({
          id: entry.id,
          term: entry.term,
          aliases: nextAliases,
        });
      } catch (err) {
        console.error("update_vocabulary_entry failed", err);
      }
    },
    [],
  );

  const handleDeleteConfirm = useCallback(async () => {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    try {
      await commands.deleteVocabularyEntry(target.id);
    } catch (err) {
      console.error("delete_vocabulary_entry failed", err);
    }
  }, [pendingDelete]);

  const aliasTotal = entries.reduce((sum, e) => sum + e.aliases.length, 0);

  return (
    <div className="flex flex-col h-full min-h-0">
      <Toolbar
        section="Vocabulary"
        center={
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Filter terms"
            width={280}
            shortcutHint=""
          />
        }
      />

      <div className="flex-1 flex min-h-0">
        <VocabSidebar count={entries.length} />

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Table header — column template matches the rows below
              (drag/term/aliases/hover-delete). */}
          <div
            className="grid items-center gap-3 px-4 py-2 border-b-[0.5px] border-hair font-sf text-[11px] font-semibold uppercase tracking-[0.4px] text-ink-3"
            style={{
              gridTemplateColumns: "32px 1.2fr 2fr 32px",
              background: "var(--color-table-header-bg)",
            }}
          >
            <span></span>
            <span>Term</span>
            <span>Aliases</span>
            <span></span>
          </div>

          <div ref={tableRef} className="flex-1 overflow-y-auto scrollable">
            <InlineAddRow onCreate={handleCreate} />
            {filtered.length === 0 && entries.length > 0 && (
              <div className="px-4 py-6 text-center text-[12px] text-ink-3">
                No matches
              </div>
            )}
            {filtered.length === 0 && entries.length === 0 && (
              <div className="px-4 py-6 text-center text-[12px] text-ink-3">
                No vocabulary terms yet — add one above.
              </div>
            )}
            {filtered.map((entry) => (
              <VocabRow
                key={entry.id}
                entry={entry}
                flashed={entry.id === flashedId}
                onAliasesChange={(next) => handleUpdateAliases(entry, next)}
                onDelete={() => setPendingDelete(entry)}
              />
            ))}
          </div>

          <div
            className="px-4 py-2 border-t-[0.5px] border-hair flex items-center gap-2 text-[11px] text-ink-3 font-fl-mono"
            style={{ background: "var(--color-table-header-bg)" }}
          >
            <span>
              {entries.length} {entries.length === 1 ? "term" : "terms"} ·{" "}
              {aliasTotal} {aliasTotal === 1 ? "alias" : "aliases"}
            </span>
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete vocabulary term?"
        description={
          pendingDelete ? `“${pendingDelete.term}” will be removed.` : ""
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

function VocabSidebar({ count }: { count: number }) {
  // Minimal sidebar for v1 — the design splits by Frequent/Unused/profile,
  // but vocabulary doesn't track per-row usage frequency or per-profile
  // association in the current schema. Render the structure with just
  // "All terms" so the layout matches; the empty groups land later.
  return (
    <aside
      className="flex flex-col flex-shrink-0 overflow-y-auto border-r-[0.5px] border-hair backdrop-blur-2xl backdrop-saturate-[1.8]"
      style={{ width: 200, background: "var(--color-sidebar-bg)" }}
    >
      <GroupLabel>Scope</GroupLabel>
      <div className="px-2">
        <div className="flex items-center px-2 h-6 rounded-[5px] bg-selection text-[13px]">
          <span className="flex-1 font-medium text-ink">All terms</span>
          <span className="font-fl-mono text-[11px] text-ink-3">{count}</span>
        </div>
      </div>
    </aside>
  );
}

interface InlineAddProps {
  onCreate: (term: string, aliases: string) => Promise<void>;
}

function InlineAddRow({ onCreate }: InlineAddProps) {
  const [term, setTerm] = useState("");
  const [aliases, setAliases] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!term.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onCreate(term, aliases);
      setTerm("");
      setAliases("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="grid items-center gap-3 px-4 py-2 border-b-[0.5px] border-hair"
      style={{
        gridTemplateColumns: "32px 1.2fr 2fr 100px",
        background: "var(--color-amber-soft)",
      }}
    >
      <IconPlus size={14} color="var(--color-amber-ink)" strokeWidth={1.8} />
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="New term…"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
        className="bg-transparent border-0 outline-none font-sf text-[13px] font-medium text-ink"
      />
      <input
        value={aliases}
        onChange={(e) => setAliases(e.target.value)}
        placeholder="aliases, comma-separated"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
        className="bg-transparent border-0 outline-none font-fl-mono text-[12px] text-ink-3"
      />
      <Btn
        kind="primary"
        size="sm"
        disabled={!term.trim() || submitting}
        onClick={handleSubmit}
      >
        Add ⏎
      </Btn>
    </div>
  );
}

interface RowProps {
  entry: VocabularyEntry;
  flashed: boolean;
  onAliasesChange: (next: string[]) => void;
  onDelete: () => void;
}

function VocabRow({ entry, flashed, onAliasesChange, onDelete }: RowProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const handleAdd = () => {
    const next = draft.trim();
    if (!next) {
      setAdding(false);
      return;
    }
    if (entry.aliases.includes(next)) {
      setDraft("");
      setAdding(false);
      return;
    }
    onAliasesChange([...entry.aliases, next]);
    setDraft("");
    setAdding(false);
  };

  const handleRemove = (alias: string) => {
    onAliasesChange(entry.aliases.filter((a) => a !== alias));
  };

  return (
    <div
      data-vocab-id={entry.id}
      className={`grid items-center gap-3 px-4 py-2.5 border-b-[0.5px] border-hair group transition-colors ${
        flashed ? "bg-selection-strong" : "hover:bg-fl-hover"
      }`}
      style={{ gridTemplateColumns: "32px 1.2fr 2fr 32px" }}
    >
      <IconGrip size={14} color="var(--color-ink-4)" />
      <span className="text-[13px] font-medium text-ink truncate">
        {entry.term}
      </span>
      <div className="flex flex-wrap gap-1">
        {entry.aliases.map((a) => (
          <span
            key={a}
            className="inline-flex items-center gap-1 bg-fill border-[0.5px] border-hair pl-[7px] pr-[4px] py-px rounded-[4px] font-fl-mono text-[11px] text-ink-2"
          >
            {a}
            <button
              type="button"
              onClick={() => handleRemove(a)}
              className="bg-transparent border-0 p-0 cursor-pointer text-ink-4 inline-flex hover:text-ink-2"
              aria-label={`Remove ${a}`}
            >
              <IconX size={9} strokeWidth={1.8} />
            </button>
          </span>
        ))}
        {adding ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleAdd}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            placeholder="alias"
            className="bg-input-surface border-[0.5px] border-amber-ink px-1.5 py-px rounded-[4px] font-fl-mono text-[11px] text-ink outline-none w-[120px]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="bg-transparent border-[0.5px] border-dashed border-hair-strong px-1.5 py-px rounded-[4px] text-[11px] text-ink-3 cursor-pointer inline-flex items-center gap-[3px] hover:border-ink-3 hover:text-ink-2"
          >
            <IconPlus size={9} color="var(--color-ink-3)" strokeWidth={1.8} />
            alias
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 inline-flex items-center justify-center w-6 h-6 rounded-md text-ink-3 hover:text-red hover:bg-fl-hover transition-opacity"
        aria-label={`Delete ${entry.term}`}
      >
        <IconTrash size={12} />
      </button>
    </div>
  );
}
