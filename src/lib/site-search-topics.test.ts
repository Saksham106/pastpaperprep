import { describe, expect, it } from "vitest";
import { hasFreeTier } from "@/lib/access";
import { parseExplorerState } from "@/lib/explorer-state";
import { filterQuestions } from "@/lib/question-filter";
import { loadBankQuestions } from "@/lib/question-loader";
import { getLandingManifest, topicPath } from "@/lib/search-landing";
import { buildSearchTopics } from "@/lib/site-search-topics";

async function topicsFor(bank: "igcse" | "igcse-additional") {
  const [manifest, questions] = await Promise.all([getLandingManifest(bank), loadBankQuestions(bank)]);
  const landings = manifest.topics.map(topic => ({ label: topic.label, href: topicPath(bank, topic), count: topic.count }));
  return { topics: buildSearchTopics(bank, questions, landings, hasFreeTier(bank)), questions, manifest };
}

describe("site search topic links", () => {
  it("lands every filtered link on exactly the advertised questions, even for visitors without a plan (review F4)", async () => {
    for (const bank of ["igcse", "igcse-additional"] as const) {
      const { topics, questions } = await topicsFor(bank);
      const filtered = topics.filter(t => t.href.includes("?"));
      expect(filtered.length).toBeGreaterThan(50);
      for (const topic of filtered) {
        // A visitor's explorer defaults to free-only; the link must override that, not hide the topic.
        const state = parseExplorerState(Object.fromEntries(new URL(topic.href, "https://x").searchParams), { defaultFreeOnly: true });
        expect(state.freeOnly, topic.href).toBe(false);
        expect(filterQuestions([...questions], { ...state.filters, mainTopicOnly: !state.partialTopics, sort: "paper" }).length, topic.href).toBe(topic.count);
      }
    }
  });

  it("gives no link to a label the explorer would drop, instead of opening the whole bank", async () => {
    const questions = await loadBankQuestions("igcse-economics-0455");
    const topics = buildSearchTopics("igcse-economics-0455", questions, [], true);
    expect(questions.some(q => q.subtopics.some(label => label.length > 100))).toBe(true);
    expect(topics.filter(t => t.label.length > 100)).toEqual([]);
    for (const topic of topics) expect(topic.count, topic.label).toBeLessThan(questions.length);
  });

  it("reports the reviewer's empty free-only case as the real 4 questions", async () => {
    const { topics } = await topicsFor("igcse");
    const exact = topics.find(t => t.label === "Exact trigonometric values");
    expect(exact).toMatchObject({ href: "/banks/igcse?free=0&subtopic=Exact+trigonometric+values", count: 4 });
  });

  it("gives curated topics their landing page's own count, secondary topics included (review F8)", async () => {
    for (const bank of ["igcse", "igcse-additional"] as const) {
      const { topics, manifest } = await topicsFor(bank);
      for (const landing of manifest.topics) {
        const entry = topics.find(t => t.label === landing.label && !t.href.includes("?"));
        if (entry) expect(entry.count, `${bank} ${landing.label}`).toBe(landing.count);
      }
    }
    const { topics } = await topicsFor("igcse");
    // 1540 and 187 before the 2026 Core papers, which add 103 Number and 6 Coordinate geometry rows.
    expect(topics.find(t => t.label === "Number")?.count).toBe(1643);
    expect(topics.find(t => t.label === "Coordinate geometry")?.count).toBe(193);
  });
});
