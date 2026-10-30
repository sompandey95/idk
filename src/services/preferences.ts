import type { SupportedLanguage } from "./i18n";

export interface Preferences {
  language: SupportedLanguage;
  reducedMotion: boolean;
  skin: string;
}
export function loadPreferences(): Preferences {
  const language =
    typeof navigator !== "undefined" ? navigator.language.split("-")[0] : "en";
  const defaults: Preferences = {
    language: ["en", "es", "de", "fr", "ja", "zh", "ko"].includes(language)
      ? (language as SupportedLanguage)
      : "en",
    reducedMotion:
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
    skin: "mint",
  };
  try {
    const raw = JSON.parse(
      localStorage.getItem("synapse_preferences_v2") || "null",
    );
    if (!raw) return defaults;
    return {
      ...defaults,
      language: ["en", "es", "de", "fr", "ja", "zh", "ko"].includes(
        raw.language,
      )
        ? raw.language
        : defaults.language,
      reducedMotion:
        typeof raw.reducedMotion === "boolean"
          ? raw.reducedMotion
          : defaults.reducedMotion,
    };
  } catch {
    return defaults;
  }
}
export function savePreferences(preferences: Preferences) {
  try {
    localStorage.setItem("synapse_preferences_v2", JSON.stringify(preferences));
  } catch {
    /* Settings remain active for the session. */
  }
}
