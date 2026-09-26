"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  // The server cannot know a saved or system theme. Keep markup identical until hydration.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";
  const nextTheme = dark ? "light" : "dark";

  return (
    <button
      className={`theme-toggle${showLabel ? " theme-toggle-labeled" : ""}`}
      type="button"
      disabled={!mounted}
      onClick={() => setTheme(nextTheme)}
      aria-label={mounted ? `Switch to ${nextTheme} theme` : "Change theme"}
      title={mounted ? `Switch to ${nextTheme} theme` : "Change theme"}
    >
      {dark ? <Sun aria-hidden="true" weight="bold" /> : <Moon aria-hidden="true" weight="bold" />}
      <span className={showLabel ? undefined : "sr-only"} aria-hidden={showLabel ? "true" : undefined}>
        {mounted ? `${nextTheme === "dark" ? "Dark" : "Light"} mode` : "Theme"}
      </span>
    </button>
  );
}
