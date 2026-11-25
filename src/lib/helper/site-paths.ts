// Browser-safe: which pages the site helper may open. The server checks every path it sends and the browser checks it
// again before navigating, so a path can never come from the model's own text.

/** First path segments the helper may open. Account, billing, auth and API routes are deliberately absent. */
export const HELPER_OPENABLE_SECTIONS = [
  "banks", "past-papers", "revision-notes", "worksheets", "dashboard", "pricing", "syllabus", "grade-thresholds",
  "articles", "cambridge-igcse", "cambridge-a-level", "ib", "faq", "updates",
] as const;

const SECTIONS = new Set<string>(HELPER_OPENABLE_SECTIONS);
/** Long enough for a built practice set: the builder link lists up to 50 question ids. */
const MAX_PATH = 4000;
// Path segments and query: letters, digits and the URL-safe punctuation our routes use. No backslash, no fragment.
const SAFE = /^\/[A-Za-z0-9\-._~%/]*(?:\?[A-Za-z0-9\-._~%&=+]*)?$/;

/** The path itself when the helper may open it, else null. Home ("/") is allowed. */
export function safeHelperPath(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > MAX_PATH) return null;
  if (!SAFE.test(value) || value.startsWith("//") || value.includes("/../") || value.includes("/./")) return null;
  const pathname = value.split("?")[0];
  if (pathname === "/") return value;
  const section = pathname.split("/")[1];
  return SECTIONS.has(section) ? value : null;
}

/** A short, privacy-safe name for where the student is, for analytics ("bank", "paper", "home", ...). */
export function helperPageKind(pathname: string): string {
  const section = pathname.split("/")[1] ?? "";
  if (!section) return "home";
  if (section === "banks") return pathname.includes("/topics/") ? "topic" : "bank";
  if (section === "past-papers") return pathname.split("/").filter(Boolean).length > 2 ? "paper" : "papers";
  return SECTIONS.has(section) ? section : "other";
}

/** The only query parameters sent to Pepper as page context: the study filters a student has picked. */
const CONTEXT_PARAMS = ["topic", "subtopic", "year", "paper", "session", "route", "component", "option", "zone"] as const;

/**
 * What Pepper is told about the current page: the path plus chosen study filters only. Search words, worksheet ids,
 * shared-set ids, tracking and any other parameter are dropped, and saved-worksheet paths are reduced to their section.
 */
export function helperPageContext(pathname: string, search: string): string {
  const path = pathname.startsWith("/worksheets") ? "/worksheets" : /^\/[A-Za-z0-9\-._~%/]{0,300}$/.test(pathname) ? pathname : "/";
  const given = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of CONTEXT_PARAMS) for (const value of given.getAll(key).slice(0, 5)) if (value && value.length <= 100) kept.append(key, value);
  const query = kept.toString();
  return `${path}${query ? `?${query}` : ""}`.slice(0, 600);
}
