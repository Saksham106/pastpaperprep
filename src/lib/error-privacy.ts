const MAX_FRAMES = 50;
const MAX_FRAME_CHARS = 500;
const MAX_STACK_CHARS = 12_000;
const APP_DIRS = new Set(["app", "account", "api", "articles", "auth", "banks", "billing", "callback", "checkout", "confirm", "dashboard", "email-link", "exam-style", "invite", "lifetime", "password", "pricing", "privacy", "r", "recovery", "referrals", "security", "subscription", "worksheets", "build"]);
const CLIENT_FILE = /^[A-Za-z0-9_-]{1,80}\.m?js$/;

export function safeGeneratedPath(pathname: string): string | null {
  if (!pathname.startsWith("/_next/static/chunks/") || pathname.length > 300 || /[%\\?#@]/.test(pathname)) return null;
  const parts = pathname.slice("/_next/static/chunks/".length).split("/");
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
      if (typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value)) safe[key] = value;
    }
    if (typeof frame.function === "string") safe.function = safeFunction(frame.function);
    return [safe as T];
  });
}
