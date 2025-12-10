export const supportedLanguages = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "ar", label: "Arabic" },
] as const;

export type LanguageCode = (typeof supportedLanguages)[number]["code"];

export function findLanguage(code: string | null | undefined) {
  return supportedLanguages.find((l) => l.code === code) ?? supportedLanguages[0];
}

