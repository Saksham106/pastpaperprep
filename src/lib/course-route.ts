import type { BankSlug } from "@/lib/banks";

export type CourseRoute = "core" | "extended" | "both" | "";
export type CourseRouteSelection = "all" | "core" | "extended";

const ROUTED_BANKS = new Set<BankSlug>([
  "igcse",
  "igcse-biology-0610",
  "igcse-chemistry-0620",
  "igcse-physics-0625",
  "igcse-coordinated-sciences-0654",
]);

export function supportsCourseRoute(bank: BankSlug | undefined): boolean {
  return Boolean(bank && ROUTED_BANKS.has(bank));
}

export function deriveCourseRoute(bank: BankSlug, paper: number): CourseRoute {
  if (!supportsCourseRoute(bank)) return "";
  if (paper === 1 || paper === 3) return "core";
  if (paper === 2 || paper === 4) return "extended";
  if (paper === 5 || paper === 6) return "both";
  return "";
}

export function matchesCourseRoute(route: CourseRoute | undefined, selection: CourseRouteSelection): boolean {
  return selection === "all" || route === selection || route === "both";
}
