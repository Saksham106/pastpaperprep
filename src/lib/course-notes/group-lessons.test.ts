import { afterEach, describe, expect, it, vi } from "vitest";
import taxonomy from "@/data/aa-official-subtopics/taxonomy.json";
import { COURSES, lessonPath } from "./course";
import { lessonForGroup, notesLinksForBank, notesTopicLinksForBank, syllabusNotesForBank } from "./group-lessons";
import { notesNavVisible } from "./visibility";

const course = COURSES[0];
const groups = taxonomy.groups as { id: string; studentFacingName: string; memberOfficialItems: string[] }[];
const lesson = course.lessons[0];
const group = groups.find((g) => g.memberOfficialItems.includes(lesson.item))!;
const visible = { ...course, published: true };

afterEach(() => vi.unstubAllEnvs());

describe("lessonForGroup", () => {
  it("returns the first written lesson among the group's items at that level", () => {
    const link = lessonForGroup(visible, group.id, "HL");
    expect(link).toEqual({ href: lessonPath(course, lesson), label: lesson.title });
  });
  it("shows only SL items at SL", () => {
    const expected = lesson.level === "SL" ? { href: lessonPath(course, lesson), label: lesson.title } : null;
    expect(lessonForGroup(visible, group.id, "SL")).toEqual(expected);
  });
  it("is null for a group with no written lesson, or an unknown group", () => {
    const empty = groups.find((g) => !g.memberOfficialItems.some((item) => course.lessons.some((l) => l.item === item)))!;
    expect(lessonForGroup(visible, empty.id, "HL")).toBeNull();
    expect(lessonForGroup(visible, "nope", "HL")).toBeNull();
  });
  it("is null while the course is hidden, and returns with NOTES_PREVIEW=1", () => {
    const hidden = { ...course, published: false };
    expect(lessonForGroup(hidden, group.id, "HL")).toBeNull();
    vi.stubEnv("NOTES_PREVIEW", "1");
    expect(lessonForGroup(hidden, group.id, "HL")).not.toBeNull();
  });
});

describe("surface lookups follow visibility", () => {
  it("are empty while the course is unpublished", () => {
    expect(course.published).toBe(false);
    expect(notesLinksForBank("ib-hl")).toBeUndefined();
    expect(notesTopicLinksForBank("ib-hl")).toBeUndefined();
    expect(syllabusNotesForBank("ib-hl")).toEqual([]);
    expect(notesNavVisible()).toBe(false);
  });
  it("fill in under NOTES_PREVIEW=1, only for AA banks", () => {
    vi.stubEnv("NOTES_PREVIEW", "1");
    expect(notesNavVisible()).toBe(true);
    expect(notesLinksForBank("ib-hl")?.[group.studentFacingName]?.href).toBe(lessonPath(course, lesson));
    expect(syllabusNotesForBank("ib-hl").map((n) => n.name)).toContain(group.studentFacingName);
    expect(notesTopicLinksForBank("ib-hl")).toHaveProperty("Calculus");
    expect(notesLinksForBank("igcse")).toBeUndefined();
    expect(notesTopicLinksForBank("igcse")).toBeUndefined();
  });
});
