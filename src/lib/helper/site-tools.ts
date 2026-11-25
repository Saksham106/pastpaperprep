import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { hasFreeTier } from "@/lib/access";
import type { BankSlug } from "@/lib/banks";
import { routeConfigFor } from "@/lib/course-route";
import { serializeExplorerState } from "@/lib/explorer-state";
import { helperBoard } from "@/lib/helper/config";
import { HELPER_SITE_BOARDS, HELPER_SITE_MAX_NAVIGATIONS } from "@/lib/helper/site-config";
import { safeHelperPath } from "@/lib/helper/site-paths";
import { matchTopics, searchSite, validSearchIndex, validSearchPapers, type SearchIndex, type SearchPapers, type SearchSubject, type SearchTopic } from "@/lib/site-search";
import { SEARCH_INDEX_VERSION } from "@/lib/site-search";
import type { BankFacets, SearchFacets, SearchPage, SearchPages } from "@/lib/site-facets";

// The site helper's tools. Every one reads build-time metadata (public/search/*.json): subject names, topic labels,
// counts, paper names and links. None returns question text, images or mark schemes, so nothing paid can leak here.

/** `pages` are articles and published notes; `destinations` is every exact path open_page may open. */
export type SiteData = { index: SearchIndex; papers: SearchPapers; facets: SearchFacets; pages: SearchPage[]; destinations: ReadonlySet<string> };

/** Fixed pages open_page may open, besides the generated ones. */
export const HELPER_STATIC_PAGES: readonly SearchPage[] = [
  { path: "/", label: "Home" },
  { path: "/dashboard", label: "All question banks" },
  { path: "/past-papers", label: "Past-paper library" },
  { path: "/revision-notes", label: "Revision notes" },
  { path: "/worksheets", label: "My worksheets" },
  { path: "/worksheets/build", label: "Build a paper" },
  { path: "/articles", label: "Articles" },
  { path: "/pricing", label: "Plans" },
  { path: "/faq", label: "FAQ" },
  { path: "/grade-thresholds", label: "Grade thresholds" },
  { path: "/updates", label: "What's new" },
];
export type SiteNavigation = { kind: "bank" | "page"; path: string; label: string; bank?: string };

type Reader = (name: string) => Promise<string>;
const readPublicSearch: Reader = (name) => readFile(join(process.cwd(), "public", "search", name), "utf8");

let cached: Promise<SiteData> | undefined;

/** Loads the three search files once per instance. A missing paper or facet file degrades to empty, not an error. */
export function loadSiteData(read: Reader = readPublicSearch): Promise<SiteData> {
  if (read !== readPublicSearch) return parseSiteData(read);
  cached ??= parseSiteData(read);
  void cached.catch(() => { cached = undefined; });
  return cached;
}

async function parseSiteData(read: Reader): Promise<SiteData> {
  const [indexText, papersText, facetsText, pagesText] = await Promise.all([read("index.json"), read("papers.json").catch(() => ""), read("facets.json").catch(() => ""), read("pages.json").catch(() => "")]);
  const index = JSON.parse(indexText) as unknown;
  if (!validSearchIndex(index)) throw new Error("Search index is missing or out of date");
  const papers = papersText ? JSON.parse(papersText) as unknown : null;
  const facets = facetsText ? JSON.parse(facetsText) as SearchFacets | null : null;
  const pagesFile = pagesText ? JSON.parse(pagesText) as SearchPages | null : null;
  const boardOn = (bank: string) => HELPER_SITE_BOARDS[helperBoard(bank)];
  const kept: Omit<SiteData, "destinations"> = {
    index: { ...index, subjects: index.subjects.filter((s) => boardOn(s.bank)), topics: index.topics.filter((t) => boardOn(t.bank)) },
    papers: validSearchPapers(papers) ? { ...papers, papers: papers.papers.filter((p) => boardOn(p.bankSlug)) } : { version: SEARCH_INDEX_VERSION, papers: [] },
    facets: facets && facets.version === SEARCH_INDEX_VERSION && facets.banks ? facets : { version: SEARCH_INDEX_VERSION, banks: {} },
    pages: pagesFile && pagesFile.version === SEARCH_INDEX_VERSION && Array.isArray(pagesFile.pages) ? pagesFile.pages.filter((page) => typeof page?.path === "string" && typeof page.label === "string") : [],
  };
  return { ...kept, destinations: siteDestinations(kept) };
}

