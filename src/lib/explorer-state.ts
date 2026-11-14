import type { QuestionFilters, QuestionSort } from "@/lib/questions";
import { parseRouteSelection, routeConfigFor, type CourseRouteSelection } from "@/lib/course-route";
import { AA_BANK_SLUGS, isAaItemId } from "@/lib/aa-item-ids";

export const EXPLORER_PAGE_SIZE = 24;
const MAX_SHARED_PAGES = 10;
const SORTS = new Set<QuestionSort>(["paper", "topic", "marks-desc", "marks-asc"]);

export type ExplorerFilterKey = "topics" | "subtopics" | "granularLabels" | "officialCodeRefs" | "officialItems" | "retrievalFacets" | "years" | "papers" | "sessions" | "subjects" | "zones" | "courseEras" | "options" | "components" | "calculator";
export type ExplorerFilters = Pick<QuestionFilters, ExplorerFilterKey>;
export type ExplorerSearchParams = Record<string, string | string[] | undefined>;

export type ExplorerState = {
  search: string;
  sort: QuestionSort;
  filters: ExplorerFilters;
  freeOnly: boolean;
  savedOnly: boolean;
  courseRoute: CourseRouteSelection;
  visible: number;
  /** Also show questions that cover a picked topic in only some of their parts. */
  partialTopics?: boolean;
};

const PARAMS: Array<[string, ExplorerFilterKey]> = [
  ["topic", "topics"],
  ["subtopic", "subtopics"],
  ["granularLabel", "granularLabels"],
  ["officialCode", "officialCodeRefs"],
  ["item", "officialItems"],
  ["facet", "retrievalFacets"],
  ["year", "years"],
  ["paper", "papers"],
  ["session", "sessions"],
  ["subject", "subjects"],
  ["zone", "zones"],
  ["era", "courseEras"],
  ["option", "options"],
  ["component", "components"],
  ["calculator", "calculator"],
];

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function values(value: string | string[] | undefined): string[] {
  const input = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(input.map((item) => item.trim()).filter((item) => item && item.length <= 100))].slice(0, 20);
}

