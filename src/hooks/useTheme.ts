"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "chess-analyzer-theme";
const THEME_CHANGE_EVENT = "chess-analyzer-theme-change";
const COLOR_SCHEME_QUERY = "(prefers-color-scheme: light)";

function getThemeSnapshot(): Theme {
  if (typeof window === "undefined") return "dark";

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia(COLOR_SCHEME_QUERY).matches ? "light" : "dark";
}

function subscribeToTheme(callback: () => void) {
  const colorScheme = window.matchMedia(COLOR_SCHEME_QUERY);
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  colorScheme.addEventListener("change", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    colorScheme.removeEventListener("change", callback);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore<Theme>(
    subscribeToTheme,
    getThemeSnapshot,
    () => "dark",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, [theme]);

  return { theme, toggleTheme };
}
