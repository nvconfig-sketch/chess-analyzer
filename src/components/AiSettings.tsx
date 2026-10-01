"use client";

import { useEffect, useRef, useState } from "react";
import { useAiSettings } from "@/hooks/useAiSettings";
import { saveAiSettings, type AiProvider } from "@/lib/ai-settings";

export function AiSettings() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const settings = useAiSettings();
  const [provider, setProvider] = useState<AiProvider>("gemini");
  const [apiKeys, setApiKeys] = useState({ gemini: "", openai: "" });
  const [showKey, setShowKey] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const openSettings = () => {
    setProvider(settings.provider);
    setApiKeys(settings.apiKeys);
    setSaveError(null);
    setIsOpen(true);
  };

  const closeSettings = () => setIsOpen(false);

  const updateKey = (value: string) => {
    setApiKeys((current) => ({ ...current, [provider]: value }));
  };

  const save = () => {
    try {
      saveAiSettings({ provider, apiKeys });
      setSaveError(null);
      closeSettings();
    } catch {
      setSaveError("Could not save settings in this browser.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openSettings}
        className="min-h-11 shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        AI settings
      </button>
      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          event.preventDefault();
          closeSettings();
        }}
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeSettings();
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-black/50 dark:bg-zinc-900 dark:text-zinc-100"
        aria-labelledby="ai-settings-title"
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="ai-settings-title" className="text-base font-semibold">
                AI provider settings
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Your key is sent directly from this browser to the selected provider.
              </p>
            </div>
            <button
              type="button"
              onClick={closeSettings}
              className="min-h-11 min-w-11 rounded-md text-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Close settings"
            >
              ×
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="AI provider">
            {(["gemini", "openai"] as const).map((providerOption) => (
              <button
                key={providerOption}
                type="button"
                onClick={() => setProvider(providerOption)}
                aria-pressed={provider === providerOption}
                className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium ${
                  provider === providerOption
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                {providerOption === "gemini" ? "Google Gemini" : "OpenAI"}
              </button>
            ))}
          </div>

          <label htmlFor="ai-api-key" className="mt-4 block text-sm font-medium">
            {provider === "gemini" ? "Google Gemini API key" : "OpenAI API key"}
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="ai-api-key"
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              value={apiKeys[provider]}
              onChange={(event) => updateKey(event.target.value)}
              placeholder={provider === "gemini" ? "AIza…" : "sk-…"}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-emerald-600 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="button"
              onClick={() => setShowKey((visible) => !visible)}
              className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
            Saved in localStorage, which is accessible to scripts running on this site. Use only
            on a trusted device; clear the key here before sharing this browser profile.
          </p>

          {saveError ? <p className="mt-3 text-sm text-rose-500">{saveError}</p> : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => updateKey("")}
              className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700"
            >
              Clear key
            </button>
            <button
              type="button"
              onClick={closeSettings}
              className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Save
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}