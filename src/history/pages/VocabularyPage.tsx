import { useCallback, useEffect, useState } from "react";
import { commands, type VocabularyEntry } from "../../lib/tauri";
import { useTauriEvent } from "../../lib/hooks";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { PageLayout } from "./HistoryPage";

export function VocabularyPage() {
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    commands
      .listVocabulary()
      .then((items) => {
        if (!cancelled) setEntries(items);
      })
      .catch((err) => console.error("list_vocabulary failed", err));
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  useTauriEvent<unknown>("vocabulary-changed", () => {
    setRefreshTick((n) => n + 1);
  });

  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await commands.deleteVocabularyEntry(id);
    } catch (err) {
      console.error("delete_vocabulary_entry failed", err);
    }
  }, []);

  const editing =
    editingId === "new"
      ? { id: 0, term: "", aliases: [], created_at: 0 }
      : editingId !== null
        ? entries.find((e) => e.id === editingId) ?? null
        : null;

  return (
    <PageLayout
      title="Vocabulary"
      actions={
        <Button size="sm" onClick={() => setEditingId("new")}>
          + New term
        </Button>
      }
    >
      <div className="flex-1 overflow-y-auto px-6 py-4 scrollable">
        <p className="text-footnote text-muted-foreground mb-4 max-w-[640px]">
          Terms are biased into Whisper's initial prompt for accurate
          transcription. Aliases are replaced with the canonical term in the
          cleaned output — e.g.{" "}
          <code className="bg-elev px-1 py-0.5 rounded">type script</code> →{" "}
          <code className="bg-elev px-1 py-0.5 rounded">TypeScript</code>.
        </p>
        <div className="flex flex-col gap-2 max-w-[640px]">
          {entries.map((entry) => (
            <VocabularyRow
              key={entry.id}
              entry={entry}
              onEdit={() => setEditingId(entry.id)}
              onDelete={() => handleDelete(entry.id)}
            />
          ))}
          {entries.length === 0 && (
            <p className="text-muted-foreground text-body">
              No vocabulary entries yet. Add a term to start improving
              transcription accuracy.
            </p>
          )}
        </div>
      </div>

      <VocabularyEditor
        open={editing !== null}
        onOpenChange={(open) => !open && setEditingId(null)}
        entry={editing}
        isNew={editingId === "new"}
        onSaved={() => {
          setEditingId(null);
          setRefreshTick((n) => n + 1);
        }}
      />
    </PageLayout>
  );
}

function VocabularyRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: VocabularyEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="text-body font-medium text-foreground">
            {entry.term}
          </div>
          {entry.aliases.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {entry.aliases.map((a, i) => (
                <span
                  key={`${a}-${i}`}
                  className="text-footnote text-muted-foreground bg-elev rounded px-1.5 py-0.5"
                >
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete entry"
            onClick={onDelete}
          >
            <TrashIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}

function VocabularyEditor({
  open,
  onOpenChange,
  entry,
  isNew,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: VocabularyEntry | null;
  isNew: boolean;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        {entry && (
          <VocabularyEditorBody
            key={entry.id || "new"}
            entry={entry}
            isNew={isNew}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function VocabularyEditorBody({
  entry,
  isNew,
  onClose,
  onSaved,
}: {
  entry: VocabularyEntry;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [term, setTerm] = useState(entry.term);
  const [aliasesText, setAliasesText] = useState(entry.aliases.join(", "));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!term.trim()) return;
    const aliases = aliasesText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    setSaving(true);
    try {
      if (isNew) {
        await commands.createVocabularyEntry({
          term: term.trim(),
          aliases,
        });
      } else {
        await commands.updateVocabularyEntry({
          id: entry.id,
          term: term.trim(),
          aliases,
        });
      }
      onSaved();
    } catch (err) {
      console.error("save vocabulary failed", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isNew ? "New term" : `Edit ${entry.term}`}</DialogTitle>
        <DialogDescription>
          The term seeds Whisper's transcription bias. Aliases are
          replaced with the term in cleaned output.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="text-body font-medium text-foreground">Term</div>
          <div className="text-footnote text-muted-foreground -mt-1">
            The canonical spelling (output).
          </div>
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="TypeScript"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-body font-medium text-foreground">Aliases</div>
          <div className="text-footnote text-muted-foreground -mt-1">
            Comma-separated. Each alias is replaced with the term above.
            Match is case-insensitive at word boundaries.
          </div>
          <Input
            value={aliasesText}
            onChange={(e) => setAliasesText(e.target.value)}
            placeholder="type script, typescript"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || !term.trim()}>
          {saving ? "Saving…" : isNew ? "Create" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"
      />
    </svg>
  );
}
