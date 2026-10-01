"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_AI_SETTINGS,
  getAiSettingsSnapshot,
  subscribeToAiSettings,
} from "@/lib/ai-settings";

export function useAiSettings() {
  return useSyncExternalStore(
    subscribeToAiSettings,
    getAiSettingsSnapshot,
    () => DEFAULT_AI_SETTINGS,
  );
}