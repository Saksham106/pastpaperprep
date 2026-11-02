import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import items from "@/data/aa-official-subtopics/items.json";
import taxonomy from "@/data/aa-official-subtopics/taxonomy.json";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";
import { parseExplorerState } from "@/lib/explorer-state";
import { filterQuestions } from "@/lib/question-filter";
import { publicMetadataToQuestion, type PublicBankIndex } from "@/lib/question-index";
import { groupPracticeHref, groupQuestionCounts, itemPracticeHref, itemQuestionCount } from "./practice";

const groups = taxonomy.groups as { id: string; studentFacingName: string }[];
const BANKS = { SL: "ib-sl", HL: "ib-hl" } as const;

/** The generated public index (what the explorer loads in the browser), converted the way the client does. */
function loadIndex(bank: (typeof BANKS)[keyof typeof BANKS]) {
  const file = join(process.cwd(), "public/bank-index", PUBLIC_BANK_INDEX_FILES[bank]);
  const index = JSON.parse(readFileSync(file, "utf8")) as PublicBankIndex;
  return index.questions.map((question) => publicMetadataToQuestion(question, bank));
}

describe("practice links match the counts they advertise", () => {
  const indexes = { SL: loadIndex("ib-sl"), HL: loadIndex("ib-hl") };

  for (const level of ["SL", "HL"] as const) {
    it(`every ${level} group link opens exactly the advertised questions (full access, no free filter)`, () => {
      const mismatches: string[] = [];
      for (const group of groups) {
        const url = new URL(groupPracticeHref(group.id, level), "https://example.test");
        expect(url.pathname).toBe(`/banks/${BANKS[level]}`);
        // Same parse the explorer does; a visitor's free-only default does not apply to members, so
        // count with full access exactly as the advertised number does.
        const state = parseExplorerState(Object.fromEntries(url.searchParams));
        const shown = filterQuestions(indexes[level], { ...state.filters, mainTopicOnly: !state.partialTopics, sort: "paper" }).length;
        const advertised = groupQuestionCounts(group.id)[level];
        if (shown !== advertised) mismatches.push(`${group.id} ${level}: link ${shown} vs advertised ${advertised}`);
      }
      expect(mismatches).toEqual([]);
    });
  }

  for (const level of ["SL", "HL"] as const) {
    it(`every ${level} item link opens exactly the advertised questions (full access, no free filter)`, () => {
      const mismatches: string[] = [];
      let withQuestions = 0;
      for (const { item } of items.items) {
        const url = new URL(itemPracticeHref(item, level), "https://example.test");
        expect(url.pathname).toBe(`/banks/${BANKS[level]}`);
        const state = parseExplorerState(Object.fromEntries(url.searchParams), { bank: BANKS[level] });
        expect(state.filters.officialItems, item).toEqual([item]);
        const shown = filterQuestions(indexes[level], { ...state.filters, mainTopicOnly: !state.partialTopics, sort: "paper" }).length;
        const advertised = itemQuestionCount(item, level);
        if (advertised > 0) withQuestions += 1;
        if (shown !== advertised) mismatches.push(`${item} ${level}: link ${shown} vs advertised ${advertised}`);
      }
      expect(mismatches).toEqual([]);
      expect(withQuestions).toBeGreaterThan(0);
    });
  }
});
