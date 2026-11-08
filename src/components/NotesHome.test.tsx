import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getEntitlementBanks } from "@/lib/banks";
import { getCourse } from "@/lib/course-notes/course";
import { notesRows } from "@/lib/notes-home";
import { setCoursePublishedForTests } from "@/lib/course-notes/test-visibility";
import { NotesHome } from "./NotesHome";

const banks = getEntitlementBanks();
afterEach(cleanup);

describe("notes home", () => {
  it("merges HL and SL into one row per course and links only courses with notes", () => {
    const rows = notesRows(banks.filter((bank) => bank.slug === "ib-hl" || bank.slug === "ib-sl" || bank.slug === "ib-chemistry-hl" || bank.slug === "ib-chemistry-sl"));
    expect(rows.map((row) => [row.name, row.level, row.notes?.href ?? null])).toEqual([
      ["IB Math AA", "SL & HL", "/revision-notes/ib-math-aa"],
      ["Chemistry", "SL & HL", "/revision-notes/ib-chemistry"],
    ]);
    expect(rows[0].notes?.label).toBe("83 lessons");
  });

  it("links IGCSE Maths 0580 only once its course is visible", () => {
    const row = () => notesRows(banks.filter((bank) => bank.slug === "igcse"))[0];
    const lessonCount = getCourse("igcse-maths-0580")!.lessons.length;
    expect(lessonCount).toBeGreaterThan(1);
    const restore = setCoursePublishedForTests(false, "igcse-maths-0580");
    try {
      expect(row().notes).toBeUndefined();
    } finally {
      restore();
    }
    // Published: linked without a preview flag.
    expect(row().notes).toEqual({ href: "/revision-notes/igcse-maths-0580", label: `${lessonCount} lessons` });
  });

  it("keeps IB Chemistry 'Coming soon' while its course is unpublished, and links it once visible", () => {
    const row = () => notesRows(banks.filter((bank) => bank.slug === "ib-chemistry-hl" || bank.slug === "ib-chemistry-sl"))[0];
    const restore = setCoursePublishedForTests(false, "ib-chemistry");
    try {
      expect(row().notes).toBeUndefined();
    } finally {
      restore();
    }
    // Published: linked without a preview flag.
    const lessons = getCourse("ib-chemistry")!.lessons.length;
    expect(lessons).toBe(71);
    expect(row().notes).toEqual({ href: "/revision-notes/ib-chemistry", label: "71 lessons" });
  });

  it("keeps IB Physics 'Coming soon' while its course is unpublished, and links it once visible", () => {
    const row = () => notesRows(banks.filter((bank) => bank.slug === "ib-physics-hl" || bank.slug === "ib-physics-sl"))[0];
    expect(getCourse("ib-physics")!.published).toBe(false);
    expect(row().notes).toBeUndefined();
    const restore = setCoursePublishedForTests(true, "ib-physics");
    try {
      const lessons = getCourse("ib-physics")!.lessons.length;
      expect(row().notes).toEqual({ href: "/revision-notes/ib-physics", label: `${lessons} lesson${lessons === 1 ? "" : "s"}` });
    } finally {
      restore();
    }
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