function boundedPage(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(first(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_SHARED_PAGES) : 1;
}

/**
 * The route for a bank whose URL names none. Banks that open on one route (A Level paper tabs)
 * follow a paper filter that sits in one route, open on "all" for any other filtered link (a topic
 * link must not land on a paper without that topic), and otherwise use the remembered, then default, route.
 */
function implicitRoute(bank: string | undefined, filters: ExplorerFilters, search: string, remembered: string | undefined): CourseRouteSelection {
  const config = routeConfigFor(bank);
  if (!config || config.defaultSelection === "all") return "all";
  const papers = (filters.papers ?? []).map(Number);
  const paperRoutes = new Set(papers.map((paper) => config.options.find((option) => option.papers.includes(paper))?.id));
  if (papers.length && paperRoutes.size === 1 && !paperRoutes.has(undefined)) return [...paperRoutes][0]!;
  if (search || Object.values(filters).some((selected) => selected?.length)) return "all";
  return parseRouteSelection(bank, remembered) ?? config.defaultSelection;
}

/** Topic pages list everything tagged with their topic, so they start with partial matches on. */
export function parseExplorerState(params: ExplorerSearchParams, options: { defaultFreeOnly?: boolean; defaultPartialTopics?: boolean; bank?: string; rememberedRoute?: string } = {}): ExplorerState {
  const rawSearch = first(params.q).trim();
  const rawSort = first(params.sort) as QuestionSort;
  const filters: ExplorerFilters = {};

  for (const [param, key] of PARAMS) {
    const selected = values(params[param]);
    if (selected.length) Object.assign(filters, { [key]: selected });
  }
  // `item` is an AA syllabus item: unknown values are dropped, and the param means nothing on other banks.
  if (filters.officialItems) {
    const known = options.bank && !AA_BANK_SLUGS.has(options.bank) ? [] : filters.officialItems.filter(isAaItemId);
    if (known.length) filters.officialItems = known;
    else delete filters.officialItems;
  }

  const partial = first(params.partial);
  const search = rawSearch.length <= 200 ? rawSearch : "";
  // Without a bank, only the Cambridge Core/Extended values are known (topic and notes links).
  const route = options.bank ? parseRouteSelection(options.bank, first(params.route)) : first(params.route) === "core" || first(params.route) === "extended" ? first(params.route) : undefined;
  return {
    ...((partial ? partial === "1" : options.defaultPartialTopics) ? { partialTopics: true } : {}),
    search,
    sort: SORTS.has(rawSort) ? rawSort : "paper",
    filters,
    freeOnly: params.free === undefined ? Boolean(options.defaultFreeOnly) : first(params.free) === "1",
    savedOnly: first(params.saved) === "1",
    courseRoute: route ?? implicitRoute(options.bank, filters, search, options.rememberedRoute),
    visible: boundedPage(params.page) * EXPLORER_PAGE_SIZE,
  };
}

export function serializeExplorerState(state: ExplorerState, options: { persistFreeChoice?: boolean; defaultPartialTopics?: boolean; bank?: string } = {}): URLSearchParams {
  const params = new URLSearchParams();
  const search = state.search.trim();
  if (search) params.set("q", search.slice(0, 200));
  if (state.sort !== "paper") params.set("sort", state.sort);
  // Banks that open on one route always write it, so a reload or shared link keeps the student's paper.
  if (state.courseRoute !== "all" || (routeConfigFor(options.bank)?.defaultSelection ?? "all") !== "all") params.set("route", state.courseRoute);

  for (const [param, key] of PARAMS) {
    const selected = [...new Set((state.filters[key] ?? []).filter((item) => item && item.length <= 100))].slice(0, 20);
    for (const value of selected) params.append(param, value);
  }

  if (state.freeOnly) params.set("free", "1");
  else if (options.persistFreeChoice) params.set("free", "0");
  if (state.savedOnly) params.set("saved", "1");
  if (Boolean(state.partialTopics) !== Boolean(options.defaultPartialTopics)) params.set("partial", state.partialTopics ? "1" : "0");
  const page = Math.min(MAX_SHARED_PAGES, Math.max(1, Math.ceil(state.visible / EXPLORER_PAGE_SIZE)));
  if (page > 1) params.set("page", String(page));
  return params;
}

const hasFilterParams = (params: ExplorerSearchParams) => PARAMS.some(([param]) => values(params[param]).length > 0);

const ROUTE_PRESET_CLEAR_PARAM = "_preset";

/** Route presets fill only omitted dimensions; explicit same-dimension filters replace them. */
export function withRoutePreset(params: ExplorerSearchParams, preset: ExplorerSearchParams): ExplorerSearchParams {
  if (params[ROUTE_PRESET_CLEAR_PARAM] === "clear") {
    const explicit = { ...params };
    delete explicit[ROUTE_PRESET_CLEAR_PARAM];
    return explicit;
  }
  const merged = { ...preset, ...params };
  delete merged[ROUTE_PRESET_CLEAR_PARAM];
  return merged;
}

/** Keeps a deliberate Clear filters action durable on a route that implies a filter. */
export function preserveClearedRoutePreset(params: URLSearchParams, preset: ExplorerSearchParams): URLSearchParams {
  const cleared = new URLSearchParams(params);
  const presetWasRemoved = Object.entries(preset).some(([key, value]) =>
    values(value).length > 0 && cleared.getAll(key).length === 0,
  );
  if (presetWasRemoved) cleared.set(ROUTE_PRESET_CLEAR_PARAM, "clear");
  else cleared.delete(ROUTE_PRESET_CLEAR_PARAM);
  return cleared;
}

/** Drops the filter params a route already implies, so the clean route URL stays the address. */
export function stripRoutePreset(params: URLSearchParams, preset: ExplorerSearchParams): URLSearchParams {
  if (!hasFilterParams(preset)) return params;
  const same = PARAMS.every(([param]) => {
    const current = [...new Set(params.getAll(param))].sort();
    const implied = values(preset[param]).sort();
    return current.length === implied.length && current.every((value, index) => value === implied[index]);
  });
  if (!same) return params;
  const stripped = new URLSearchParams(params);
  for (const [param] of PARAMS) stripped.delete(param);
  return stripped;
}
