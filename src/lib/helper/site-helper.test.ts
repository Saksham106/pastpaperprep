import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { runSiteAgent } from "@/lib/helper/site-agent";
import { parseSiteEvent } from "@/lib/helper/site-events";
import { helperPageContext, helperPageKind, safeHelperPath } from "@/lib/helper/site-paths";
import { buildSiteMessages, HELPER_SITE_SYSTEM_PROMPT } from "@/lib/helper/site-prompt";
import { parseSiteHelperRequest } from "@/lib/helper/site-request";
import { bankPath, loadSiteData, runSiteTool, siteDestinations, SITE_TOOLS, type SiteData } from "@/lib/helper/site-tools";
import { bankFacets } from "@/lib/site-facets";
import { siteShortcut } from "@/lib/helper/site-shortcut";

const BASE: Omit<SiteData, "destinations"> = {
  index: {
    version: 2,
    subjects: [
      { bank: "igcse", name: "IGCSE Maths 0580", qualification: "igcse", practiceHref: "/banks/igcse?free=1", questionCount: 4174, papersHref: "/past-papers/igcse-maths-0580", paperCount: 2, terms: ["igcse", "maths", "0580", "mathematics", "math", "core", "extended", "cambridge"] },
      { bank: "ib-hl", name: "IB Math AA HL", qualification: "ib", practiceHref: "/banks/ib-hl?free=1", questionCount: 893, papersHref: null, paperCount: 0, terms: ["ib", "math", "aa", "analysis", "approaches", "hl", "mathematics", "maths"] },
    ],
    topics: [
      { bank: "igcse", label: "Vectors and transformations", parent: null, href: "/banks/igcse/topics/vectors-and-transformations", count: 300 },
      { bank: "igcse", label: "Number", parent: null, href: "/banks/igcse/topics/number", count: 1643 },
      { bank: "igcse", label: "Vectors in two dimensions", parent: "Vectors and transformations", href: "/banks/igcse?free=0&subtopic=Vectors+in+two+dimensions", count: 120 },
      { bank: "ib-hl", label: "Calculus", parent: null, href: "/banks/ib-hl/topics/calculus", count: 400 },
    ],
  },
  papers: {
    version: 2,
    papers: [
      { id: "p1", bankSlug: "igcse", qualification: "igcse", syllabusCode: "0580", year: 2024, session: "May/June", sessionCode: "s", component: "22", paper: "2", variant: "2", route: "Extended", href: "/past-papers/igcse-maths-0580/0580-s24-22", title: "IGCSE Maths 0580 May/June 2024 Paper 22", detail: "Paper 22 · Extended · May/June 2024" },
    ] as SiteData["papers"]["papers"],
  },
  facets: { version: 2, banks: { igcse: { years: [2024, 2023], papers: [1, 2, 3, 4], sessions: ["June", "November", "March"] } } },
  pages: [
    { path: "/articles/topic-questions-vs-full-past-papers", label: "Topic Questions vs Full Past Papers: When to Use Each" },
    { path: "/revision-notes/ib-math-aa/calculus/5-16-integration-by-substitution-and-parts", label: "IB Maths AA notes · Integration by substitution and parts" },
  ],
};
const DATA: SiteData = { ...BASE, destinations: siteDestinations(BASE) };

const run = (name: string, input: unknown, navigations = 0) => runSiteTool(name, input, { data: DATA, navigations });

describe("safeHelperPath", () => {
  it("allows site pages and keeps their query", () => {
    expect(safeHelperPath("/")).toBe("/");
    expect(safeHelperPath("/banks/igcse?topic=Number&year=2023")).toBe("/banks/igcse?topic=Number&year=2023");
    expect(safeHelperPath("/past-papers/igcse-maths-0580/0580-s24-22")).toBeTruthy();
    expect(safeHelperPath("/pricing")).toBe("/pricing");
  });

  it("rejects other sites, account, auth and API routes, and odd characters", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/account", "/api/helper", "/auth/callback", "/login", "/r/abc", "/invite/x", "/helper/igcse/q1", "/banks/../account", "/banks\\x", "/banks/igcse#x", "javascript:alert(1)", "", 5, null]) {
      expect(safeHelperPath(bad), String(bad)).toBeNull();
    }
  });

  it("tells Pepper the path and chosen study filters only", () => {
    expect(helperPageContext("/banks/igcse", "?topic=Number&year=2023&q=my+search&worksheet=ws-1&utm_source=x&save=q1")).toBe("/banks/igcse?topic=Number&year=2023");
    expect(helperPageContext("/worksheets/build", "?worksheet=ws-1")).toBe("/worksheets");
    expect(helperPageContext("/banks/igcse", "?route=extended&paper=2")).toBe("/banks/igcse?paper=2&route=extended");
  });

  it("names pages for analytics without the query", () => {
    expect(helperPageKind("/")).toBe("home");
    expect(helperPageKind("/banks/igcse")).toBe("bank");
    expect(helperPageKind("/banks/igcse/topics/number")).toBe("topic");
    expect(helperPageKind("/past-papers/igcse-maths-0580/0580-s24-22")).toBe("paper");
    expect(helperPageKind("/account")).toBe("other");
  });
});

