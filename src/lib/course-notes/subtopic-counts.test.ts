import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hasFreeTier } from "@/lib/access";
import { matchesCourseRoute } from "@/lib/course-route";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";
import type { BankSlug } from "@/lib/banks";
import { parseExplorerState } from "@/lib/explorer-state";
import { filterQuestions } from "@/lib/question-filter";
import { publicMetadataToQuestion, type PublicBankIndex } from "@/lib/question-index";
import { loadBankQuestions } from "@/lib/question-loader";
import { COURSES } from "./course";
import { lessonPractice, topicQuestionTotals, topicStages } from "./practice";
import { buildSubtopicPractice, idsShown, practiceLabels } from "./subtopic-counts";
import { itemPracticeLabels, subtopicPracticeFile } from "./subtopic-practice";
import type { ViewLevel } from "./types";

const VIEWS: ViewLevel[] = ["base", "extension"];

/** The generated public index (what the explorer loads in the browser), converted the way the client does. */
function loadIndex(bank: string) {
  const file = join(process.cwd(), "public/bank-index", PUBLIC_BANK_INDEX_FILES[bank as keyof typeof PUBLIC_BANK_INDEX_FILES]);
  const index = JSON.parse(readFileSync(file, "utf8")) as PublicBankIndex;
  return index.questions.map((question) => publicMetadataToQuestion(question, bank as BankSlug));
}

describe.each(COURSES.filter((course) => course.practice.kind === "bank-subtopics").map((course) => [course.slug, course] as const))("%s practice by bank subtopic", (slug, course) => {
  const file = subtopicPracticeFile(course);
  const levels = [course.levels.labels.base, course.levels.labels.extension];
  const routes = course.practice.kind === "bank-subtopics" ? course.practice.routes : undefined;

  it("every item names a practice label, and the generated file is up to date (npm run generate:notes-practice)", async () => {
    for (const entry of course.items.items) expect(entry.practice?.trim(), entry.item).toBeTruthy();
    const questions = Object.fromEntries(await Promise.all(levels.map(async (level) => [level, await loadBankQuestions(course.banks[level] as BankSlug)] as const)));
    const fresh = buildSubtopicPractice(course, course.items, questions, (bank) => hasFreeTier(bank as BankSlug));
    expect(file, `src/data/notes-practice/${slug}.json is stale; run npm run generate:notes-practice`).toEqual(fresh);
  });

  it("names exactly the course's banks and labels, and every label has questions somewhere", () => {
    expect(Object.fromEntries(levels.map((level) => [level, file.banks[level].slug]))).toEqual(course.banks);
    expect(Object.keys(file.subtopics)).toEqual(practiceLabels(course.items));
    for (const [label, counts] of Object.entries(file.subtopics)) expect(Math.max(...Object.values(counts)), label).toBeGreaterThan(0);
  });

  for (const view of VIEWS) {
    it(`every lesson's ${course.levels.labels[view]} link opens exactly the advertised questions in the browser's index, for a visitor too`, () => {
      const indexes = Object.fromEntries(levels.map((level) => [course.banks[level], loadIndex(course.banks[level])]));
      const mismatches: string[] = [];
      for (const entry of course.items.items) {
        const practice = lessonPractice(course, entry.item)!;
        expect(practice.name, entry.item).toBe(entry.practice);
        const url = new URL(practice.hrefs[view], "https://example.test");
        const bank = url.pathname.replace("/banks/", "");
        // An extension-level lesson advertises nothing in the base view and borrows the extension link.
        if (view === "base" && entry.level === course.levels.extension) {
          expect(practice.counts.base, entry.item).toBe(0);
          expect(practice.hrefs.base, entry.item).toBe(practice.hrefs.extension);
          continue;
        }
        expect(bank, entry.item).toBe(course.banks[course.levels.labels[view]]);
        // A visitor without a plan starts free-only; the link must switch that off, not hide the questions.
        const state = parseExplorerState(Object.fromEntries(url.searchParams), { defaultFreeOnly: hasFreeTier(bank as BankSlug) });
        expect(state.freeOnly, entry.item).toBe(false);
        expect(state.filters.subtopics, entry.item).toEqual([entry.practice]);
        expect(Object.keys(state.filters), entry.item).toEqual(["subtopics"]);
        // A routed link (IGCSE Core / Extended) keeps only that route's questions, as the explorer does.
        expect(state.courseRoute, entry.item).toBe(routes?.[course.levels.labels[view]] ?? "all");
        const routed = indexes[bank].filter((question) => matchesCourseRoute(question.syllabusRoute, state.courseRoute));
        const shown = filterQuestions(routed, { ...state.filters, mainTopicOnly: !state.partialTopics, sort: "paper" }).length;
        if (shown !== practice.counts[view]) mismatches.push(`${entry.item} ${view}: link ${shown} vs advertised ${practice.counts[view]}`);
      }
      expect(mismatches).toEqual([]);
    });
  }

  it("topic pages have one stage per item, in item order, with the lesson's own counts and links", () => {
    for (const topic of course.topics) {
      const stages = topicStages(course, topic);
      const entries = course.items.items.filter((entry) => entry.topic === topic.n);
      expect(stages.map((stage) => stage.id)).toEqual(entries.map((entry) => entry.item));
      for (const stage of stages) {
        const practice = lessonPractice(course, stage.id)!;
        expect(stage.counts).toEqual(practice.counts);
        expect(stage.hrefs).toEqual(practice.hrefs);
      }
    }
  });

  it("topic totals count each question once: at least the largest label, at most the label sum", () => {
    for (const topic of course.topics) {
      const totals = topicQuestionTotals(course, topic);
      for (const view of VIEWS) {
        const level = course.levels.labels[view];
        const labels = [...new Set(course.items.items.filter((entry) => entry.topic === topic.n && (view === "extension" || entry.level === course.levels.base)).flatMap(itemPracticeLabels))];
        const counts = labels.map((label) => file.subtopics[label][level]);
        expect(totals[view], `${topic.slug} ${view}`).toBeGreaterThanOrEqual(Math.max(0, ...counts));
        expect(totals[view], `${topic.slug} ${view}`).toBeLessThanOrEqual(counts.reduce((sum, n) => sum + n, 0));
        expect(totals[view], `${topic.slug} ${view}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("idsShown", () => {
  it("counts nothing for a label the explorer would drop, rather than the whole bank", async () => {
    const questions = await loadBankQuestions("ib-chemistry-hl");
    expect(idsShown(questions, `/banks/ib-chemistry-hl?subtopic=${"x".repeat(101)}`)).toEqual([]);
    expect(idsShown(questions, "/banks/ib-chemistry-hl")).toEqual([]);
  });
});
