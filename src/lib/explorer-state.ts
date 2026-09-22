import type { QuestionFilters, QuestionSort } from "@/lib/questions";

export const EXPLORER_PAGE_SIZE = 24;
const MAX_SHARED_PAGES = 10;
const SORTS = new Set<QuestionSort>(["paper", "topic", "marks-desc", "marks-asc"]);

export type ExplorerFilterKey = "topics" | "subtopics" | "granularLabels" | "years" | "papers" | "sessions" | "subjects" | "zones" | "courseEras" | "options" | "components" | "calculator";
export type ExplorerFilters = Pick<QuestionFilters, ExplorerFilterKey>;
export type ExplorerSearchParams = Record<string, string | string[] | undefined>;

export type ExplorerState = {
  search: string;
  sort: QuestionSort;
  filters: ExplorerFilters;
  freeOnly: boolean;
  savedOnly: boolean;
  visible: number;
};

const PARAMS: Array<[string, ExplorerFilterKey]> = [
  ["topic", "topics"],
  ["subtopic", "subtopics"],
  ["granularLabel", "granularLabels"],
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
    visible: boundedPage(params.page) * EXPLORER_PAGE_SIZE,
  };
}

export function serializeExplorerState(state: ExplorerState, options: { persistFreeChoice?: boolean } = {}): URLSearchParams {
  const params = new URLSearchParams();
  const search = state.search.trim();
  if (search) params.set("q", search.slice(0, 200));
  if (state.sort !== "paper") params.set("sort", state.sort);

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
