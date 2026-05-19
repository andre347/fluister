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
  /** ID of the profile that was active when this dictation was recorded.
   *  Null on rows pre-dating profile_id (migration v3) or if no profile
   *  resolved at recording time. */
  profile_id: number | null;
}

export type LlmBackend = "bundled" | "external_ollama";

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
  /** Filesystem path to the user's Fluister vault, or null for SQLite-only.
   *  See Settings → Storage to set/change this. */
  vault_path: string | null;
  /** Cleanup backend. "bundled" runs the in-app llama-server sidecar
   *  (default for new installs). "external_ollama" defers to a separately
   *  installed Ollama daemon — exposed as an advanced toggle. */
  llm_backend: LlmBackend;
  /** Path to the gguf model the bundled sidecar loads. Null = use the
   *  default location for the catalog's first entry. */
  llm_model_path: string | null;
  /** When true, Fluister runs a local MCP server on 127.0.0.1:43210 so AI
   *  clients (Claude Desktop, Cursor, Claude Code, Zed) can query
   *  dictation history, run cleanup, and append into the vault. Opt-in. */
  mcp_enabled: boolean;
}

export interface Profile {
  id: number;
  name: string;
  description: string;
  style_prompt: string;
  vocabulary: string;
  created_at: number;
  /** macOS bundle IDs (e.g. "com.apple.mail") where this profile auto-
   *  activates when the user holds the dictation hotkey. Empty list means
   *  no auto-binding. */
  app_bindings: string[];
}

export interface InstalledApp {
  bundle_id: string;
  name: string;
}

export interface VocabularyEntry {
  id: number;
  term: string;
  aliases: string[];
  created_at: number;
}

export type MicStatus =
  | "not-determined"
  | "restricted"
  | "denied"
  | "authorized";

export interface OnboardingStatus {
  microphone: MicStatus;
  accessibility: boolean;
  /** True when Fluister has Input Monitoring permission. Required for the
   *  global hotkey to fire when another app is focused. */
  input_monitoring: boolean;
  has_whisper_model: boolean;
  /** True when the bundled cleanup model gguf is present on disk. */
  has_llm_model: boolean;
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

export interface LlmModelInfo {
  id: string;
  filename: string;
  label: string;
  size_bytes: number;
  installed: boolean;
  active: boolean;
  path: string;
}

export interface LlmDownloadProgress {
  id: string;
  filename: string;
  downloaded: number;
  total: number;
  bytes_per_sec: number;
}

export interface LlmDownloadDone {
  id: string;
  filename: string;
  path: string;
}

export interface LlmDownloadFailed {
  id: string;
  error: string;
}

export interface VaultStatus {
  /** Absolute path of the configured vault, or null for SQLite-only mode. */
  path: string | null;
  exists: boolean;
  profile_count: number;
  vocab_count: number;
}

interface ListDictationsArgs {
  limit?: number;
  offset?: number;
  favoritesOnly?: boolean;
  search?: string | null;
}

type PrivacyPanel = "microphone" | "accessibility" | "input-monitoring";

export const commands = {
  // Dictations
  listDictations: (args: ListDictationsArgs) =>
    invoke<Dictation[]>("list_dictations", args as Record<string, unknown>),
  copyDictation: (id: number) => invoke<void>("copy_dictation", { id }),

  // App
  appVersion: () => invoke<string>("app_version"),

  // Settings
  getSettings: () => invoke<Settings>("get_settings"),
  updateSettings: (settings: Settings) =>
    invoke<void>("update_settings", { settings }),

  // Onboarding
  onboardingStatus: () => invoke<OnboardingStatus>("onboarding_status"),
  showOnboardingWindow: () => invoke<void>("show_onboarding_window"),
  requestMicrophoneAccess: () =>
    invoke<MicStatus>("request_microphone_access"),
  requestInputMonitoringAccess: () =>
    invoke<boolean>("request_input_monitoring_access"),
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

  // Ollama (legacy external backend — kept for the advanced toggle)
  listOllamaModels: () => invoke<OllamaModel[]>("list_ollama_models"),

  // Bundled cleanup LLM (llama-server sidecar)
  listLlmModels: () => invoke<LlmModelInfo[]>("list_llm_models"),
  downloadLlmModel: (id: string) =>
    invoke<string>("download_llm_model", { id }),
  setActiveLlmModel: (path: string) =>
    invoke<void>("set_active_llm_model", { path }),

  // Profiles
  //
  // Tauri 2 expects camelCase argument names in invoke payloads — it
  // auto-converts to snake_case Rust parameters. Sending snake_case
  // ("style_prompt") fails with "missing required key stylePrompt". So
  // these bindings translate at the boundary and the rest of the app
  // stays free to use the snake_case Profile shape that comes back.
  listProfiles: () => invoke<Profile[]>("list_profiles"),
  createProfile: (input: {
    name: string;
    description: string;
    style_prompt: string;
    vocabulary: string;
    app_bindings?: string[];
  }) =>
    invoke<Profile>("create_profile", {
      name: input.name,
      description: input.description,
      stylePrompt: input.style_prompt,
      vocabulary: input.vocabulary,
      appBindings: input.app_bindings,
    }),
  updateProfile: (input: {
    id: number;
    name: string;
    description: string;
    style_prompt: string;
    vocabulary: string;
    app_bindings?: string[];
  }) =>
    invoke<void>("update_profile", {
      id: input.id,
      name: input.name,
      description: input.description,
      stylePrompt: input.style_prompt,
      vocabulary: input.vocabulary,
      appBindings: input.app_bindings,
    }),
  deleteProfile: (id: number) => invoke<void>("delete_profile", { id }),
  setActiveProfile: (id: number | null) =>
    invoke<void>("set_active_profile", { id }),
  /** macOS app picker — enumerates /Applications, ~/Applications and
   *  /System/Applications via NSBundle. Returns ~150 entries on a
   *  typical machine; the UI filters client-side. */
  listInstalledApps: () => invoke<InstalledApp[]>("list_installed_apps"),
  /** Run the Ollama cleanup pipeline against arbitrary raw text + style
   *  prompt. Used by the Profiles editor's live preview pane. Returns
   *  the cleaned string, or rejects with a stringified error. */
  cleanupPreview: (raw: string, stylePrompt: string) =>
    invoke<string>("cleanup_preview", {
      rawText: raw,
      stylePrompt,
    }),

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

  // Vault
  vaultStatus: () => invoke<VaultStatus>("vault_status"),
  setVaultPath: (path: string) =>
    invoke<VaultStatus>("set_vault_path", { path }),
  clearVaultPath: () => invoke<VaultStatus>("clear_vault_path"),
  openVaultInFinder: () => invoke<void>("open_vault_in_finder"),
  suggestedVaultPath: () => invoke<string>("suggested_vault_path"),
};
