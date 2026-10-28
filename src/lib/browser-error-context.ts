/**
 * Page and browser state attached to every browser exception, to tell our bugs apart from
 * translation, extensions, flaky networks and stale tabs. Booleans, counts and fixed
 * vocabularies only: never page text, attribute or element names, or URLs.
 */
export type BrowserErrorContext = {
  page_translated: boolean;
  page_lang: string;
  foreign_elements: number;
  foreign_root_attributes: number;
  page_age_s: number;
  visibility?: string;
  ready_state?: string;
  online?: boolean;
  connection?: string;
  save_data?: boolean;
  release?: string;
};

// What our layout, next-themes and scroll locks put on <html> and <body>; anything else came from outside.
const OWN_ROOT_ATTRIBUTES = new Set(["lang", "class", "style", "data-theme", "data-session", "data-build-revision"]);
// Custom elements Next renders itself.
const OWN_ELEMENTS = new Set(["NEXT-ROUTE-ANNOUNCER", "NEXTJS-PORTAL"]);
const MAX_FOREIGN_ELEMENTS = 50;
const MAX_PAGE_AGE_S = 86_400;
const VISIBILITY = new Set(["visible", "hidden", "prerender"]);
const READY_STATES = new Set(["loading", "interactive", "complete"]);
const CONNECTIONS = new Set(["slow-2g", "2g", "3g", "4g"]);

function pageLanguage(lang: string): string {
  const primary = lang.trim().toLowerCase().split("-")[0];
  if (!primary) return "none";
  return /^[a-z]{2,3}$/.test(primary) ? primary : "other";
}

function foreignElements(doc: Document): number {
  let count = 0;
  for (const element of doc.body?.querySelectorAll("*") ?? []) {
    if (element.tagName.includes("-") && !OWN_ELEMENTS.has(element.tagName)) count += 1;
    if (count >= MAX_FOREIGN_ELEMENTS) break;
  }
  return count;
}

function foreignRootAttributes(doc: Document): number {
  return [doc.documentElement, doc.body]
    .flatMap(element => element?.getAttributeNames() ?? [])
    .filter(name => !OWN_ROOT_ATTRIBUTES.has(name)).length;
}

export function browserErrorContext(doc: Document, win: Window): BrowserErrorContext {
  const root = doc.documentElement;
  const page_lang = pageLanguage(root.getAttribute("lang") ?? "");
  // Chrome and Edge mark a translated page with a class; other translators rewrite <html lang>.
  const page_translated = root.classList.contains("translated-ltr") || root.classList.contains("translated-rtl") || (page_lang !== "en" && page_lang !== "none");
  const navigator = win.navigator as Navigator & { connection?: { effectiveType?: unknown; saveData?: unknown } };
  const connection = navigator?.connection;
  const release = process.env.NEXT_PUBLIC_BUILD_REVISION;
  return {
    page_translated,
    page_lang,
    foreign_elements: foreignElements(doc),
    foreign_root_attributes: foreignRootAttributes(doc),
    page_age_s: Math.min(MAX_PAGE_AGE_S, Math.max(0, Math.round((win.performance?.now() ?? 0) / 1000))),
    ...(VISIBILITY.has(doc.visibilityState) ? { visibility: doc.visibilityState } : {}),
    ...(READY_STATES.has(doc.readyState) ? { ready_state: doc.readyState } : {}),
    ...(typeof navigator?.onLine === "boolean" ? { online: navigator.onLine } : {}),
    ...(typeof connection?.effectiveType === "string" && CONNECTIONS.has(connection.effectiveType) ? { connection: connection.effectiveType } : {}),
    ...(typeof connection?.saveData === "boolean" ? { save_data: connection.saveData } : {}),
    ...(typeof release === "string" && /^[0-9a-f]{7,40}$/.test(release) ? { release: release.slice(0, 12) } : {}),
  };
}

/** React #418's first argument says whether text or an element differed. Later arguments can carry page text and are never read. */
export function reactMismatchKind(message: string): "text" | "html" | undefined {
  const kind = message.match(/react\.dev\/errors\/418\?args(?:\[\]|%5B%5D)=(text|HTML)(?:&|\s|$)/)?.[1];
  return kind === "text" ? "text" : kind === "HTML" ? "html" : undefined;
}
