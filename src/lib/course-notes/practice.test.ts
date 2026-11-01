import { describe, expect, it } from "vitest";
import taxonomy from "@/data/aa-official-subtopics/taxonomy.json";
import overlay from "@/data/aa-official-subtopics/overlay.json";
import { parseExplorerState } from "@/lib/explorer-state";
import { COURSES } from "./course";
import type { Group } from "./groups";
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
  it("every lesson's item belongs to exactly one group, and that is the group the lesson page uses", () => {
    for (const lesson of COURSES[0].lessons) {
      const owners = (groups as FullGroup[]).filter((g) => g.memberOfficialItems.includes(lesson.item));
      expect(owners, lesson.item).toHaveLength(1);
      const group = practiceGroupForItem(lesson.item);
      expect(group?.id, lesson.item).toBe(owners[0].id);
      for (const level of ["SL", "HL"] as const) {
        const url = new URL(groupPracticeHref(group!.id, level), "https://example.test");
        expect(parseExplorerState(Object.fromEntries(url.searchParams)).filters.subtopics).toEqual([group!.studentFacingName]);
      }
    }
  });
  it("returns the first group containing the item, and undefined for an unknown item", () => {
    const [a, b] = groups as unknown as Group[];
    const synthetic = [{ ...a, memberOfficialItems: ["9.9"] }, { ...b, memberOfficialItems: ["9.9"] }];
    expect(practiceGroupForItem("9.9", synthetic)?.id).toBe(a.id);
    expect(practiceGroupForItem("0.0", synthetic)).toBeUndefined();
  });
});
