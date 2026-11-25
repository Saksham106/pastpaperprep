// Browser-safe: the site helper's stream, one JSON event per line, and the browser's reader for it.
import { HelperRequestError } from "@/lib/helper/client";
import type { HelperMode } from "@/lib/helper/config";
import type { HelperTurn } from "@/lib/helper/request";
import { safeHelperPath } from "@/lib/helper/site-paths";

export type SiteNavigationEvent = { type: "navigate"; kind: "bank" | "page" | "build"; path: string; label: string; bank?: string };
export type SiteHelperEvent =
  | { type: "text"; text: string }
  /** What Pepper is doing right now, shown while it works. */
  | { type: "step"; label: string }
  | SiteNavigationEvent
  /** remaining is absent when the rules answered without AI, so no helper message was used. */
  | { type: "done"; remaining?: number; limit?: number; rules?: boolean }
  | { type: "error"; message: string; status: number };

/** One line of the stream, or null for anything malformed or unsafe (a navigation to a path we don't allow). */
export function parseSiteEvent(line: string): SiteHelperEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const event = value as Record<string, unknown>;
  switch (event.type) {
    case "text":
      return typeof event.text === "string" ? { type: "text", text: event.text } : null;
    case "step":
      return typeof event.label === "string" && event.label.trim() ? { type: "step", label: event.label.trim().slice(0, 80) } : null;
    case "navigate": {
      const path = safeHelperPath(event.path);
      if (!path || (event.kind !== "bank" && event.kind !== "page" && event.kind !== "build")) return null;
      const label = typeof event.label === "string" && event.label.trim() ? event.label.trim().slice(0, 80) : "Page";
      return { type: "navigate", kind: event.kind, path, label, ...(typeof event.bank === "string" ? { bank: event.bank } : {}) };
    }
    case "done":
      return {
        type: "done",
        ...(typeof event.remaining === "number" ? { remaining: event.remaining } : {}),
        ...(typeof event.limit === "number" ? { limit: event.limit } : {}),
        ...(event.rules === true ? { rules: true } : {}),
      };
    case "error":
      return typeof event.message === "string" ? { type: "error", message: event.message, status: typeof event.status === "number" ? event.status : 0 } : null;
    default:
      return null;
  }
}

/** Sends one message and hands each event to onEvent as it arrives. Throws HelperRequestError for HTTP errors. */
export async function streamPepper(
  input: { messages: HelperTurn[]; page: string; question?: { bank: string; questionId: string }; mode?: HelperMode; image?: string },
  onEvent: (event: SiteHelperEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/helper", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok || !response.body) {
    let message = "The helper couldn't answer. Try again.";
    try {
      const body = await response.json() as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {
      // Keep the generic message.
    }
    throw new HelperRequestError(message, response.status);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const flush = (final: boolean) => {
    const lines = buffer.split("\n");
    buffer = final ? "" : lines.pop() ?? "";
    for (const line of lines) {
      const event = line.trim() ? parseSiteEvent(line) : null;
      if (event) onEvent(event);
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flush(false);
  }
  buffer += decoder.decode();
  flush(true);
}
