import type { BankSlug } from "@/lib/banks";
import { A_LEVEL_MATHS_9709, MATHS_9709_PAPERS } from "@/lib/a-level-9709";
import { A_LEVEL_PHYSICS_9702, PHYSICS_9702_PAPERS } from "@/lib/a-level-9702";
import { A_LEVEL_CHEMISTRY_9701, CHEMISTRY_9701_PAPERS } from "@/lib/a-level-9701";
import { A_LEVEL_BIOLOGY_9700, BIOLOGY_9700_PAPERS } from "@/lib/a-level-9700";
import { A_LEVEL_ECONOMICS_9708, ECONOMICS_9708_PAPERS } from "@/lib/a-level-9708";
import { A_LEVEL_COMPUTER_SCIENCE_9618, COMPUTER_SCIENCE_9618_PAPERS } from "@/lib/a-level-9618";

/**
 * Per-bank route options: the top-level scope a student picks before topics and filters.
 * - Cambridge IGCSE Core / Extended: shared practicals (Papers 5–6) belong to both routes.
 * - A Level Maths 9709 paper tabs: each paper is its own route, because students sit specific papers.
 * A question's `syllabusRoute` is the route id its paper belongs to ("both" = every route).
 */
export type CourseRoute = string;
/** "all", or one of the bank's route option ids. */
export type CourseRouteSelection = string;

export type RouteOption = {
  id: string;
  label: string;
  /** Short guidance shown under the label ("Papers 1 & 3"). */
  detail: string;
  /** Papers in this route. Papers listed under several routes count as "both". */
  papers: readonly number[];
};

export type BankRouteConfig = {
  /** Accessible group name. */
  name: string;
  allLabel: string;
  allDetail: string;
  options: readonly RouteOption[];
  /** Selection when the URL names none (and nothing is remembered). */
  defaultSelection: CourseRouteSelection;
  /** Remember the last choice per bank in this browser. */
  remember: boolean;
  /** A route limits the topic list as well as the questions. */
  scopesTopics: boolean;
  /** A route fixes the paper, so the paper filter is redundant once one is chosen. */
  hidesPaperFilter: boolean;
};

const CORE_EXTENDED: BankRouteConfig = {
  name: "Course route",
  allLabel: "All",
  allDetail: "Core + Extended",
  options: [
    { id: "core", label: "Core", detail: "Papers 1 & 3", papers: [1, 3, 5, 6] },
    { id: "extended", label: "Extended", detail: "Papers 2 & 4", papers: [2, 4, 5, 6] },
  ],
  defaultSelection: "all",
  remember: false,
  scopesTopics: false,
  hidesPaperFilter: false,
};

const MATHS_9709_TABS: BankRouteConfig = {
  name: "Paper",
  allLabel: "All papers",
  allDetail: "Papers 1–6",
  options: MATHS_9709_PAPERS.map((paper) => ({ id: paper.route, label: paper.label, detail: `Paper ${paper.paper}`, papers: [paper.paper] })),
  defaultSelection: "pure-1",
  remember: true,
  scopesTopics: true,
  hidesPaperFilter: true,
};

/** 9702: every candidate sits Paper 1 (multiple choice) and Paper 2; A Level adds Paper 4. */
const PHYSICS_9702_TABS: BankRouteConfig = {
  name: "Paper",
  allLabel: "All papers",
  allDetail: "Papers 1, 2 & 4",
  options: PHYSICS_9702_PAPERS.map((paper) => ({ id: paper.route, label: paper.label, detail: `Paper ${paper.paper}`, papers: [paper.paper] })),
  defaultSelection: "multiple-choice",
  remember: true,
  scopesTopics: true,
  hidesPaperFilter: true,
};

/** 9701: the same paper structure as 9702. */
const CHEMISTRY_9701_TABS: BankRouteConfig = {
  name: "Paper",
  allLabel: "All papers",
  allDetail: "Papers 1, 2 & 4",
  options: CHEMISTRY_9701_PAPERS.map((paper) => ({ id: paper.route, label: paper.label, detail: `Paper ${paper.paper}`, papers: [paper.paper] })),
  defaultSelection: "multiple-choice",
  remember: true,
  scopesTopics: true,
  hidesPaperFilter: true,
};

/** 9700: the same paper structure as 9701 and 9702. */
const BIOLOGY_9700_TABS: BankRouteConfig = {
  name: "Paper",
  allLabel: "All papers",
  allDetail: "Papers 1, 2 & 4",
  options: BIOLOGY_9700_PAPERS.map((paper) => ({ id: paper.route, label: paper.label, detail: `Paper ${paper.paper}`, papers: [paper.paper] })),
  defaultSelection: "multiple-choice",
  remember: true,
  scopesTopics: true,
  hidesPaperFilter: true,
};

/**
 * 9708: four papers, ordered as students sit them (AS multiple choice, AS written, then A Level). Most candidates
 * start with AS Paper 1, so the bank opens there.
 */
