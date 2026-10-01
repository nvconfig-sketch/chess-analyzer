export type AiProvider = "gemini" | "openai";

export type AiSettings = {
  provider: AiProvider;
  apiKeys: Record<AiProvider, string>;
};

const STORAGE_KEY = "chess-analyzer-ai-settings";
const SETTINGS_EVENT = "chess-analyzer-ai-settings-change";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: "gemini",
  apiKeys: { gemini: "", openai: "" },
};

let cachedRaw: string | null | undefined;
let cachedSettings = DEFAULT_AI_SETTINGS;

export function getAiSettingsSnapshot(): AiSettings {
  if (typeof window === "undefined") return DEFAULT_AI_SETTINGS;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSettings;

  cachedRaw = raw;
  if (!raw) {
    cachedSettings = DEFAULT_AI_SETTINGS;
    return cachedSettings;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    cachedSettings = {
      provider: parsed.provider === "openai" ? "openai" : "gemini",
      apiKeys: {
        gemini: typeof parsed.apiKeys?.gemini === "string" ? parsed.apiKeys.gemini : "",
        openai: typeof parsed.apiKeys?.openai === "string" ? parsed.apiKeys.openai : "",
      },
    };
  } catch {
    cachedSettings = DEFAULT_AI_SETTINGS;
  }

  return cachedSettings;
}

export function subscribeToAiSettings(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SETTINGS_EVENT, onChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SETTINGS_EVENT, onChange);
  };
}

export function saveAiSettings(settings: AiSettings) {
  const normalized: AiSettings = {
    provider: settings.provider,
    apiKeys: {
      gemini: settings.apiKeys.gemini.trim(),
      openai: settings.apiKeys.openai.trim(),
    },
  };
  const raw = JSON.stringify(normalized);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedSettings = normalized;
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}