/** Every exact path open_page may open: fixed pages, subjects, topic pages, full papers, articles and notes. */
export function siteDestinations(data: Omit<SiteData, "destinations">): ReadonlySet<string> {
  const paths = [
    ...HELPER_STATIC_PAGES.filter((page) => page.path !== "/past-papers" || data.papers.papers.length).map((page) => page.path),
    ...data.index.subjects.flatMap((s) => [s.practiceHref, s.papersHref ?? ""]),
    ...data.index.topics.map((t) => t.href),
    ...data.papers.papers.map((p) => p.href),
    ...data.pages.map((page) => page.path),
  ];
  return new Set(paths.filter((path) => path && safeHelperPath(path)));
}

// ---------- tool definitions (stable order and bytes: they sit in the cached prefix) ----------

const string = (description: string) => ({ type: "string", description });
const strings = (description: string) => ({ type: "array", items: { type: "string" }, description });

export const SITE_TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  {
    name: "search_site",
    description: "Find subjects (question banks), syllabus topics and subtopics, plus articles and revision-notes pages, by the student's words, e.g. \"vectors\", \"igcse physics\", \"0625 electricity\", \"AA HL calculus notes\". Returns bank ids, topic labels, question counts and links. Use it first whenever you don't already know the exact bank id, topic label or page.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        query: string("A few words: a subject, syllabus code, level or topic."),
        bank: string("Optional bank id to search topics in just that bank, or an empty string."),
      },
      required: ["query", "bank"],
      additionalProperties: false,
    },
  },
  {
    name: "bank_details",
    description: "One question bank's exact filter values: its topics with subtopics and counts, the years, paper numbers and sessions it has, and its routes (Core/Extended or paper tabs). Call it before open_bank whenever you will filter by anything.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { bank: string("The bank id, e.g. \"igcse\" or \"ib-hl\", from search_site.") },
      required: ["bank"],
      additionalProperties: false,
    },
  },
  {
    name: "find_past_papers",
    description: "Find full past papers (question paper and mark scheme together) in the free past-paper library by the student's description, e.g. \"0580 may june 2024 paper 22\", \"AA HL 2023 paper 1 TZ2\", \"IGCSE chemistry 2022 paper 4\". Returns titles and links.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { query: string("Subject or syllabus code plus any of year, session, paper, variant, time zone, Core/Extended.") },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "open_bank",
    description: "Open a question bank for the student with filters applied. Every topic, subtopic, year, paper, session and route must be an exact value from bank_details. Use empty arrays or strings for filters the student didn't ask for. search narrows to questions containing those words (e.g. \"photoelectric\").",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        bank: string("The bank id."),
        topics: strings("Topic labels (top-level)."),
        subtopics: strings("Subtopic labels."),
        years: strings("Years, e.g. \"2023\"."),
        papers: strings("Paper numbers, e.g. \"2\"."),
        sessions: strings("Sessions, e.g. \"June\"."),
        route: string("A route id from bank_details, or an empty string."),
        search: string("Words to search question text for, or an empty string."),
        free_only: { type: "boolean", description: "Only free questions. True only when the student asks for free ones." },
        label: string("A short name for what you opened, e.g. \"Vectors · 2023 · Paper 2\"."),
      },
      required: ["bank", "topics", "subtopics", "years", "papers", "sessions", "route", "search", "free_only", "label"],
      additionalProperties: false,
    },
  },
  {
    name: "open_page",
    description: "Open a page that is not a filtered question bank: a link from a tool result (full paper, topic page, subject, article or notes page), or one of /dashboard (all question banks), /past-papers, /revision-notes, /worksheets (My worksheets), /worksheets/build, /articles, /pricing, /faq, /grade-thresholds, /updates. The path must match exactly; anything else is refused.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        path: string("A site path starting with /, e.g. \"/past-papers\"."),
        label: string("A short name for the page."),
      },
      required: ["path", "label"],
      additionalProperties: false,
    },
  },
];

// ---------- execution ----------

export type ToolOutcome = { content: string; isError?: boolean; navigation?: SiteNavigation };
export type ToolContext = { data: SiteData; navigations: number };

const error = (content: string): ToolOutcome => ({ content, isError: true });
const json = (value: unknown): ToolOutcome => ({ content: JSON.stringify(value) });
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const list = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 20) : []);

const subjectSummary = (s: SearchSubject) => ({
  bank: s.bank, name: s.name, questions: s.questionCount,
  ...(s.practiceHref ? { practice: s.practiceHref } : {}),
  ...(s.papersHref ? { fullPapers: s.papersHref, paperCount: s.paperCount } : {}),
});
const topicSummary = (t: SearchTopic) => ({ bank: t.bank, ...(t.parent ? { subtopic: t.label, topic: t.parent } : { topic: t.label }), questions: t.count, link: t.href });

