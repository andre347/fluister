import { useState } from "react";
import { useTauriEvent, useThemeFromSettings } from "../lib/hooks";
import {
  SidebarInset,
  SidebarProvider,
} from "../components/ui/sidebar";
import { Sidebar, type Section } from "./Sidebar";
import { HistoryPage } from "./pages/HistoryPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { VocabularyPage } from "./pages/VocabularyPage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  const [section, setSection] = useState<Section>("history");

  useThemeFromSettings();

  // The popover "Settings" entry asks the history window to jump straight
  // to the Settings section.
  useTauriEvent<unknown>("show-settings", () => setSection("settings"));

  return (
    <SidebarProvider>
      <Sidebar section={section} onSectionChange={setSection} />
      <SidebarInset className="relative">
        {section === "history" && <HistoryPage />}
        {section === "profiles" && <ProfilesPage />}
        {section === "vocabulary" && <VocabularyPage />}
        {section === "settings" && <SettingsPage />}
      </SidebarInset>
    </SidebarProvider>
  );
}
