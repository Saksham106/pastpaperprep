import { afterEach, describe, expect, it, vi } from "vitest";
import taxonomy from "@/data/aa-official-subtopics/taxonomy.json";
import { COURSES, lessonPath } from "./course";
import { lessonForGroup, lessonForItem, notesLinksForBank, notesTopicLinksForBank, syllabusNotesForBank } from "./group-lessons";
import { notesNavVisible } from "./visibility";
import { setCoursePublishedForTests } from "./test-visibility";

const course = COURSES[0];
const groups = taxonomy.groups as { id: string; studentFacingName: string; memberOfficialItems: string[] }[];
const lesson = course.lessons[0];
const group = groups.find((g) => g.memberOfficialItems.includes(lesson.item))!;
const visible = { ...course, published: true };

let restorePublished: (() => void) | undefined;
afterEach(() => {
  restorePublished?.();
  restorePublished = undefined;
  vi.unstubAllEnvs();
});

describe("lessonForGroup", () => {
  it("returns the first written lesson among the group's items at that level", () => {
    const link = lessonForGroup(visible, group.id, "HL");
    expect(link).toEqual({ href: lessonPath(course, lesson), label: lesson.title });
  });
  it("shows only SL items at SL", () => {
    const expected = lesson.level === "SL" ? { href: lessonPath(course, lesson), label: lesson.title } : null;
    expect(lessonForGroup(visible, group.id, "SL")).toEqual(expected);
  });
  it("never returns an AHL lesson at SL, even when it is the first written item of a shared group", () => {
    const shared = groups.find((g) => g.memberOfficialItems.length >= 2)!;
    const [first, second] = [...shared.memberOfficialItems].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    const make = (item: string, level: "SL" | "AHL") => ({ ...lesson, item, level, slug: `s-${item.replace(".", "-")}` });
    const ahlOnly = { ...visible, lessons: [make(first, "AHL")] };
    expect(lessonForGroup(ahlOnly, shared.id, "SL")).toBeNull();
    expect(lessonForGroup(ahlOnly, shared.id, "HL")?.label).toBe(lesson.title);
    const both = { ...visible, lessons: [make(first, "AHL"), make(second, "SL")] };
    expect(lessonForGroup(both, shared.id, "SL")?.href).toBe(lessonPath(both, both.lessons[1]));
    expect(lessonForGroup(both, shared.id, "HL")?.href).toBe(lessonPath(both, both.lessons[0]));
  });
  it("is null for a group with no written lesson, or an unknown group", () => {
    // Every group has a lesson once the course is complete, so drop the lessons to test the empty case.
    expect(lessonForGroup({ ...visible, lessons: [] }, group.id, "HL")).toBeNull();
    expect(lessonForGroup(visible, "nope", "HL")).toBeNull();
  });
  it("is null while the course is hidden, and returns with NOTES_PREVIEW=1", () => {
    const hidden = { ...course, published: false };
    expect(lessonForGroup(hidden, group.id, "HL")).toBeNull();
    vi.stubEnv("NOTES_PREVIEW", "1");
    expect(lessonForGroup(hidden, group.id, "HL")).not.toBeNull();
  });
});

describe("lessonForItem", () => {
  it("returns the written lesson for the item, and only SL lessons at SL", () => {
    expect(lessonForItem(visible, lesson.item, "HL")).toEqual({ href: lessonPath(course, lesson), label: lesson.title });
    expect(lessonForItem(visible, lesson.item, "SL")).toEqual(lesson.level === "SL" ? { href: lessonPath(course, lesson), label: lesson.title } : null);
    const ahl = { ...visible, lessons: [{ ...lesson, level: "AHL" as const }] };
    expect(lessonForItem(ahl, lesson.item, "SL")).toBeNull();
  });
  it("is null for an unwritten item and while the course is hidden", () => {
    expect(lessonForItem(visible, "9.99", "HL")).toBeNull();
    expect(lessonForItem({ ...course, published: false }, lesson.item, "HL")).toBeNull();
  });
});

describe("surface lookups follow visibility", () => {
  it("are empty while the course is unpublished", () => {
    restorePublished = setCoursePublishedForTests(false);
    vi.stubEnv("NOTES_PREVIEW", "");
    expect(course.published).toBe(false);
    expect(notesLinksForBank("ib-hl")).toBeUndefined();
    expect(notesTopicLinksForBank("ib-hl")).toBeUndefined();
    expect(syllabusNotesForBank("ib-hl")).toEqual([]);
    expect(notesNavVisible()).toBe(false);
  });
  it("fill in under NOTES_PREVIEW=1 on an unpublished course, AA links only on AA banks", () => {
    restorePublished = setCoursePublishedForTests(false);
    vi.stubEnv("NOTES_PREVIEW", "1");
    expect(notesNavVisible()).toBe(true);
    expect(notesLinksForBank("ib-hl")?.[group.studentFacingName]?.href).toBe(lessonPath(course, lesson));
    for (const entry of course.lessons) expect(notesLinksForBank("ib-hl")?.[entry.item]?.href, entry.item).toBe(lessonPath(course, entry));
    for (const entry of course.lessons.filter((l) => l.level === "AHL")) expect(notesLinksForBank("ib-sl")?.[entry.item], entry.item).toBeUndefined();
    expect(syllabusNotesForBank("ib-hl").map((n) => n.name)).toContain(group.studentFacingName);
    expect(notesTopicLinksForBank("ib-hl")).toHaveProperty("Calculus");
    // The preview flag shows every course: igcse links go to 0580 lessons only.
    expect(Object.values(notesLinksForBank("igcse") ?? {}).every((link) => link.href.startsWith("/revision-notes/igcse-maths-0580/"))).toBe(true);
    expect(notesLinksForBank("igcse-additional")).toBeUndefined();
    expect(notesTopicLinksForBank("igcse-additional")).toBeUndefined();
  });
  it("0580 links follow the 0580 course's visibility alone: keyed by official code, Core and Extended", () => {
    vi.stubEnv("NOTES_PREVIEW", "");
    const igcse = COURSES.find((entry) => entry.slug === "igcse-maths-0580")!;
    expect(igcse.published).toBe(false);
    expect(notesLinksForBank("igcse")).toBeUndefined();
    expect(notesTopicLinksForBank("igcse")).toBeUndefined();
    expect(syllabusNotesForBank("igcse")).toEqual([]);
    restorePublished = setCoursePublishedForTests(true, "igcse-maths-0580");
    const one = igcse.lessons.find((entry) => entry.item === "1.1")!;
    const link = { href: lessonPath(igcse, one), label: one.title };
    expect(notesLinksForBank("igcse")).toEqual({ "current_2025:C1.1": link, "current_2025:E1.1": link });
    expect(notesTopicLinksForBank("igcse")).toEqual({ Number: { href: "/revision-notes/igcse-maths-0580/number", label: "Number notes" } });
    expect(syllabusNotesForBank("igcse")).toEqual([{ name: "1.1 Types of number", topic: "Number", href: lessonPath(igcse, one), label: one.title }]);
    // AA banks are untouched by the 0580 course.
    expect(notesLinksForBank("ib-hl")?.[lesson.item]?.href).toBe(lessonPath(course, lesson));
  });
  it("fill in for the real, published course without a preview flag", () => {
    vi.stubEnv("NOTES_PREVIEW", "");
    expect(course.published).toBe(true);
    expect(notesNavVisible()).toBe(true);
    expect(notesLinksForBank("ib-hl")?.[group.studentFacingName]?.href).toBe(lessonPath(course, lesson));
    expect(notesLinksForBank("igcse")).toBeUndefined();
  });
});
