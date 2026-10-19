const MAX_FRAMES = 50;
const MAX_FRAME_CHARS = 500;
const MAX_STACK_CHARS = 12_000;
const APP_DIRS = new Set(["app", "account", "api", "articles", "auth", "banks", "billing", "callback", "checkout", "confirm", "dashboard", "email-link", "exam-style", "invite", "lifetime", "password", "pricing", "privacy", "r", "recovery", "referrals", "security", "subscription", "worksheets", "build"]);
const CLIENT_FILE = /^[A-Za-z0-9_-]{1,80}\.m?js$/;

export function safeGeneratedPath(pathname: string): string | null {
  const prefix = pathname.startsWith("/_next/static/immutable/chunks/") ? "/_next/static/immutable/chunks/" : "/_next/static/chunks/";
  if (!pathname.startsWith(prefix) || pathname.length > 300 || /[%\\?#@]/.test(pathname)) return null;
  const parts = pathname.slice(prefix.length).split("/");
  const filename = parts.pop()!;
  if (!CLIENT_FILE.test(filename)) return null;
  if (parts.length && (parts[0] !== "app" || parts.length > 6 || !parts.every(part => APP_DIRS.has(part)))) return null;
  return pathname;
}

function safeServerPath(pathname: string): string | null {
  const prefix = "/var/task/.next/server/";
  if (!pathname.startsWith(prefix) || pathname.length > 350 || /[%\\?#@]/.test(pathname)) return null;
  const parts = pathname.slice(prefix.length).split("/");
  const filename = parts.pop()!;
  if (parts[0] === "chunks" && (parts.length === 1 || (parts.length === 2 && parts[1] === "ssr"))) {
    return /^(?:_[0-9a-z_-]{7,32}|\[(?:root-of-the-server|externals)\]__[0-9a-z_-]{7,32})\._\.js$/.test(filename) || /^_next-internal_server_app_[A-Za-z0-9_\[\]-]{1,140}_actions_[0-9a-z_-]{7,32}\.js$/.test(filename) ? pathname : null;
  }
  if (parts[0] === "app" && parts.length <= 7 && parts.every(part => APP_DIRS.has(part)) && /^(?:page|route|layout|error|global-error)\.js$/.test(filename)) return pathname;
  return null;
}

function scrubLocation(raw: string): string | null {
  if (raw.length > 2048) return null;
  const position = raw.match(/:\d{1,8}(?::\d{1,8})?$/)?.[0] ?? "";
  const source = position ? raw.slice(0, -position.length) : raw;
  if (source.startsWith("/var/task/")) { const path = safeServerPath(source); return path ? path + position : null; }
  try {
    const url = new URL(source);
    if (url.username || url.password) return null;
    if (url.protocol === "file:") { const path = safeServerPath(url.pathname); return path ? `file://${path}${position}` : null; }
    if (!/^https?:$/.test(url.protocol)) return null;
    const path = safeGeneratedPath(url.pathname);
    return path ? `${url.origin}${path}${position}` : null;
  } catch { return null; }
}

function safeFunction(value: string): string {
  return /^[A-Za-z0-9_$.[\]<>-]{1,120}$/.test(value) ? value : "anonymous";
}

const EXTENSION_URL = String.raw`(?:chrome|moz|safari-web|ms-browser)-extension:\/\/[A-Za-z0-9._~\/-]+:\d{1,8}:\d{1,8}`;
// One whole line, one location, and nothing else: an eval origin, second URL or unparsed text keeps the error reportable.
const EXTENSION_FRAMES = [
  new RegExp(String.raw`^at (?:(?:async |new )?[A-Za-z0-9_$.<>\[\]-]{1,120} \()?${EXTENSION_URL}\)?$`),
  new RegExp(String.raw`^[A-Za-z0-9_$.<>\/-]{0,120}@${EXTENSION_URL}$`),
];

/**
 * True only when every line after the error's own header is a recognised frame in a browser extension.
 * Anything ambiguous (app frames, eval origins, unparsed lines, an over-long stack) returns false, so it is still reported.
 */
export function isBrowserExtensionError(error: unknown): boolean {
  if (!(error instanceof Error) || typeof error.stack !== "string" || error.stack.length > MAX_STACK_CHARS) return false;
  const lines = error.stack.split("\n").map(line => line.trim()).filter(Boolean);
  const header = `${error.name}: ${error.message}`.split("\n")[0];
  if (lines[0] === header || lines[0] === error.name) lines.shift();
  return lines.length > 0 && lines.every(line => EXTENSION_FRAMES.some(frame => frame.test(line)));
}

export function scrubStack(stack: string | undefined, fallbackName: string): string | undefined {
  if (!stack) return undefined;
  const result = [`${fallbackName}: Application exception`];
  for (const line of stack.slice(0, MAX_STACK_CHARS * 2).split("\n").slice(0, MAX_FRAMES + 1)) {
    if (line.length > 2048) continue;
    const chrome = line.match(/^\s*at\s+(?:(.*?)\s+\()?((?:https?:\/\/|file:\/\/|\/var\/task\/)[^\s)]+)\)?$/);
    const safari = line.match(/^(.*?)@((?:https?:\/\/|file:\/\/)[^\s]+)$/);
    const match = chrome ?? safari;
    if (!match) continue;
    const location = scrubLocation(match[2]);
    if (!location) continue;
    const frame = chrome ? `    at ${safeFunction(match[1] || "anonymous")} (${location})` : `${safeFunction(match[1] || "anonymous")}@${location}`;
    if (frame.length <= MAX_FRAME_CHARS) result.push(frame);
    if (result.join("\n").length >= MAX_STACK_CHARS) break;
  }
  return result.join("\n").slice(0, MAX_STACK_CHARS);
}

const ERROR_NAMES = new Set(["Error", "TypeError", "ReferenceError", "RangeError", "SyntaxError", "URIError", "EvalError", "AggregateError", "AbortError", "TimeoutError", "NetworkError", "SecurityError", "NotAllowedError", "NotFoundError", "UnhandledRejection", "ChunkLoadError", "AuthApiError", "AuthRetryableFetchError"]);

export function safeErrorName(name: unknown): string {
  return typeof name === "string" && ERROR_NAMES.has(name) ? name : "Error";
}

// Only these code-controlled words can appear inside a readable diagnostic.
// A quoted identifier's shape alone says nothing about whether it contains private data.
const DIAGNOSTIC_WORDS = new Set(["rows", "questionAssetPaths", "cooldown"]);
const DIAGNOSTIC_MESSAGES = new Set([
  "Application exception", "Application server exception", "Authentication provider failure",
  "Handled server failure", "Non-error promise rejection", "Failed to fetch", "fetch failed",
  "Load failed", "NetworkError when attempting to fetch resource.", "JWT issued at future",
  "Unexpected end of JSON input", "Invalid JSON input", "Database key already exists",
  "Database unique constraint violation", "No such customer", "Value is not a function",
]);
const REACT_ERROR = /^(?:Minified React error #|React error #)(\d{1,4})(?:\D|$)/;

/**
 * Returns a fixed diagnostic or a normalized template, never a regex-masked arbitrary
 * message. Unknown text is omitted so each caller uses its existing generic fallback.
 * The result is idempotent: SDK before_send can apply this boundary a second time.
 */
export function safeErrorMessage(message: unknown): string | undefined {
  if (typeof message !== "string") return undefined;
  const text = message.slice(0, 2000).split("\n")[0].trim();
  if (!text) return undefined;
  if (DIAGNOSTIC_MESSAGES.has(text)) return text;
  const react = text.match(REACT_ERROR);
  if (react) return `React error #${react[1]}`;
  const property = text.match(/^Cannot (read|set) properties of (undefined|null)(?: \((?:reading|setting) ['"]([^'"\r\n]*)['"]\))?$/);
  if (property) {
    const operation = property[1] === "read" ? "reading" : "setting";
    const key = DIAGNOSTIC_WORDS.has(property[3]) ? property[3] : "<property>";
    return `Cannot ${property[1]} properties of ${property[2]}${property[3] === undefined ? "" : ` (${operation} '${key}')`}`;
  }
  const reference = text.match(/^([A-Za-z_$][\w$]*|<identifier>) is not defined$/);
  if (reference) return `${DIAGNOSTIC_WORDS.has(reference[1]) ? reference[1] : "<identifier>"} is not defined`;
  if (/^.+ is not a function$/.test(text)) return "Value is not a function";
  if (/^Unexpected token .+ is not valid JSON$/.test(text)
    || /^Expected (?:property name|','|':'|double-quoted property name).+ in JSON at position /.test(text)) return "Invalid JSON input";
  if (/^Key \([^)]*\)=\([^)]*\) already exists\.?$/.test(text)) return "Database key already exists";
  if (/^duplicate key value violates unique constraint /.test(text)) return "Database unique constraint violation";
  if (/^No such customer: /.test(text)) return "No such customer";
  // Turbopack's script loader: keep only a generated chunk path; the module id and the browser's cause text are dropped.
  const chunk = text.match(/^Failed to load chunk (\S+)(?: (?:from module|as a runtime dependency of chunk|from an HMR update)\b.*)?$/);
  if (chunk) {
    let path: string | null = null;
    try { path = safeGeneratedPath(new URL(chunk[1], "https://pastpaperprep.com").pathname); } catch { /* not a URL */ }
    return `Failed to load chunk ${path ?? "<chunk>"}`;
  }
  return undefined;
}

export function boundExceptionFrames<T extends Record<string, unknown>>(frames: T[]): T[] {
  return frames.slice(0, MAX_FRAMES).flatMap(frame => {
    if (typeof frame.filename !== "string") return [];
    const filename = scrubLocation(frame.filename);
    if (!filename) return [];
    const safe: Record<string, unknown> = { filename };
    for (const key of ["lineno", "colno", "in_app", "platform", "chunk_id"] as const) {
      const value = frame[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100_000_000) safe[key] = value;
      if (typeof value === "boolean") safe[key] = value;
      // Colon allowed: posthog-js sends platform "web:javascript", and PostHog rejects frames without it.
      if (typeof value === "string" && /^[A-Za-z0-9_:-]{1,80}$/.test(value)) safe[key] = value;
    }
    if (typeof frame.function === "string") safe.function = safeFunction(frame.function);
    return [safe as T];
  });
}