function subjectFor(data: SiteData, bank: string): SearchSubject | undefined {
  return data.index.subjects.find((s) => s.bank === bank && s.practiceHref);
}

const PAGE_FILLER = new Set(["the", "and", "of", "for", "notes", "note", "article", "articles", "on", "about"]);
/** Articles and notes whose title contains every word of the query (ignoring filler), shortest titles first. */
function matchPages(pages: readonly SearchPage[], query: string, limit = 4): SearchPage[] {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 1 && !PAGE_FILLER.has(word));
  if (!words.length) return [];
  return pages.filter((page) => { const label = page.label.toLowerCase(); return words.every((word) => label.includes(word)); })
    .sort((a, b) => a.label.length - b.label.length).slice(0, limit);
}

function searchSiteTool(data: SiteData, input: Record<string, unknown>): ToolOutcome {
  const query = text(input.query, 120);
  if (!query) return error("Give a few words to search for.");
  const bank = text(input.bank, 80);
  if (bank) {
    if (!subjectFor(data, bank)) return error(`No bank "${bank}". Search without a bank to find its id.`);
    const topics = matchTopics(data.index.topics.filter((t) => t.bank === bank), query, 10);
    return json({ topics: topics.map(topicSummary), ...(topics.length ? {} : { note: "No topic matched; try bank_details for the full list." }) });
  }
  const results = searchSite(data.index, null, query);
  const topics = results.topics.length ? results.topics : matchTopics(data.index.topics, query, 8);
  const pages = matchPages(data.pages, query);
  if (!results.subjects.length && !topics.length && !pages.length) return json({ subjects: [], topics: [], note: "Nothing matched. Try a subject name, a syllabus code or a shorter topic word." });
  return json({ subjects: results.subjects.map(subjectSummary), topics: topics.map(topicSummary), ...(pages.length ? { pages: pages.map((page) => ({ title: page.label, link: page.path })) } : {}) });
}

function bankDetailsTool(data: SiteData, input: Record<string, unknown>): ToolOutcome {
  const bank = text(input.bank, 80);
  const subject = subjectFor(data, bank);
  if (!subject) return error(`No bank "${bank}". Use search_site to find the bank id.`);
  const topics = data.index.topics.filter((t) => t.bank === bank);
  const routes = routeConfigFor(bank);
  const facets: BankFacets | undefined = data.facets.banks[bank];
  return json({
    ...subjectSummary(subject),
    topics: topics.filter((t) => !t.parent).map((t) => ({
      topic: t.label, questions: t.count,
      subtopics: topics.filter((s) => s.parent === t.label).slice(0, 30).map((s) => s.label),
    })),
    ...(facets ? { years: facets.years.map(String), papers: facets.papers.map(String), sessions: facets.sessions } : {}),
    ...(routes ? { routes: routes.options.map((o) => ({ route: o.id, name: o.label, detail: o.detail })) } : {}),
  });
}

function findPapersTool(data: SiteData, input: Record<string, unknown>): ToolOutcome {
  const query = text(input.query, 120);
  if (!query) return error("Describe the paper: subject or code, year, session, paper.");
  if (!data.papers.papers.length) return json({ papers: [], note: "The full-paper library isn't available here." });
  const results = searchSite(data.index, data.papers, query);
  if (!results.papers.length) {
    const subjects = results.subjects.filter((s) => s.papersHref).map((s) => ({ name: s.name, library: s.papersHref }));
    return json({ papers: [], note: "No exact paper matched. Check the subject, year, session and paper number.", ...(subjects.length ? { subjects } : {}) });
  }
  return json({ papers: results.papers.map((p) => ({ title: p.title, detail: p.detail, link: p.href })) });
}

/** Case-insensitive match to the bank's own values; returns the canonical spelling, or null for an unknown one. */
function canonical(values: readonly string[], wanted: readonly string[]): { ok: string[]; unknown: string[] } {
  const byLower = new Map(values.map((v) => [v.toLowerCase(), v]));
  const ok: string[] = [];
  const unknown: string[] = [];
  for (const value of wanted) {
    const hit = byLower.get(value.toLowerCase());
    if (hit) ok.push(hit); else unknown.push(value);
  }
  return { ok: [...new Set(ok)], unknown };
}

function navigate(context: ToolContext, navigation: SiteNavigation): ToolOutcome {
  if (context.navigations >= HELPER_SITE_MAX_NAVIGATIONS) return error("You've already opened pages for this message. Answer the student now.");
  context.navigations += 1;
  return { content: JSON.stringify({ opened: navigation.path, label: navigation.label }), navigation };
}

