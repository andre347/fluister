import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../components/ui/sidebar";

export type Section = "history" | "profiles" | "vocabulary" | "settings";

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "history", label: "History", icon: <HistoryIcon /> },
  { id: "profiles", label: "Profiles", icon: <ProfilesIcon /> },
  { id: "vocabulary", label: "Vocabulary", icon: <VocabularyIcon /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon /> },
];

type Props = {
  section: Section;
  onSectionChange: (s: Section) => void;
};

export function Sidebar({ section, onSectionChange }: Props) {
  return (
    <SidebarRoot collapsible="icon">
      {/* Carve out space for macOS traffic-light buttons + drag region. */}
      <SidebarHeader
        className="h-7 flex-shrink-0"
        data-tauri-drag-region
      />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {SECTIONS.map((s) => (
                <SidebarMenuItem key={s.id}>
                  <SidebarMenuButton
                    isActive={section === s.id}
                    tooltip={s.label}
                    onClick={() => onSectionChange(s.id)}
                  >
                    {s.icon}
                    <span>{s.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </SidebarRoot>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M13 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3Zm-1 4v6l5 3 .75-1.23-4.25-2.52V7H12Z"
      />
    </svg>
  );
}

function ProfilesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.34 0-7 1.67-7 5v1h14v-1c0-3.33-3.66-5-7-5Z"
      />
    </svg>
  );
}

function VocabularyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1Zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5Z"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96a7.025 7.025 0 0 0-1.62-.94l-.36-2.54A.487.487 0 0 0 13.91 2h-3.84a.49.49 0 0 0-.49.41L9.22 4.95c-.59.24-1.13.55-1.62.94l-2.39-.96a.487.487 0 0 0-.59.22L2.71 8.47c-.12.21-.07.49.12.61l2.03 1.58c-.04.31-.07.63-.07.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.21.37.29.59.22l2.39-.96c.5.39 1.03.7 1.62.94l.36 2.54c.05.24.25.41.49.41h3.84c.24 0 .44-.17.49-.41l.36-2.54c.59-.24 1.13-.55 1.62-.94l2.39.96c.22.07.47-.01.59-.22l1.92-3.32c.12-.21.07-.49-.12-.61l-2.01-1.58ZM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2Z"
      />
    </svg>
  );
}
