import { describe, expect, it } from "vitest";
import taxonomy from "@/data/aa-official-subtopics/taxonomy.json";
import overlay from "@/data/aa-official-subtopics/overlay.json";
import { parseExplorerState } from "@/lib/explorer-state";
import { COURSES } from "./course";
import { groupPracticeHref, groupQuestionCounts, practiceGroupForItem, topicQuestionCount } from "./practice";

const groups = taxonomy.groups as { id: string; studentFacingName: string; parentTopic: string }[];
const records = overlay.records as { level: "SL" | "HL"; groupIds: string[]; status: string }[];

describe("groupQuestionCounts", () => {
  it("counts accepted overlay records per level and ignores blocked ones", () => {
    for (const group of groups) {
      const mine = records.filter((record) => record.groupIds.includes(group.id));
      const expected = { SL: mine.filter((r) => r.status === "accepted" && r.level === "SL").length, HL: mine.filter((r) => r.status === "accepted" && r.level === "HL").length };
      expect(groupQuestionCounts(group.id)).toEqual(expected);
    }
  });
  it("is zero for an unknown group", () => expect(groupQuestionCounts("nope")).toEqual({ SL: 0, HL: 0 }));
});

describe("topicQuestionCount", () => {
  it("is the distinct accepted count: 147 for Calculus HL", () => expect(topicQuestionCount("Calculus", "HL")).toBe(147));
  it("never exceeds the per-group sum, for every topic and level", () => {
    for (const topic of new Set(groups.map((g) => g.parentTopic))) {
      for (const level of ["SL", "HL"] as const) {
        const sum = groups.filter((g) => g.parentTopic === topic).reduce((s, g) => s + groupQuestionCounts(g.id)[level], 0);
        expect(topicQuestionCount(topic, level)).toBeLessThanOrEqual(sum);
        expect(topicQuestionCount(topic, level)).toBeGreaterThan(0);
      }
    }
  });
});

describe("groupPracticeHref", () => {
  it("deep-links to the bank with topic and subtopic filters the explorer parses", () => {
    for (const group of groups) {
      for (const [level, bank] of [["SL", "ib-sl"], ["HL", "ib-hl"]] as const) {
        const href = groupPracticeHref(group.id, level);
        const url = new URL(href, "https://example.test");
        expect(url.pathname).toBe(`/banks/${bank}`);
        const state = parseExplorerState(Object.fromEntries(url.searchParams));
        expect(state.filters.topics).toEqual([group.parentTopic]);
        expect(state.filters.subtopics).toEqual([group.studentFacingName]);
      }
    }
  });
  it("encodes special characters", () => {
    const id = groups.find((g) => g.studentFacingName.includes(","))!.id;
    expect(groupPracticeHref(id, "HL")).toContain("%2C");
  });
  it("throws for an unknown group", () => expect(() => groupPracticeHref("nope", "SL")).toThrow());
});

describe("practice links for lessons", () => {
  type FullGroup = (typeof groups)[number] & { memberOfficialItems: string[] };
  it("the group the lesson page uses resolves to at least one question at each level, or falls back to a group that does", () => {
    for (const lesson of COURSES[0].lessons) {
      for (const level of ["SL", "HL"] as const) {
        const group = practiceGroupForItem(lesson.item, level);
        expect(group, `${lesson.item} ${level}`).toBeDefined();
        const anyHasQuestions = (groups as FullGroup[]).some((g) => g.memberOfficialItems.includes(lesson.item) && groupQuestionCounts(g.id)[level] > 0);
        if (anyHasQuestions) expect(groupQuestionCounts(group!.id)[level], `${lesson.item} ${level}`).toBeGreaterThan(0);
        const url = new URL(groupPracticeHref(group!.id, level), "https://example.test");
        expect(parseExplorerState(Object.fromEntries(url.searchParams)).filters.subtopics).toEqual([group!.studentFacingName]);
      }
    }
  });
  it("without a level it matches the lesson page's first group", () => {
    const lesson = COURSES[0].lessons[0];
    expect(practiceGroupForItem(lesson.item)?.id).toBe((groups as FullGroup[]).find((g) => g.memberOfficialItems.includes(lesson.item))!.id);
  });
  it("falls back to the first group when none has questions, and skips an empty first group", () => {
    const [empty] = (groups as FullGroup[]).filter((g) => groupQuestionCounts(g.id).HL === 0 && groupQuestionCounts(g.id).SL === 0).concat({ id: "synthetic-empty", studentFacingName: "E", parentTopic: "T", memberOfficialItems: [] });
    const full = (groups as FullGroup[]).find((g) => groupQuestionCounts(g.id).HL > 0)!;
    const synthetic = [{ ...empty, memberOfficialItems: ["9.9"] }, { ...full, memberOfficialItems: ["9.9"] }];
    expect(practiceGroupForItem("9.9", "HL", synthetic)?.id).toBe(full.id);
    expect(practiceGroupForItem("9.9", "HL", [synthetic[0]])?.id).toBe(empty.id);
    expect(practiceGroupForItem("0.0", "HL", synthetic)).toBeUndefined();
  });
});
