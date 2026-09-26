import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/ThemeToggle";

const theme = vi.hoisted(() => ({ resolvedTheme: "light", setTheme: vi.fn() }));
vi.mock("next-themes", () => ({ useTheme: () => theme }));

describe("ThemeToggle", () => {
  beforeEach(() => { theme.resolvedTheme = "light"; theme.setTheme.mockClear(); });

  it("switches light to dark through the shared theme provider", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));
    expect(theme.setTheme).toHaveBeenCalledWith("dark");
  });

  it("switches dark to light through the shared theme provider", () => {
    theme.resolvedTheme = "dark";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
    expect(theme.setTheme).toHaveBeenCalledWith("light");
  });
});
