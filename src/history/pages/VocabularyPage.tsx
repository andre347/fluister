import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { commands, type VocabularyEntry } from "../../lib/tauri";
import { useTauriEvent } from "../../lib/hooks";
import { Input } from "../../components/ui/input";
import { ConfirmDeleteDialog } from "../ConfirmDeleteDialog";
import { EditorHeader } from "../EditorHeader";
import { EmptyDetail } from "../EmptyDetail";
import { NewItemToolbar } from "../NewItemToolbar";
import { cn } from "../../lib/utils";

const NEW_KEY = "__new__";
type Selection = number | typeof NEW_KEY | null;

type Props = {
  /** When set, the Vocabulary page selects this entry on mount and clears
   *  the intent via `onFocusConsumed`. Used by History's "Add to vocabulary"
   *  flow to drop the user straight onto the new term. */
  focusEntryId?: number | null;
  onFocusConsumed?: () => void;
};

export function VocabularyPage({
  focusEntryId = null,
  onFocusConsumed,
}: Props) {
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<Selection>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<VocabularyEntry | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    commands
      .listVocabulary()
      .then((items) => {
        if (cancelled) return;
        setEntries(items);
        setSelection((curr) => {
          // A pending focus from History's "Add to vocabulary" wins.
          if (
            focusEntryId !== null &&
            items.some((e) => e.id === focusEntryId)
          ) {
            return focusEntryId;
          }
          if (curr === NEW_KEY) return curr;
          if (typeof curr === "number" && items.some((e) => e.id === curr))
            return curr;
          return items[0]?.id ?? null;
        });
        if (focusEntryId !== null) onFocusConsumed?.();
      })
      .catch((err) => console.error("list_vocabulary failed", err));
    return () => {
      cancelled = true;
    };
  }, [refreshTick, focusEntryId, onFocusConsumed]);

  useTauriEvent<unknown>("vocabulary-changed", () => {
    setRefreshTick((n) => n + 1);
  });

  const handleDeleteConfirm = useCallback(async () => {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    try {
      await commands.deleteVocabularyEntry(target.id);
      setSelection((curr) => (curr === target.id ? null : curr));
    } catch (err) {
      console.error("delete_vocabulary_entry failed", err);
    }
  }, [pendingDelete]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.term.toLowerCase().includes(q) ||
        e.aliases.some((a) => a.toLowerCase().includes(q)),
    );
  }, [entries, search]);

  const selectedEntry = useMemo<VocabularyEntry | null>(() => {
    if (selection === NEW_KEY) return null;
    if (typeof selection === "number") {
      return entries.find((e) => e.id === selection) ?? null;
    }
    return null;
  }, [entries, selection]);

  return (
    <div className="hist-twocol">
      <div className="hist-list-pane">
        <NewItemToolbar
          label="New term"
          selected={selection === NEW_KEY}
          onSelect={() => setSelection(NEW_KEY)}
        />
        <div className="hist-list-search">
          <SearchIcon />
          <Input
            ref={searchRef}
            type="search"
            placeholder="Search vocabulary"
            autoComplete="off"
            spellCheck={false}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-6 text-footnote bg-transparent border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="hist-list-scroll scrollable">
          {filtered.length === 0 && selection !== NEW_KEY ? (
            <div className="hist-list-empty">
              {search ? "No matches" : "No vocabulary terms yet"}
            </div>
          ) : (
            filtered.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelection(entry.id)}
                aria-pressed={selection === entry.id}
                className={cn(
                  "hist-list-row",
                  selection === entry.id && "hist-list-row-selected",
                )}
              >
                <div className="text-item font-medium truncate">
                  {entry.term}
                </div>
                {entry.aliases.length > 0 && (
                  <div className="hist-list-row-text text-text-muted">
                    {entry.aliases.join(", ")}
                  </div>
                )}
              </button>
            ))
          )}
          {selection === NEW_KEY && (
            <div className="hist-list-row hist-list-row-selected">
              <div className="text-item font-medium italic text-text-muted">
                New term…
              </div>
            </div>
          )}
        </div>
      </div>

      {selection === null ? (
        <EmptyDetail label="Select a term to edit, or create a new one." />
      ) : selection === NEW_KEY ? (
        <VocabularyEditor
          key="new"
          isNew
          entry={null}
          onDelete={() => {}}
          onSaved={(saved) => {
            setRefreshTick((n) => n + 1);
            setSelection(saved.id);
          }}
          onCancel={() => setSelection(entries[0]?.id ?? null)}
        />
      ) : selectedEntry ? (
        <VocabularyEditor
          key={selectedEntry.id}
          isNew={false}
          entry={selectedEntry}
          onDelete={() => setPendingDelete(selectedEntry)}
          onSaved={() => setRefreshTick((n) => n + 1)}
        />
      ) : (
        <EmptyDetail label="Term not found." />
      )}

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete term?"
        description={
          pendingDelete ? `“${pendingDelete.term}” will be removed.` : ""
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

function VocabularyEditor({
  isNew,
  entry,
  onDelete,
  onSaved,
  onCancel,
}: {
  isNew: boolean;
  entry: VocabularyEntry | null;
  onDelete: () => void;
  onSaved: (saved: VocabularyEntry) => void;
  onCancel?: () => void;
}) {
  const baseline = entry ?? { term: "", aliases: [] as string[] };
  const [term, setTerm] = useState(baseline.term);
  const [aliases, setAliases] = useState<string[]>(baseline.aliases);
  const [aliasDraft, setAliasDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const dirty =
    term !== baseline.term ||
    aliases.join("|") !== baseline.aliases.join("|");
  const canSave = term.trim().length > 0 && (isNew || dirty) && !saving;

  const addAlias = () => {
    const next = aliasDraft.trim();
    if (!next || aliases.includes(next)) {
      setAliasDraft("");
      return;
    }
    setAliases((curr) => [...curr, next]);
    setAliasDraft("");
  };

  const removeAlias = (alias: string) => {
    setAliases((curr) => curr.filter((a) => a !== alias));
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isNew) {
        const created = await commands.createVocabularyEntry({
          term: term.trim(),
          aliases,
        });
        onSaved(created);
      } else if (entry) {
        await commands.updateVocabularyEntry({
          id: entry.id,
          term: term.trim(),
          aliases,
        });
        onSaved({ ...entry, term: term.trim(), aliases });
      }
    } catch (err) {
      console.error("save vocabulary failed", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hist-detail">
      <EditorHeader
        title={isNew ? "New term" : "Edit term"}
        dirty={dirty}
        isNew={isNew}
        canDelete={!isNew && !!entry}
        saving={saving}
        canSave={canSave}
        onCancel={onCancel}
        onDelete={onDelete}
        onSave={handleSave}
      />

      <div className="hist-detail-scroll">
        <div className="flex flex-col gap-5 max-w-[560px]">
          <div className="flex flex-col gap-2">
            <div>
              <div className="text-body font-medium text-foreground">Term</div>
              <div className="text-footnote text-muted-foreground leading-snug mt-1">
                The canonical spelling. Whisper biases toward this; cleanup
                replaces aliases with it.
              </div>
            </div>
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="TypeScript"
              autoFocus={isNew}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div>
              <div className="text-body font-medium text-foreground">Aliases</div>
              <div className="text-footnote text-muted-foreground leading-snug mt-1">
                Spellings that should be replaced with the term above. Match is
                case-insensitive at word boundaries.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {aliases.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center gap-1 rounded-md bg-[color:var(--color-elev)] px-2 h-7 text-caption text-foreground"
                >
                  <span>{a}</span>
                  <button
                    type="button"
                    aria-label={`Remove alias ${a}`}
                    onClick={() => removeAlias(a)}
                    className="text-text-muted hover:text-foreground"
                  >
                    <X size={11} aria-hidden />
                  </button>
                </span>
              ))}
              <Input
                value={aliasDraft}
                onChange={(e) => setAliasDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addAlias();
                  } else if (
                    e.key === "Backspace" &&
                    aliasDraft === "" &&
                    aliases.length > 0
                  ) {
                    setAliases((curr) => curr.slice(0, -1));
                  }
                }}
                onBlur={addAlias}
                placeholder={aliases.length === 0 ? "type script, typescript…" : "add alias…"}
                className="h-7 w-[180px] text-caption"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
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
