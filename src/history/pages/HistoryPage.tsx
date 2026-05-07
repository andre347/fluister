import { useCallback, useEffect, useRef, useState } from "react";
import { commands, type Dictation } from "../../lib/tauri";
import { useTauriEvent } from "../../lib/hooks";
import { HistoryList } from "../HistoryList";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

export function HistoryPage() {
  const [dictations, setDictations] = useState<Dictation[]>([]);
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [refreshTick, setRefreshTick] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const dictationsRef = useRef(dictations);
  const searchRef = useRef(search);
  useEffect(() => {
    dictationsRef.current = dictations;
  }, [dictations]);
  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  // Refresh on filter changes (search debounced 180ms).
  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(async () => {
      try {
        const items = await commands.listDictations({
          limit: 200,
          offset: 0,
          favoritesOnly,
          search: search || null,
        });
        if (!cancelled) {
          setDictations(items);
          setSelectedIndex(-1);
        }
      } catch (err) {
        console.error("list_dictations failed", err);
        if (!cancelled) setDictations([]);
      }
    }, search ? 180 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [search, favoritesOnly, refreshTick]);

  useTauriEvent<unknown>("history-changed", () => {
    setRefreshTick((n) => n + 1);
  });

  // Keyboard nav while history page is mounted.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "f" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (document.activeElement === searchInputRef.current) {
        if (e.key === "Escape") {
          e.preventDefault();
          if (searchRef.current) {
            setSearch("");
          } else {
            searchInputRef.current?.blur();
          }
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          moveSelection(1);
          break;
        case "ArrowUp":
          e.preventDefault();
          moveSelection(-1);
          break;
        case "Enter": {
          e.preventDefault();
          setSelectedIndex((curr) => {
            if (curr < 0) return curr;
            const id = dictationsRef.current[curr]?.id;
            if (id !== undefined) toggleExpanded(id);
            return curr;
          });
          break;
        }
        case "j":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            moveSelection(1);
          }
          break;
        case "k":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            moveSelection(-1);
          }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const moveSelection = useCallback((delta: number) => {
    const len = dictationsRef.current.length;
    if (len === 0) return;
    setSelectedIndex((curr) => {
      const next =
        curr < 0
          ? delta > 0
            ? 0
            : len - 1
          : Math.max(0, Math.min(len - 1, curr + delta));
      window.requestAnimationFrame(() => {
        const row = document.querySelector<HTMLElement>(
          `.row[data-idx="${next}"]`,
        );
        row?.scrollIntoView({ block: "nearest" });
      });
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((id: number) => {
    setExpanded((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onFavorite = useCallback(async (id: number) => {
    try {
      const newValue = await commands.toggleFavorite(id);
      setDictations((curr) =>
        curr.map((d) => (d.id === id ? { ...d, favorite: newValue } : d)),
      );
    } catch (err) {
      console.error("toggle_favorite failed", err);
    }
  }, []);

  const onCopy = useCallback(async (id: number) => {
    await commands.copyDictation(id);
  }, []);

  const onPaste = useCallback(async (id: number) => {
    try {
      await commands.pasteDictation(id);
    } catch (err) {
      console.error("paste_dictation failed", err);
    }
  }, []);

  const onDelete = useCallback(async (id: number) => {
    try {
      await commands.deleteDictation(id);
      setDictations((curr) => curr.filter((d) => d.id !== id));
      setExpanded((curr) => {
        if (!curr.has(id)) return curr;
        const next = new Set(curr);
        next.delete(id);
        return next;
      });
      setSelectedIndex((curr) =>
        Math.min(curr, dictationsRef.current.length - 2),
      );
    } catch (err) {
      console.error("delete_dictation failed", err);
    }
  }, []);

  return (
    <PageLayout
      title="History"
      actions={
        <div className="flex items-center gap-2">
          <div className="relative w-[220px]">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint">
              <SearchIcon />
            </span>
            <Input
              ref={searchInputRef}
              id="history-search"
              type="search"
              placeholder="Search dictations"
              autoComplete="off"
              spellCheck={false}
              aria-label="Search dictations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-8"
            />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Show favorites only"
            aria-pressed={favoritesOnly}
            onClick={() => setFavoritesOnly((f) => !f)}
            className={favoritesOnly ? "text-accent-yellow" : ""}
          >
            <StarFilledIcon />
          </Button>
        </div>
      }
    >
      <HistoryList
        dictations={dictations}
        expanded={expanded}
        selectedIndex={selectedIndex}
        isFiltered={Boolean(search) || favoritesOnly}
        onSelect={setSelectedIndex}
        onToggleExpanded={toggleExpanded}
        onFavorite={onFavorite}
        onCopy={onCopy}
        onPaste={onPaste}
        onDelete={onDelete}
      />
    </PageLayout>
  );
}

export function PageLayout({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <header
        data-tauri-drag-region
        className="flex items-center justify-between px-6 py-3 border-b border-border min-h-[52px]"
      >
        <h1 className="text-title font-semibold text-foreground m-0">
          {title}
        </h1>
        <div data-tauri-drag-region="false">{actions}</div>
      </header>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {children}
      </div>
    </>
  );
}

function SearchIcon() {
  return (
    <svg
      className="text-faint shrink-0"
      viewBox="0 0 16 16"
      width="13"
      height="13"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M11.74 10.32a6 6 0 1 0-1.42 1.42l3.47 3.47a1 1 0 0 0 1.42-1.42l-3.47-3.47ZM3 7a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
      />
    </svg>
  );
}

function StarFilledIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21Z"
      />
    </svg>
  );
}
