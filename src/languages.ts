// Shared language constants and helpers — used by both the history (Settings)
// window and the onboarding window so the catalog stays in one place.

export interface LanguageOption {
  code: string;
  name: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "auto",  name: "Auto-detect" },
  { code: "en-US", name: "English (United States)" },
  { code: "en-GB", name: "English (United Kingdom)" },
  { code: "en-AU", name: "English (Australia)" },
  { code: "es-ES", name: "Spanish (Spain)" },
  { code: "es-LA", name: "Spanish (Latin America)" },
  { code: "fr-FR", name: "French" },
  { code: "de-DE", name: "German" },
  { code: "it-IT", name: "Italian" },
  { code: "pt-BR", name: "Portuguese (Brazil)" },
  { code: "pt-PT", name: "Portuguese (Portugal)" },
  { code: "nl-NL", name: "Dutch" },
  { code: "da-DK", name: "Danish" },
  { code: "sv-SE", name: "Swedish" },
  { code: "no-NO", name: "Norwegian" },
  { code: "fi-FI", name: "Finnish" },
  { code: "el-GR", name: "Greek" },
  { code: "ru-RU", name: "Russian" },
  { code: "pl-PL", name: "Polish" },
  { code: "cs-CZ", name: "Czech" },
  { code: "tr-TR", name: "Turkish" },
  { code: "ar-SA", name: "Arabic" },
  { code: "he-IL", name: "Hebrew" },
  { code: "hi-IN", name: "Hindi" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "zh-TW", name: "Chinese (Traditional)" },
  { code: "ja-JP", name: "Japanese" },
  { code: "ko-KR", name: "Korean" },
  { code: "vi-VN", name: "Vietnamese" },
  { code: "th-TH", name: "Thai" },
  { code: "id-ID", name: "Indonesian" },
  { code: "uk-UA", name: "Ukrainian" },
];

/** True for English variants — those work with the .en Whisper models. */
export function isEnglishLanguage(code: string): boolean {
  return code === "en" || code.startsWith("en-");
}

export function languageDisplayName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code;
}
