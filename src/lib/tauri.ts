import { invoke } from "@tauri-apps/api/core";

export type Theme = "system" | "light" | "dark";

export type OverlayPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface Dictation {
  id: number;
  created_at: number;
  cleaned_text: string;
  raw_text: string;
  duration_ms: number;
  favorite: boolean;
}

export interface Settings {
  ollama_model: string;
  whisper_model_path: string;
  cleanup_enabled: boolean;
  vad_silence_ms: number;
  overlay_position: OverlayPosition;
  theme: Theme;
  language: string;
  onboarding_complete: boolean;
  active_profile_id: number | null;
}

export interface Profile {
  id: number;
  name: string;
  description: string;
  style_prompt: string;
  vocabulary: string;
  created_at: number;
}

export interface VocabularyEntry {
  id: number;
  term: string;
  aliases: string[];
  created_at: number;
}

export interface UpdateStatus {
  up_to_date: boolean;
  latest_version: string;
}

export type MicStatus =
  | "not-determined"
  | "restricted"
  | "denied"
  | "authorized";

export interface OnboardingStatus {
  microphone: MicStatus;
  accessibility: boolean;
  has_whisper_model: boolean;
  ollama_running: boolean;
  ollama_has_models: boolean;
  onboarding_complete: boolean;
}

export interface ModelInfo {
  filename: string;
  label: string;
  multilingual: boolean;
  size_bytes: number;
  installed: boolean;
  active: boolean;
  path: string;
}

export interface DownloadProgress {
  filename: string;
  downloaded: number;
  total: number;
  bytes_per_sec: number;
}

export interface ModelDownloadDone {
  filename: string;
  path: string;
}

export interface ModelDownloadFailed {
  filename: string;
  error: string;
}

export interface OllamaModel {
  name: string;
  size_bytes: number;
  family: string;
  parameter_size: string;
}

export interface ListDictationsArgs {
  limit?: number;
  offset?: number;
  favoritesOnly?: boolean;
  search?: string | null;
}

export type PrivacyPanel = "microphone" | "accessibility";

export const commands = {
  // Dictations / popover
  listDictations: (args: ListDictationsArgs) =>
    invoke<Dictation[]>("list_dictations", args as Record<string, unknown>),
  copyDictation: (id: number) => invoke<void>("copy_dictation", { id }),
  openHistory: () => invoke<void>("open_history"),
  openSettingsFromPopover: () => invoke<void>("open_settings_from_popover"),
  closePopover: () => invoke<void>("close_popover"),
  quitApp: () => invoke<void>("quit_app"),
  appVersion: () => invoke<string>("app_version"),
  checkForUpdates: () => invoke<UpdateStatus>("check_for_updates"),

  // Settings
  getSettings: () => invoke<Settings>("get_settings"),
  updateSettings: (settings: Settings) =>
    invoke<void>("update_settings", { settings }),

  // Onboarding
  onboardingStatus: () => invoke<OnboardingStatus>("onboarding_status"),
  requestMicrophoneAccess: () =>
    invoke<MicStatus>("request_microphone_access"),
  openPrivacyPanel: (panel: PrivacyPanel) =>
    invoke<void>("open_privacy_panel", { panel }),
  openExternalUrl: (url: string) =>
    invoke<void>("open_external_url", { url }),
  finishOnboarding: () => invoke<void>("finish_onboarding"),

  // Whisper models
  listWhisperModels: () => invoke<ModelInfo[]>("list_whisper_models"),
  downloadWhisperModel: (filename: string) =>
    invoke<void>("download_whisper_model", { filename }),
  setActiveWhisperModel: (path: string) =>
    invoke<void>("set_active_whisper_model", { path }),

  // History row actions
  toggleFavorite: (id: number) => invoke<boolean>("toggle_favorite", { id }),
  deleteDictation: (id: number) => invoke<void>("delete_dictation", { id }),
  pasteDictation: (id: number) => invoke<void>("paste_dictation", { id }),

  // Ollama
  listOllamaModels: () => invoke<OllamaModel[]>("list_ollama_models"),

  // Profiles
  listProfiles: () => invoke<Profile[]>("list_profiles"),
  createProfile: (input: {
    name: string;
    description: string;
    style_prompt: string;
    vocabulary: string;
  }) => invoke<Profile>("create_profile", input as Record<string, unknown>),
  updateProfile: (input: {
    id: number;
    name: string;
    description: string;
    style_prompt: string;
    vocabulary: string;
  }) => invoke<void>("update_profile", input as Record<string, unknown>),
  deleteProfile: (id: number) => invoke<void>("delete_profile", { id }),
  setActiveProfile: (id: number | null) =>
    invoke<void>("set_active_profile", { id }),

  // Vocabulary
  listVocabulary: () => invoke<VocabularyEntry[]>("list_vocabulary"),
  createVocabularyEntry: (input: { term: string; aliases: string[] }) =>
    invoke<VocabularyEntry>(
      "create_vocabulary_entry",
      input as Record<string, unknown>,
    ),
  updateVocabularyEntry: (input: {
    id: number;
    term: string;
    aliases: string[];
  }) =>
    invoke<void>(
      "update_vocabulary_entry",
      input as Record<string, unknown>,
    ),
  deleteVocabularyEntry: (id: number) =>
    invoke<void>("delete_vocabulary_entry", { id }),
};
