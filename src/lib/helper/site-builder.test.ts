import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { BuilderQuestion } from "@/lib/builder-topics";
import { parseBuilderState } from "@/lib/builder-url";
import { runSiteAgent } from "@/lib/helper/site-agent";
import { loadBuilderQuestions, planPracticeSet } from "@/lib/helper/site-builder";
import { buildPracticeSetTool, siteDestinations, type SiteData } from "@/lib/helper/site-tools";

// The real IGCSE Maths public index (written by `npm run generate:bank-index`, which pretest runs).
let questions: BuilderQuestion[];
beforeAll(async () => {
  questions = (await loadBuilderQuestions("igcse"))!;
});

const base = {
  index: {
    version: 2 as const,
    subjects: [{ bank: "igcse", name: "IGCSE Maths 0580", qualification: "igcse" as const, practiceHref: "/banks/igcse?free=1", questionCount: 4174, papersHref: null, paperCount: 0, terms: ["igcse", "maths", "0580"] }],
    topics: [],
  },
  papers: { version: 2 as const, papers: [] },
  facets: { version: 2 as const, banks: {} },
  pages: [],
};
const DATA: SiteData = { ...base, destinations: siteDestinations(base) };
const algebra = { bank: "igcse", topics: ["Algebra and graphs"], subtopics: [], year_from: "2022", year_to: "2024", route: "extended", paper: "", size_kind: "questions", size_amount: 10 };
const context = (canBuild = true, navigations = 0) => ({ data: DATA, navigations, canBuild: () => canBuild, builderQuestions: async () => questions, seed: () => 42 });

describe("planPracticeSet (the paper builder's own logic)", () => {
  it("builds the set the builder will show from the link, reproducibly", () => {
    const input = { bank: "igcse" as const, topics: ["Algebra and graphs"], subtopics: [], yearFrom: 2022, yearTo: 2024, route: "extended" as const, size: { kind: "questions" as const, amount: 10 }, seed: 42 };
    const first = planPracticeSet(questions, input, "IGCSE Maths 0580");
    const again = planPracticeSet(questions, input, "IGCSE Maths 0580");
    expect(first).toEqual(again);
    expect(first).toMatchObject({ ok: true, questions: 10, years: [expect.any(Number), expect.any(Number)] });
    if (!first.ok) return;
    expect(first.years[0]).toBeGreaterThanOrEqual(2022);
    expect(first.years[1]).toBeLessThanOrEqual(2024);
    const state = parseBuilderState(new URL(first.path, "https://x").searchParams);
    expect(state).toMatchObject({ bank: "igcse", route: "extended", from: 2022, to: 2024, selection: ["t:Algebra and graphs"], target: { kind: "questions", amount: 10 }, seed: 42 });
    // The exact questions travel in the link, so the builder shows this set and these marks.
    expect(state.ids).toHaveLength(10);
    const byId = new Map(questions.map((question) => [question.id, question]));
    expect(state.ids.reduce((sum, id) => sum + (byId.get(id)?.marks ?? 0), 0)).toBe(first.marks);
    expect(state.ids.every((id) => byId.get(id)?.primaryTopic === "Algebra and graphs")).toBe(true);
    expect(first.label).toMatch(/^10 questions · Algebra and graphs · 2022–2024 · \d+ marks$/);
  });

  it("builds a one-paper mock by marks", () => {
    const mock = planPracticeSet(questions, { bank: "igcse", topics: [], subtopics: [], yearFrom: 2024, yearTo: 2024, route: "extended", paper: 2, size: { kind: "marks", amount: 70 }, seed: 7 }, "IGCSE Maths 0580");
    expect(mock).toMatchObject({ ok: true, marks: 70, papers: [2] });
    if (mock.ok) expect(new URL(mock.path, "https://x").searchParams.get("papers")).toBe("2m70");
  });

  it("refuses an impossible target instead of underfilling", () => {
    const short = planPracticeSet(questions, { bank: "igcse", topics: ["Statistics"], subtopics: [], yearFrom: 2024, yearTo: 2024, route: "all", size: { kind: "questions", amount: 50 }, seed: 7 }, "IGCSE Maths 0580");
    expect(short).toMatchObject({ ok: false, error: expect.stringMatching(/^Only \d+ matching questions/) });
  });

  it("refuses topics the builder doesn't have, listing the real ones", () => {
    const unknown = planPracticeSet(questions, { bank: "igcse", topics: ["Quantum gravity"], subtopics: [], route: "all", size: { kind: "questions", amount: 5 }, seed: 1 }, "IGCSE Maths 0580");
    expect(unknown).toMatchObject({ ok: false, error: expect.stringContaining("Quantum gravity") });
    if (!unknown.ok) expect(unknown.error).toContain("Algebra and graphs");
  });

  it("keeps sets within the builder's limits", () => {
    expect(planPracticeSet(questions, { bank: "igcse", topics: [], subtopics: [], route: "all", size: { kind: "questions", amount: 51 }, seed: 1 }, "x").ok).toBe(false);
    expect(planPracticeSet(questions, { bank: "igcse", topics: [], subtopics: [], route: "all", size: { kind: "marks", amount: 201 }, seed: 1 }, "x").ok).toBe(false);
    expect(planPracticeSet(questions, { bank: "igcse", topics: [], subtopics: [], route: "extended", paper: 1, size: { kind: "marks", amount: 20 }, seed: 1 }, "x")).toMatchObject({ ok: false, error: expect.stringContaining("no Paper 1") });
  });
});

