// Browser-safe: which pages the site helper may open. The server checks every path it sends and the browser checks it
// again before navigating, so a path can never come from the model's own text.

/** First path segments the helper may open. Account, billing, auth and API routes are deliberately absent. */
export const HELPER_OPENABLE_SECTIONS = [
  "banks", "past-papers", "revision-notes", "worksheets", "dashboard", "pricing", "syllabus", "grade-thresholds",
  "articles", "cambridge-igcse", "cambridge-a-level", "ib", "faq", "updates",
] as const;

const SECTIONS = new Set<string>(HELPER_OPENABLE_SECTIONS);
const MAX_PATH = 600;
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
