import { useCallback, useEffect, useState } from "react";
import { useTauriEvent, useThemeFromSettings } from "../lib/hooks";
import { TooltipProvider } from "../components/ui/tooltip";
import { IconRail, type Section } from "./IconRail";
import { HistoryPage } from "./pages/HistoryPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { VocabularyPage } from "./pages/VocabularyPage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  const [section, setSection] = useState<Section>("history");
  const [vocabFocusId, setVocabFocusId] = useState<number | null>(null);

  useThemeFromSettings();

  // The popover "Settings" entry asks the history window to jump straight
  // to the Settings section.
  useTauriEvent<unknown>("show-settings", () => setSection("settings"));

  // Window-level shortcuts: ⌘1/⌘2/⌘3 jump between rail sections, ⌘,
  // opens Settings (which is hidden from the rail per the design but
  // still lives in the same window).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.shiftKey || e.altKey) return;
      const next: Record<string, Section> = {
        "1": "history",
        "2": "profiles",
        "3": "vocabulary",
        ",": "settings",
      };
      const target = next[e.key];
      if (!target) return;
      // Don't hijack ⌘1/⌘, when typing in an input.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      setSection(target);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Selecting "Add to vocabulary" in the History detail pane should both
  // create the entry AND drop the user into Vocabulary with the new term
  // selected, so they can add aliases without breaking flow.
  const handleVocabAdded = useCallback((id: number) => {
    setVocabFocusId(id);
    setSection("vocabulary");
  }, []);

  return (
    <TooltipProvider delay={300}>
      <div className="hist-shell">
        {/* Title bar — spans full width so traffic lights overlay neatly. */}
        <div className="hist-titlebar" data-tauri-drag-region />
        <IconRail section={section} onSectionChange={setSection} />
        <div className="hist-content">
          {section === "history" && (
            <HistoryPage onAddedToVocab={handleVocabAdded} />
          )}
          {section === "profiles" && <ProfilesPage />}
          {section === "vocabulary" && (
            <VocabularyPage
              focusEntryId={vocabFocusId}
              onFocusConsumed={() => setVocabFocusId(null)}
            />
          )}
          {section === "settings" && <SettingsPage />}
        </div>
      </div>
    </TooltipProvider>
  );
}
