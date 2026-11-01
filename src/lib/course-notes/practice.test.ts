import { describe, expect, it } from "vitest";
import taxonomy from "@/data/aa-official-subtopics/taxonomy.json";
import overlay from "@/data/aa-official-subtopics/overlay.json";
import { parseExplorerState } from "@/lib/explorer-state";
import { groupPracticeHref, groupQuestionCounts } from "./practice";

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