describe("build_practice_set tool", () => {
  it("opens the built set in the paper builder", async () => {
    const outcome = await buildPracticeSetTool(context(), algebra);
    expect(outcome.isError).toBeUndefined();
    expect(outcome.navigation).toMatchObject({ kind: "build", bank: "igcse", path: expect.stringMatching(/^\/worksheets\/build\?bank=igcse&route=extended&from=2022&to=2024&t=t%3AAlgebra\+and\+graphs&size=q10&seed=42(&q=[^&]+){10}$/) });
    expect(JSON.parse(outcome.content)).toMatchObject({ questions: 10, note: expect.stringContaining("saves it") });
  });

  it("never builds without a plan that covers the bank", async () => {
    const outcome = await buildPracticeSetTool(context(false), algebra);
    expect(outcome).toMatchObject({ isError: true, content: expect.stringContaining("part of a plan") });
    expect(outcome.navigation).toBeUndefined();
  });

  it("is one committed action per message", async () => {
    expect((await buildPracticeSetTool(context(true, 1), algebra)).isError).toBe(true);
  });

  it("checks every field again", async () => {
    for (const bad of [{ ...algebra, bank: "made-up" }, { ...algebra, size_kind: "pages" }, { ...algebra, route: "sideways" }, { ...algebra, paper: "two" }, { ...algebra, size_amount: 0 }]) {
      expect((await buildPracticeSetTool(context(), bad)).isError, JSON.stringify(bad)).toBe(true);
    }
  });

  it("runs inside the agent loop and sends a build navigation", async () => {
    const turns = [
      { tools: [{ name: "build_practice_set", input: algebra }], stop: "tool_use" },
      { text: "Built 10 algebra questions.", stop: "end_turn" },
    ];
    let call = 0;
    const api = { stream: () => {
      const turn = turns[call++];
      return {
        async *[Symbol.asyncIterator]() { if (turn.text) yield { type: "content_block_delta", delta: { type: "text_delta", text: turn.text } }; },
        finalMessage: async () => ({ model: "m", stop_reason: turn.stop, content: [...(turn.text ? [{ type: "text", text: turn.text }] : []), ...(turn.tools ?? []).map((tool, index) => ({ type: "tool_use", id: `t${index}`, name: tool.name, input: tool.input }))], usage: { input_tokens: 1, output_tokens: 1 } }),
      };
    } } as never;
    const events: Array<{ type: string; kind?: string }> = [];
    await runSiteAgent({ api, model: "m", data: DATA, messages: [{ role: "user", content: "10 algebra questions" }], send: (event) => events.push(event), tools: { canBuild: () => true, builderQuestions: async () => questions, seed: () => 42 } });
    expect(events.map((event) => event.type)).toEqual(["step", "navigate", "text"]);
    expect(events[1]).toMatchObject({ kind: "build" });
  });
});
