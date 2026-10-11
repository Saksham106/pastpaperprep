import type { QuestionFilters, QuestionSort } from "@/lib/questions";
import type { CourseRouteSelection } from "@/lib/course-route";

export const EXPLORER_PAGE_SIZE = 24;
const MAX_SHARED_PAGES = 10;
const SORTS = new Set<QuestionSort>(["paper", "topic", "marks-desc", "marks-asc"]);

export type ExplorerFilterKey = "topics" | "subtopics" | "granularLabels" | "officialCodeRefs" | "retrievalFacets" | "years" | "papers" | "sessions" | "subjects" | "zones" | "courseEras" | "options" | "components" | "calculator";
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
};

const PARAMS: Array<[string, ExplorerFilterKey]> = [
  ["topic", "topics"],
  ["subtopic", "subtopics"],
  ["granularLabel", "granularLabels"],
  ["officialCode", "officialCodeRefs"],
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

export function parseExplorerState(params: ExplorerSearchParams, options: { defaultFreeOnly?: boolean } = {}): ExplorerState {
  const rawSearch = first(params.q).trim();
  const rawSort = first(params.sort) as QuestionSort;
  const filters: ExplorerFilters = {};

  for (const [param, key] of PARAMS) {
    const selected = values(params[param]);
    if (selected.length) Object.assign(filters, { [key]: selected });
  }

  return {
    search: rawSearch.length <= 200 ? rawSearch : "",
    sort: SORTS.has(rawSort) ? rawSort : "paper",
    filters,
    freeOnly: params.free === undefined ? Boolean(options.defaultFreeOnly) : first(params.free) === "1",
    savedOnly: first(params.saved) === "1",
    courseRoute: first(params.route) === "core" || first(params.route) === "extended" ? first(params.route) as CourseRouteSelection : "all",
    visible: boundedPage(params.page) * EXPLORER_PAGE_SIZE,
  };
}

export function serializeExplorerState(state: ExplorerState, options: { persistFreeChoice?: boolean } = {}): URLSearchParams {
  const params = new URLSearchParams();
  const search = state.search.trim();
  if (search) params.set("q", search.slice(0, 200));
  if (state.sort !== "paper") params.set("sort", state.sort);
  if (state.courseRoute !== "all") params.set("route", state.courseRoute);

  for (const [param, key] of PARAMS) {
    const selected = [...new Set((state.filters[key] ?? []).filter((item) => item && item.length <= 100))].slice(0, 20);
    for (const value of selected) params.append(param, value);
  }

  if (state.freeOnly) params.set("free", "1");
  else if (options.persistFreeChoice) params.set("free", "0");
  if (state.savedOnly) params.set("saved", "1");
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