const ECONOMICS_9708_TABS: BankRouteConfig = {
  name: "Paper",
  allLabel: "All papers",
  allDetail: "Papers 1–4",
  options: ECONOMICS_9708_PAPERS.map((paper) => ({ id: paper.route, label: paper.label, detail: `Paper ${paper.paper}`, papers: [paper.paper] })),
  defaultSelection: "as-multiple-choice",
  remember: true,
  scopesTopics: true,
  hidesPaperFilter: true,
};

/**
 * 9618: three papers, ordered as students sit them (AS theory, AS problem-solving, then A Level theory). AS candidates
 * take Papers 1 and 2 in the same series, so the bank opens on Paper 1.
 */
const COMPUTER_SCIENCE_9618_TABS: BankRouteConfig = {
  name: "Paper",
  allLabel: "All papers",
  allDetail: "Papers 1–3",
  options: COMPUTER_SCIENCE_9618_PAPERS.map((paper) => ({ id: paper.route, label: paper.label, detail: `Paper ${paper.paper}`, papers: [paper.paper] })),
  defaultSelection: "as-theory",
  remember: true,
  scopesTopics: true,
  hidesPaperFilter: true,
};

const ROUTE_CONFIGS: Partial<Record<BankSlug, BankRouteConfig>> = {
  igcse: CORE_EXTENDED,
  "igcse-biology-0610": CORE_EXTENDED,
  "igcse-chemistry-0620": CORE_EXTENDED,
  "igcse-physics-0625": CORE_EXTENDED,
  "igcse-coordinated-sciences-0654": CORE_EXTENDED,
  [A_LEVEL_MATHS_9709]: MATHS_9709_TABS,
  [A_LEVEL_PHYSICS_9702]: PHYSICS_9702_TABS,
  [A_LEVEL_CHEMISTRY_9701]: CHEMISTRY_9701_TABS,
  [A_LEVEL_BIOLOGY_9700]: BIOLOGY_9700_TABS,
  [A_LEVEL_ECONOMICS_9708]: ECONOMICS_9708_TABS,
  [A_LEVEL_COMPUTER_SCIENCE_9618]: COMPUTER_SCIENCE_9618_TABS,
};

export function routeConfigFor(bank: string | undefined): BankRouteConfig | undefined {
  return bank ? ROUTE_CONFIGS[bank as BankSlug] : undefined;
}

export function supportsCourseRoute(bank: string | undefined): boolean {
  return Boolean(routeConfigFor(bank));
}

/** The route option for a paper: its own id, "both" when several routes share it, "" when none. */
export function deriveCourseRoute(bank: string, paper: number): CourseRoute {
  const config = routeConfigFor(bank);
  if (!config) return "";
  const routes = config.options.filter((option) => option.papers.includes(paper));
  return routes.length === 1 ? routes[0].id : routes.length > 1 ? "both" : "";
}

export function matchesCourseRoute(route: CourseRoute | undefined, selection: CourseRouteSelection): boolean {
  return selection === "all" || route === selection || route === "both";
}

/** A valid selection for this bank, or undefined. */
export function parseRouteSelection(bank: string | undefined, value: string | null | undefined): CourseRouteSelection | undefined {
  const config = routeConfigFor(bank);
  if (!config || !value) return undefined;
  return value === "all" || config.options.some((option) => option.id === value) ? value : undefined;
}

export function defaultRouteSelection(bank: string | undefined): CourseRouteSelection {
  return routeConfigFor(bank)?.defaultSelection ?? "all";
}

export function routeOption(bank: string | undefined, selection: CourseRouteSelection): RouteOption | undefined {
  return routeConfigFor(bank)?.options.find((option) => option.id === selection);
}

/** Label for a single resolved route ("Core", "Pure 3"); "" for all/shared. */
export function routeLabel(bank: string | undefined, route: CourseRoute): string {
  return routeOption(bank, route)?.label ?? "";
}

/** The papers a selection allows; undefined means every paper. */
export function routePapers(bank: string | undefined, selection: CourseRouteSelection): readonly number[] | undefined {
  return selection === "all" ? undefined : routeOption(bank, selection)?.papers;
}

const routeStorageKey = (bank: string) => `ppp-route:${bank}`;

/** The browser's remembered choice for banks that remember one. Safe on the server and in private mode. */
export function readRememberedRoute(bank: string | undefined): CourseRouteSelection | undefined {
  if (!bank || !routeConfigFor(bank)?.remember || typeof window === "undefined") return undefined;
  try { return parseRouteSelection(bank, window.localStorage.getItem(routeStorageKey(bank))); } catch { return undefined; }
}

export function rememberRoute(bank: string | undefined, selection: CourseRouteSelection): void {
  if (!bank || !routeConfigFor(bank)?.remember || typeof window === "undefined") return;
  try { window.localStorage.setItem(routeStorageKey(bank), selection); } catch { /* private mode */ }
}
