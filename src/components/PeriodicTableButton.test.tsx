import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PeriodicTableButton } from "@/components/PeriodicTableButton";

describe("PeriodicTableButton", () => {
  it("opens Cambridge's table in a dock and returns focus when Escape closes it", async () => {
    render(<PeriodicTableButton source="test" />);
    const button = screen.getByRole("button", { name: "Periodic Table" });
    button.focus();
    fireEvent.click(button);
    const dock = screen.getByRole("dialog", { name: "The Periodic Table of Elements" });
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("listitem", { name: "iron, Fe, atomic number 26, relative atomic mass 56" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(118);
    expect(dock).toHaveTextContent("The volume of one mole of any gas is 24 dm3");
    await act(async () => { fireEvent.keyDown(document, { key: "Escape" }); await new Promise((resolve) => requestAnimationFrame(resolve)); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(button);
  });

  it("closes only itself when an outer reader also listens for Escape", async () => {
    const outer = vi.fn();
    document.addEventListener("keydown", outer);
    render(<PeriodicTableButton source="test" />);
    fireEvent.click(screen.getByRole("button", { name: "Periodic Table" }));
    await screen.findAllByRole("listitem");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(outer).not.toHaveBeenCalled();
    document.removeEventListener("keydown", outer);
  });
});
