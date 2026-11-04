import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getEntitlementBanks } from "@/lib/banks";
import { notesRows } from "@/lib/notes-home";
import { NotesHome } from "./NotesHome";

const banks = getEntitlementBanks();
afterEach(cleanup);

describe("notes home", () => {
  it("merges HL and SL into one row per course and links only courses with notes", () => {
    const rows = notesRows(banks.filter((bank) => bank.slug === "ib-hl" || bank.slug === "ib-sl" || bank.slug === "ib-chemistry-hl" || bank.slug === "ib-chemistry-sl"));
    expect(rows.map((row) => [row.name, row.level, row.notes?.href ?? null])).toEqual([
      ["IB Math AA", "SL & HL", "/revision-notes/ib-math-aa"],
      ["Chemistry", "SL & HL", null],
    ]);
    expect(rows[0].notes?.label).toBe("83 lessons");
  });

  it("links IGCSE Chemistry 0620 to its existing topic summaries", () => {
    const [row] = notesRows(banks.filter((bank) => bank.slug === "igcse-chemistry-0620"));
    expect(row.notes?.href).toBe("/revision-notes/igcse-chemistry-0620");
  });

  it("renders a link for courses with notes and an unlinked 'Coming soon' row for the rest", () => {
    const { container } = render(<NotesHome banks={banks} />);
    expect(screen.getByRole("heading", { level: 1, name: "Revision notes" })).toBeTruthy();
    const aa = container.querySelector('[data-notes="ib-hl"], [data-notes="ib-sl"]') as HTMLAnchorElement;
    expect(aa.getAttribute("href")).toBe("/revision-notes/ib-math-aa");
    const soon = [...container.querySelectorAll("[data-notes-soon]")];
    expect(soon.length).toBeGreaterThan(0);
    for (const row of soon) {
      expect(row.tagName).not.toBe("A");
      expect(within(row as HTMLElement).getByText("Coming soon")).toBeTruthy();
    }
  });
});