describe("site tools", () => {
  it("keeps tool definitions strict and in a stable order (they are part of the cached prefix)", () => {
    expect(SITE_TOOLS.map((tool) => ("name" in tool ? tool.name : ""))).toEqual(["search_site", "bank_details", "find_past_papers", "open_bank", "open_page"]);
    for (const tool of SITE_TOOLS) expect(tool).toMatchObject({ strict: true, input_schema: { additionalProperties: false } });
    expect(HELPER_SITE_SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("finds subjects and topics with links", () => {
    const result = JSON.parse(run("search_site", { query: "vectors", bank: "" }).content);
    expect(result.topics[0]).toMatchObject({ bank: "igcse", topic: "Vectors and transformations", link: "/banks/igcse/topics/vectors-and-transformations" });
    const subjects = JSON.parse(run("search_site", { query: "igcse maths", bank: "" }).content);
    expect(subjects.subjects[0]).toMatchObject({ bank: "igcse", fullPapers: "/past-papers/igcse-maths-0580" });
  });

  it("lists a bank's real filter values", () => {
    const details = JSON.parse(run("bank_details", { bank: "igcse" }).content);
    expect(details.years).toEqual(["2024", "2023"]);
    expect(details.routes.map((r: { route: string }) => r.route)).toEqual(["core", "extended"]);
    expect(details.topics.find((t: { topic: string }) => t.topic === "Vectors and transformations").subtopics).toEqual(["Vectors in two dimensions"]);
    expect(run("bank_details", { bank: "nope" }).isError).toBe(true);
  });

  it("returns metadata only, never question content", () => {
    for (const [name, input] of [["search_site", { query: "vectors", bank: "" }], ["bank_details", { bank: "igcse" }], ["find_past_papers", { query: "0580 may june 2024 paper 22" }]] as const) {
      expect(run(name, input).content).not.toMatch(/questionImages|markscheme|\.webp|signed/i);
    }
  });

  it("finds articles and notes pages", () => {
    const result = JSON.parse(run("search_site", { query: "integration by parts notes", bank: "" }).content);
    expect(result.pages).toEqual([{ title: "IB Maths AA notes · Integration by substitution and parts", link: "/revision-notes/ib-math-aa/calculus/5-16-integration-by-substitution-and-parts" }]);
  });

  it("finds full papers", () => {
    const result = JSON.parse(run("find_past_papers", { query: "0580 may june 2024 paper 22" }).content);
    expect(result.papers[0].link).toBe("/past-papers/igcse-maths-0580/0580-s24-22");
  });

  it("builds a filtered bank link with canonical spellings and shows locked questions too", () => {
    const built = bankPath(DATA, { bank: "igcse", topics: ["vectors and transformations"], subtopics: [], years: ["2023"], papers: ["2"], sessions: ["june"], route: "Extended", search: "", free_only: false, label: "Vectors · 2023" });
    expect(built).toEqual({ bank: "igcse", label: "Vectors · 2023", path: expect.any(String) });
    const url = new URL((built as { path: string }).path, "https://x");
    expect(url.pathname).toBe("/banks/igcse");
    expect(url.searchParams.getAll("topic")).toEqual(["Vectors and transformations"]);
    expect(url.searchParams.get("year")).toBe("2023");
    expect(url.searchParams.get("paper")).toBe("2");
    expect(url.searchParams.get("session")).toBe("June");
    expect(url.searchParams.get("route")).toBe("extended");
    expect(url.searchParams.get("free")).toBe("0");
  });

  it("leaves the route to the bank when none is asked for", () => {
    const built = bankPath(DATA, { bank: "igcse", topics: [], subtopics: [], years: [], papers: [], sessions: [], route: "", search: "trapezium", free_only: true, label: "" }) as { path: string; label: string };
    const url = new URL(built.path, "https://x");
    expect(url.searchParams.has("route")).toBe(false);
    expect(url.searchParams.get("q")).toBe("trapezium");
    expect(url.searchParams.get("free")).toBe("1");
    expect(built.label).toBe("IGCSE Maths 0580");
  });

  it("refuses made-up filter values instead of opening an empty page", () => {
    const outcome = run("open_bank", { bank: "igcse", topics: ["Quantum gravity"], subtopics: [], years: ["1999"], papers: [], sessions: [], route: "", search: "", free_only: false, label: "x" });
    expect(outcome.isError).toBe(true);
    expect(outcome.content).toContain("Quantum gravity");
    expect(outcome.content).toContain("1999");
    expect(outcome.navigation).toBeUndefined();
    expect(run("open_bank", { bank: "igcse", topics: [], subtopics: [], years: [], papers: [], sessions: [], route: "paper-9", search: "", free_only: false, label: "x" }).isError).toBe(true);
  });

  it("opens allowed pages and refuses everything else", () => {
    expect(run("open_page", { path: "/past-papers", label: "Past papers" }).navigation).toEqual({ kind: "page", path: "/past-papers", label: "Past papers" });
    expect(run("open_page", { path: "/banks/igcse/topics/number", label: "Number" }).navigation).toMatchObject({ bank: "igcse" });
    expect(run("open_page", { path: "/articles/topic-questions-vs-full-past-papers", label: "Guide" }).navigation?.path).toBe("/articles/topic-questions-vs-full-past-papers");
    // Invented pages under an allowed section, and banks without their exact link, are refused.
    for (const path of ["/account", "/api/billing/checkout", "https://example.com", "/banks/made-up", "/articles/made-up-guide", "/revision-notes/ib-math-aa/made-up", "/banks/igcse", "/past-papers/igcse-maths-0580/made-up"]) {
      expect(run("open_page", { path, label: "x" }).navigation, path).toBeUndefined();
    }
  });

  it("doesn't open the paper library on a deployment without one", () => {
    const withoutPapers = { ...BASE, papers: { version: 2 as const, papers: [] } };
    const context = { data: { ...withoutPapers, destinations: siteDestinations(withoutPapers) }, navigations: 0 };
    expect(runSiteTool("open_page", { path: "/past-papers", label: "Papers" }, context).isError).toBe(true);
    expect(run("open_page", { path: "/past-papers", label: "Papers" }).isError).toBeUndefined();
  });

  it("caps navigations per message", () => {
    expect(run("open_page", { path: "/dashboard", label: "Banks" }, 1).isError).toBe(true);
  });

  it("rejects non-object input and unknown tools", () => {
    expect(run("search_site", "vectors").isError).toBe(true);
    expect(run("buy_plan", {}).isError).toBe(true);
  });

  it("loads the search files and filters boards", async () => {
    const files: Record<string, string> = { "index.json": JSON.stringify(DATA.index), "papers.json": JSON.stringify(DATA.papers) };
    const data = await loadSiteData(async (name) => { if (!(name in files)) throw new Error("missing"); return files[name]; });
    expect(data.index.subjects).toHaveLength(2);
    expect(data.facets.banks).toEqual({});
    expect(data.destinations.has("/banks/igcse/topics/number")).toBe(true);
    expect(data.destinations.has("/articles/topic-questions-vs-full-past-papers")).toBe(false);
    await expect(loadSiteData(async () => "{}")).rejects.toThrow();
  });

  it("summarises a bank's facets", () => {
    expect(bankFacets([{ year: 2023, paper: 2, session: "June" }, { year: 2024, paper: 1, session: "June" }, { year: 2024, paper: 2, session: "March" }])).toEqual({ years: [2024, 2023], papers: [1, 2], sessions: ["June", "March"] });
  });
});

describe("site request and events", () => {
  it("accepts a conversation and the current page", () => {
    expect(parseSiteHelperRequest({ page: "/banks/igcse?topic=Number", messages: [{ role: "user", text: " hi " }] })).toEqual({ page: "/banks/igcse?topic=Number", messages: [{ role: "user", text: "hi" }] });
  });

  it("rejects malformed requests", () => {
    for (const body of [null, {}, { page: "https://x", messages: [{ role: "user", text: "hi" }] }, { page: "/", messages: [] }, { page: "/", messages: [{ role: "assistant", text: "hi" }] }, { page: "/", messages: [{ role: "system", text: "hi" }] }, { page: "/", messages: [{ role: "user", text: "x".repeat(2001) }] }]) {
      expect(parseSiteHelperRequest(body)).toBeNull();
    }
  });

  it("puts the page in an operator note after the student's message", () => {
    const messages = buildSiteMessages({ page: "/pricing", messages: [{ role: "user", text: "hello" }] });
    expect(messages.at(-1)).toEqual({ role: "system", content: "The student is on this page: /pricing" });
  });

  it("parses stream events and drops unsafe navigations", () => {
    expect(parseSiteEvent('{"type":"step","label":"Searching vectors"}')).toEqual({ type: "step", label: "Searching vectors" });
    expect(parseSiteEvent('{"type":"step","label":""}')).toBeNull();
    expect(parseSiteEvent('{"type":"text","text":"Hi"}')).toEqual({ type: "text", text: "Hi" });
    expect(parseSiteEvent('{"type":"navigate","kind":"bank","path":"/banks/igcse?year=2023","label":"2023"}')).toMatchObject({ path: "/banks/igcse?year=2023" });
    expect(parseSiteEvent('{"type":"navigate","kind":"page","path":"/account","label":"x"}')).toBeNull();
    expect(parseSiteEvent("not json")).toBeNull();
  });
});

type FakeEvent = { type: string; delta?: { type: string; text?: string } };
function fakeApi(turns: Array<{ text?: string; tools?: Array<{ name: string; input: unknown }>; stop: string }>) {
  const calls: Array<Record<string, unknown>> = [];
  const stream = vi.fn((params: Record<string, unknown>) => {
    calls.push(structuredClone(params));
    const turn = turns[calls.length - 1];
    const events: FakeEvent[] = turn.text ? [{ type: "content_block_delta", delta: { type: "text_delta", text: turn.text } }] : [];
    const content = [
      ...(turn.text ? [{ type: "text", text: turn.text }] : []),
      ...(turn.tools ?? []).map((tool, index) => ({ type: "tool_use", id: `tool_${calls.length}_${index}`, name: tool.name, input: tool.input })),
    ];
    return {
      async *[Symbol.asyncIterator]() { for (const event of events) yield event; },
      finalMessage: async () => ({ model: "claude-opus-5-5", stop_reason: turn.stop, content, usage: { input_tokens: 1, output_tokens: 1 } }),
    };
  });
  return { api: { stream } as never, calls };
}

describe("runSiteAgent", () => {
  it("runs tools, sends the navigation, then streams the answer", async () => {
    const { api, calls } = fakeApi([
      { tools: [{ name: "bank_details", input: { bank: "igcse" } }], stop: "tool_use" },
      { tools: [{ name: "open_bank", input: { bank: "igcse", topics: ["Number"], subtopics: [], years: ["2024"], papers: [], sessions: [], route: "", search: "", free_only: false, label: "Number · 2024" } }], stop: "tool_use" },
      { text: "Opened Number from 2024.", stop: "end_turn" },
    ]);
    const events: unknown[] = [];
    const result = await runSiteAgent({ api, model: "claude-opus-5-5", data: DATA, messages: buildSiteMessages({ page: "/", messages: [{ role: "user", text: "2024 number questions" }] }), send: (event) => events.push(event) });
    expect(result).toEqual({ sentText: true, navigated: true, refused: false });
    expect(events).toEqual([
      { type: "step", label: "Checking IGCSE Maths 0580" },
      { type: "step", label: "Opening IGCSE Maths 0580" },
      { type: "navigate", kind: "bank", path: "/banks/igcse?topic=Number&year=2024&free=0", label: "Number · 2024", bank: "igcse" },
      { type: "text", text: "Opened Number from 2024." },
    ]);
    // Tool results go back in one user message, after the assistant's own content.
    const third = calls[2].messages as Array<{ role: string; content: unknown }>;
    expect(third.at(-1)).toMatchObject({ role: "user", content: [{ type: "tool_result", tool_use_id: "tool_2_0" }] });
    expect(calls[0]).toMatchObject({ output_config: { effort: "low" }, fallbacks: "default" });
  });

  it("keeps words from separate rounds in separate paragraphs and caches the conversation", async () => {
    const { api, calls } = fakeApi([
      { text: "Let me look.", tools: [{ name: "search_site", input: { query: "vectors", bank: "" } }], stop: "tool_use" },
      { text: "Found it.", stop: "end_turn" },
    ]);
    const events: Array<{ type: string; text?: string }> = [];
    await runSiteAgent({ api, model: "claude-opus-5-5", data: DATA, messages: [{ role: "user", content: "x" }], send: (event) => events.push(event) });
    expect(events.filter((e) => e.type === "text").map((e) => e.text).join("")).toBe("Let me look.\n\nFound it.");
    expect(calls[0]).toMatchObject({ cache_control: { type: "ephemeral" } });
  });

  it("forces a text answer on the last round", async () => {
    const loop = { tools: [{ name: "search_site", input: { query: "vectors", bank: "" } }], stop: "tool_use" };
    const { api, calls } = fakeApi([loop, loop, loop, loop, { text: "Here you go.", stop: "end_turn" }]);
    await runSiteAgent({ api, model: "claude-opus-5-5", data: DATA, messages: [{ role: "user", content: "x" }], send: () => {} });
    expect(calls).toHaveLength(5);
    expect(calls[3].tool_choice).toBeUndefined();
    expect(calls[4].tool_choice).toEqual({ type: "none" });
  });

  it("never runs a tool call cut off at max_tokens, and reports a refusal", async () => {
    const cut = fakeApi([{ tools: [{ name: "open_page", input: { path: "/pricing", label: "x" } }], stop: "max_tokens" }]);
    const events: unknown[] = [];
    expect(await runSiteAgent({ api: cut.api, model: "m", data: DATA, messages: [{ role: "user", content: "x" }], send: (e) => events.push(e) })).toMatchObject({ sentText: false, navigated: false, refused: true });
    expect(events).toEqual([]);
    const refused = fakeApi([{ stop: "refusal" }]);
    expect(await runSiteAgent({ api: refused.api, model: "m", data: DATA, messages: [{ role: "user", content: "x" }], send: () => {} })).toMatchObject({ refused: true });
  });
});

describe("siteShortcut (rules before AI)", () => {
  it("opens an exactly named paper without the model", () => {
    expect(siteShortcut(DATA, "0580 may june 2024 paper 22", "/")?.navigation).toMatchObject({ kind: "page", path: "/past-papers/igcse-maths-0580/0580-s24-22" });
  });

  it("leaves a paper to the model when the year, session or paper is missing", () => {
    expect(siteShortcut(DATA, "0580 2024 paper 22", "/")).toBeNull();
    expect(siteShortcut(DATA, "0580 may june 2024", "/")).toBeNull();
  });

  it("opens a topic named on its own or with its subject", () => {
    expect(siteShortcut(DATA, "Vectors and transformations", "/")?.navigation).toMatchObject({ path: "/banks/igcse/topics/vectors-and-transformations", label: "IGCSE Maths 0580 · Vectors and transformations" });
    expect(siteShortcut(DATA, "show me ib aa hl calculus questions", "/")?.navigation.path).toBe("/banks/ib-hl/topics/calculus");
    expect(siteShortcut(DATA, "calculus", "/banks/ib-hl?free=1")?.navigation.path).toBe("/banks/ib-hl/topics/calculus");
  });

  it("opens a subject named exactly", () => {
    expect(siteShortcut(DATA, "IB math AA HL", "/")?.navigation).toMatchObject({ path: "/banks/ib-hl?free=1" });
  });

  it("sends questions, explanations and ambiguous requests to the model", () => {
    for (const text of ["what is a vector?", "explain calculus", "how do I revise number", "maths", "number vectors calculus", "I keep losing marks on vectors and I don't know what to practise next week"]) {
      expect(siteShortcut(DATA, text, "/"), text).toBeNull();
    }
  });

  it("is stricter mid-conversation: a bare topic only counts on its own bank page", () => {
    expect(siteShortcut(DATA, "calculus", "/", true)).toBeNull();
    expect(siteShortcut(DATA, "calculus", "/banks/ib-hl", true)?.navigation.path).toBe("/banks/ib-hl/topics/calculus");
    expect(siteShortcut(DATA, "IB math AA HL", "/", true)).toBeNull();
  });

  it("only ever opens paths the browser accepts", () => {
    for (const text of ["0580 may june 2024 paper 22", "Vectors and transformations", "IB math AA HL"]) {
      expect(safeHelperPath(siteShortcut(DATA, text, "/")?.navigation.path)).toBeTruthy();
    }
  });
});
