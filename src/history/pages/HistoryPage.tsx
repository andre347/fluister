import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { commands, type Dictation, type Profile } from "../../lib/tauri";
import { useTauriEvent } from "../../lib/hooks";
import { HistoryListPane } from "../HistoryListPane";
import { HistoryDetailPane } from "../HistoryDetailPane";
import { ConfirmDeleteDialog } from "../ConfirmDeleteDialog";

type Props = {
  onAddedToVocab: (id: number) => void;
};

export function HistoryPage({ onAddedToVocab }: Props) {
  const [dictations, setDictations] = useState<Dictation[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [copyFlash, setCopyFlash] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Dictation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Profile name lookup for the chip on each row + the detail meta line.
  // Keyed by Profile.id; absent ids (deleted profiles, pre-v3 rows) just
  // don't render a chip.
  const profileNames = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of profiles) m.set(p.id, p.name);
    return m;
  }, [profiles]);

  // Load profiles once, refresh on the standard profiles-changed event.
  useEffect(() => {
    let cancelled = false;
    commands
      .listProfiles()
      .then((list) => {
        if (!cancelled) setProfiles(list);
      })
      .catch((err) => console.error("list_profiles failed (history)", err));
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);
  useTauriEvent<unknown>("profiles-changed", () => setRefreshTick((n) => n + 1));

  const dictationsRef = useRef(dictations);
  useEffect(() => {
    dictationsRef.current = dictations;
  }, [dictations]);

  // Refresh on filter changes (search debounced 180ms).
  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(async () => {
      try {
        const items = await commands.listDictations({
          limit: 200,
          offset: 0,
          favoritesOnly: false,
          search: search || null,
        });
        if (!cancelled) {
          setDictations(items);
          setIsLoading(false);
          // Auto-select first if nothing selected or selection was filtered out.
          setSelectedId((curr) => {
            if (curr != null && items.some((d) => d.id === curr)) return curr;
            return items[0]?.id ?? null;
          });
        }
      } catch (err) {
        console.error("list_dictations failed", err);
        if (!cancelled) {
          setDictations([]);
          setIsLoading(false);
        }
      }
    }, search ? 180 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [search, refreshTick]);

  useTauriEvent<unknown>("history-changed", () => {
    setRefreshTick((n) => n + 1);
  });

  const selected = useMemo(
    () =>
      selectedId != null ? dictations.find((d) => d.id === selectedId) ?? null : null,
    [dictations, selectedId],
  );
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const moveSelection = useCallback((delta: number) => {
    const list = dictationsRef.current;
    if (list.length === 0) return;
    setSelectedId((curr) => {
      const idx = curr != null ? list.findIndex((d) => d.id === curr) : -1;
      const next =
        idx < 0
          ? delta > 0
            ? 0
            : list.length - 1
          : Math.max(0, Math.min(list.length - 1, idx + delta));
      return list[next].id;
    });
  }, []);

  const handleFavorite = useCallback(async () => {
    const item = selectedRef.current;
    if (!item) return;
    try {
      const newValue = await commands.toggleFavorite(item.id);
      setDictations((curr) =>
        curr.map((d) => (d.id === item.id ? { ...d, favorite: newValue } : d)),
      );
    } catch (err) {
      console.error("toggle_favorite failed", err);
    }
  }, []);

  const handleCopy = useCallback(async () => {
    const item = selectedRef.current;
    if (!item) return;
    try {
      await commands.copyDictation(item.id);
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 900);
    } catch (err) {
      console.error("copy_dictation failed", err);
    }
  }, []);

  const handlePaste = useCallback(async () => {
    const item = selectedRef.current;
    if (!item) return;
    try {
      await commands.pasteDictation(item.id);
    } catch (err) {
      console.error("paste_dictation failed", err);
    }
  }, []);

  const handleDeleteRequest = useCallback(() => {
    const item = selectedRef.current;
    if (item) setPendingDelete(item);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    const item = pendingDelete;
    if (!item) return;
    setPendingDelete(null);
    try {
      await commands.deleteDictation(item.id);
      setDictations((curr) => {
        const next = curr.filter((d) => d.id !== item.id);
        // Move selection to the next item, or the previous if this was last.
        setSelectedId((sid) => {
          if (sid !== item.id) return sid;
          const idx = curr.findIndex((d) => d.id === item.id);
          return next[idx]?.id ?? next[idx - 1]?.id ?? null;
        });
        return next;
      });
    } catch (err) {
      console.error("delete_dictation failed", err);
    }
  }, [pendingDelete]);

  // Page-level shortcuts: ⌘F search, ↑/↓ navigate, ⌘V paste, ⌘C copy, ⌘⌫ delete.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inSearch = document.activeElement === searchInputRef.current;

      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (inSearch) {
        if (e.key === "Escape") {
          e.preventDefault();
          if (search) setSearch("");
          else searchInputRef.current?.blur();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        if (e.key === "v") {
          e.preventDefault();
          handlePaste();
          return;
        }
        if (e.key === "c") {
          e.preventDefault();
          handleCopy();
          return;
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          handleDeleteRequest();
          return;
        }
      }

      switch (e.key) {
        case "ArrowDown":
        case "j":
          if (e.metaKey || e.ctrlKey) return;
          e.preventDefault();
          moveSelection(1);
          break;
        case "ArrowUp":
        case "k":
          if (e.metaKey || e.ctrlKey) return;
          e.preventDefault();
          moveSelection(-1);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [search, moveSelection, handlePaste, handleCopy, handleDeleteRequest]);

  return (
    <div className="hist-twocol">
      <HistoryListPane
        dictations={dictations}
        selectedId={selectedId}
        search={search}
        onSearchChange={setSearch}
        onSelect={setSelectedId}
        searchInputRef={searchInputRef}
        isLoading={isLoading}
        profileNames={profileNames}
      />
      <HistoryDetailPane
        dictation={selected}
        onPaste={handlePaste}
        onCopy={handleCopy}
        onFavorite={handleFavorite}
        onDelete={handleDeleteRequest}
        copyFlash={copyFlash}
        onAddedToVocab={onAddedToVocab}
        profileNames={profileNames}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete this dictation?"
        description="This can't be undone."
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
