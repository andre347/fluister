import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { commands, type Dictation, type Profile } from "../../lib/tauri";
import { useTauriEvent } from "../../lib/hooks";
import {
  HistoryListPane,
  type ListMode,
} from "../HistoryListPane";
import { HistoryDetailPane } from "../HistoryDetailPane";
import { HistorySidebar, type HistoryFilter } from "../HistorySidebar";
import { ConfirmDeleteDialog } from "../ConfirmDeleteDialog";
import { Toolbar, SearchBox } from "../../components/atoms";

type Props = {
  onAddedToVocab: (id: number) => void;
};

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function applyFilter(items: Dictation[], filter: HistoryFilter): Dictation[] {
  switch (filter.kind) {
    case "all":
      return items;
    case "today": {
      const t = startOfToday();
      return items.filter((d) => d.created_at >= t);
    }
    case "starred":
      return items.filter((d) => d.favorite);
    case "profile":
      return items.filter((d) => d.profile_id === filter.id);
  }
}

export function HistoryPage({ onAddedToVocab }: Props) {
  const [dictations, setDictations] = useState<Dictation[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>({ kind: "all" });
  const [mode, setMode] = useState<ListMode>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [copyFlash, setCopyFlash] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Dictation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Refresh on filter/search changes (search debounced 180ms).
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

  // Sidebar/filter narrows the loaded list before it hits the list pane.
  const filteredDictations = useMemo(
    () => applyFilter(dictations, filter),
    [dictations, filter],
  );

  // Keep selection valid against the *filtered* set; auto-select first
  // when nothing was previously selected (or selection got filtered out).
  useEffect(() => {
    setSelectedId((curr) => {
      if (curr != null && filteredDictations.some((d) => d.id === curr)) {
        return curr;
      }
      return filteredDictations[0]?.id ?? null;
    });
  }, [filteredDictations]);

  const selected = useMemo(
    () =>
      selectedId != null
        ? filteredDictations.find((d) => d.id === selectedId) ?? null
        : null,
    [filteredDictations, selectedId],
  );
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const moveSelection = useCallback((delta: number) => {
    const list = applyFilter(dictationsRef.current, filter);
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
  }, [filter]);

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
      setDictations((curr) => curr.filter((d) => d.id !== item.id));
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

  const totalLabel =
    filteredDictations.length === 1
      ? "1 item"
      : `${filteredDictations.length.toLocaleString()} items`;

  return (
    <div className="flex flex-col h-full min-h-0">
      <Toolbar
        section="History"
        center={
          <SearchBox
            ref={searchInputRef}
            value={search}
            onChange={setSearch}
            placeholder="Search transcripts"
            width={300}
          />
        }
      />

      <div className="flex-1 flex min-h-0">
        <HistorySidebar
          dictations={dictations}
          profiles={profiles}
          filter={filter}
          onFilterChange={setFilter}
        />
        <HistoryListPane
          dictations={filteredDictations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          isLoading={isLoading}
          profiles={profiles}
          profileNames={profileNames}
          totalLabel={totalLabel}
          mode={mode}
          onModeChange={setMode}
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
      </div>

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
