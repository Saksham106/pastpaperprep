"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "pastpaperprep-theme";
const THEME_CHANGE_EVENT = "pastpaperprep:theme-change";

function preferredTheme(): Theme {
  if (typeof document !== "undefined") {
    const current = document.documentElement.dataset.theme;
    if (current === "light" || current === "dark") return current;
  }
  if (typeof window !== "undefined") {
    let stored: string | null = null;
    try {
      stored = window.localStorage?.getItem(THEME_STORAGE_KEY) ?? null;
    } catch {
      stored = null;
    }
    if (stored === "light" || stored === "dark") return stored;
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  }
  return "light";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
      return () => window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    },
    preferredTheme,
    () => "light",
  );

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage?.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // The theme still applies for this page when storage is unavailable.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${nextTheme} theme`} title={`Switch to ${nextTheme} theme`}>
      {theme === "dark" ? <Sun aria-hidden="true" weight="bold" /> : <Moon aria-hidden="true" weight="bold" />}
      <span>Use {nextTheme} mode</span>
    </button>
  );
}