/** Builds the bank URL with the explorer's own serializer, after checking every value against the bank's real ones. */
export function bankPath(data: SiteData, input: Record<string, unknown>): { path: string; label: string; bank: string } | { error: string } {
  const bank = text(input.bank, 80);
  const subject = subjectFor(data, bank);
  if (!subject) return { error: `No bank "${bank}". Use search_site to find the bank id.` };
  const topics = data.index.topics.filter((t) => t.bank === bank);
  const facets = data.facets.banks[bank];
  const checks = {
    topics: canonical(topics.filter((t) => !t.parent).map((t) => t.label), list(input.topics)),
    subtopics: canonical(topics.filter((t) => t.parent).map((t) => t.label), list(input.subtopics)),
    years: canonical((facets?.years ?? []).map(String), list(input.years)),
    papers: canonical((facets?.papers ?? []).map(String), list(input.papers)),
    sessions: canonical(facets?.sessions ?? [], list(input.sessions)),
  };
  const unknown = Object.entries(checks).filter(([, check]) => check.unknown.length).map(([key, check]) => `${key}: ${check.unknown.join(", ")}`);
  if (unknown.length) return { error: `These aren't in ${subject.name}: ${unknown.join("; ")}. Use exact values from bank_details.` };
  const routeValue = text(input.route, 40);
  const route = routeConfigFor(bank)?.options.find((o) => o.id === routeValue.toLowerCase());
  if (routeValue && !route) return { error: `"${routeValue}" isn't a route in ${subject.name}. Use a route id from bank_details, or an empty string.` };
  const search = text(input.search, 100);
  const freeOnly = input.free_only === true;
  const params = serializeExplorerState({
    search,
    sort: "paper",
    filters: {
      ...(checks.topics.ok.length ? { topics: checks.topics.ok } : {}),
      ...(checks.subtopics.ok.length ? { subtopics: checks.subtopics.ok } : {}),
      ...(checks.years.ok.length ? { years: checks.years.ok } : {}),
      ...(checks.papers.ok.length ? { papers: checks.papers.ok } : {}),
      ...(checks.sessions.ok.length ? { sessions: checks.sessions.ok } : {}),
    },
    freeOnly,
    savedOnly: false,
    courseRoute: route?.id ?? "all",
    visible: 24,
  }, { bank });
  // No route asked for: let the bank pick its own (a paper filter on an A Level bank opens that paper's tab).
  if (!route) params.delete("route");
  // Banks with free years default visitors to free questions only; show everything that matches unless asked.
  if (hasFreeTier(bank as BankSlug)) params.set("free", freeOnly ? "1" : "0");
  const query = params.toString();
  const label = text(input.label, 80) || subject.name;
  return { path: `/banks/${bank}${query ? `?${query}` : ""}`, label, bank };
}

function openBankTool(context: ToolContext, input: Record<string, unknown>): ToolOutcome {
  const built = bankPath(context.data, input);
  if ("error" in built) return error(built.error);
  const path = safeHelperPath(built.path);
  if (!path) return error("That filter can't be opened as a link. Use fewer or simpler filters.");
  return navigate(context, { kind: "bank", path, label: built.label, bank: built.bank });
}

function openPageTool(context: ToolContext, input: Record<string, unknown>): ToolOutcome {
  const path = text(input.path, 600);
  // Only exact, known destinations: an invented path under an allowed section is refused, never guessed at.
  if (!context.data.destinations.has(path) || !safeHelperPath(path)) {
    if (path.startsWith("/past-papers") && !context.data.papers.papers.length) return error("The full-paper library isn't available here. Offer the question bank instead.");
    if (path.startsWith("/banks/")) return error("Use open_bank for question banks, or a topic link exactly as a tool returned it.");
    return error("That page doesn't exist. Use a link exactly as a tool returned it, or one of the pages listed for open_page.");
  }
  const pathname = path.split("?")[0];
  const bank = pathname.startsWith("/banks/") ? pathname.split("/")[2] : undefined;
  return navigate(context, { kind: "page", path, label: text(input.label, 80) || "Page", ...(bank ? { bank } : {}) });
}

/** Runs one tool call. Inputs are untrusted model output: every field is re-checked here, whatever the schema says. */
export function runSiteTool(name: string, input: unknown, context: ToolContext): ToolOutcome {
  if (!isRecord(input)) return error("Tool input must be an object.");
  switch (name) {
    case "search_site": return searchSiteTool(context.data, input);
    case "bank_details": return bankDetailsTool(context.data, input);
    case "find_past_papers": return findPapersTool(context.data, input);
    case "open_bank": return openBankTool(context, input);
    case "open_page": return openPageTool(context, input);
    default: return error(`Unknown tool ${name}.`);
  }
}
