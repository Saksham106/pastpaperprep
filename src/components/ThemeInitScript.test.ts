import { describe, expect, it } from "vitest";
import { createThemeInitScript } from "@/components/ThemeInitScript";

function runThemeScript({ stored, prefersDark, allowPreference = true }: { stored: string | null; prefersDark: boolean; allowPreference?: boolean }) {
  const documentElement: { dataset: Record<string, string> } = { dataset: {} };
  const media = { matches: prefersDark, addEventListener: (_event: string, listener: () => void) => { media.listener = listener; }, listener: undefined as (() => void) | undefined };
  const fakeWindow = {
    localStorage: { getItem: () => stored },
    matchMedia: () => media,
  };
  const fakeDocument = { documentElement };

  new Function("window", "document", createThemeInitScript(allowPreference))(fakeWindow, fakeDocument);
  return { documentElement, media };
}

describe("theme initialization", () => {
  it("applies a stored theme before hydration", () => {
    expect(runThemeScript({ stored: "dark", prefersDark: false }).documentElement.dataset.theme).toBe("dark");
  });

  it("defaults to light when no valid choice is stored", () => {
    expect(runThemeScript({ stored: null, prefersDark: true }).documentElement.dataset.theme).toBe("light");
    expect(runThemeScript({ stored: "invalid", prefersDark: false }).documentElement.dataset.theme).toBe("light");
  });

  it("ignores stored account preferences for signed-out visitors", () => {
    expect(runThemeScript({ stored: "dark", prefersDark: false, allowPreference: false }).documentElement.dataset.theme).toBe("light");
  });

  it("stays light when the system theme changes without a stored choice", () => {
    const { documentElement, media } = runThemeScript({ stored: null, prefersDark: false, allowPreference: false });
    media.matches = true;
    media.listener?.();
    expect(documentElement.dataset.theme).toBe("light");
  });
});
