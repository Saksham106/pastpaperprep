import "server-only";
import { after } from "next/server";

export type LogLevel = "info" | "warn" | "error";
export type LogAttributes = Record<string, string | number | boolean | undefined>;
type OtlpValue = { stringValue: string } | { intValue: number } | { doubleValue: number } | { boolValue: boolean };
type LogRecord = { timeUnixNano: string; severityNumber: number; severityText: string; body: { stringValue: string }; attributes: { key: string; value: OtlpValue }[] };

const SEVERITY: Record<LogLevel, number> = { info: 9, warn: 13, error: 17 };
const KEY = /^[a-z][a-z0-9_.]{0,39}$/;
const MAX_PENDING = 500;
let pending: LogRecord[] = [];
let flushScheduled = false;

function enabled() {
  const environment = process.env.VERCEL_ENV;
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) && (environment === "production" || environment === "preview");
}

function otlpValue(value: string | number | boolean): OtlpValue {
  if (typeof value === "boolean") return { boolValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { intValue: value } : { doubleValue: value };
  return { stringValue: value.slice(0, 200) };
}

/**
 * One structured log line in PostHog Logs (OTLP, 14-day retention), because Vercel Hobby keeps
 * runtime logs for about an hour. Callers pass code-controlled values only: route patterns,
 * enumerated outcomes, counts and durations, never request data or personal details.
 * Records are batched and posted after the response, so logging never delays a request.
 */
export function serverLog(level: LogLevel, event: string, attributes: LogAttributes = {}) {
  if (!enabled()) return;
  const record: LogRecord = {
    timeUnixNano: `${Date.now()}000000`,
    severityNumber: SEVERITY[level],
    severityText: level.toUpperCase(),
    body: { stringValue: event.slice(0, 80) },
    attributes: Object.entries(attributes).flatMap(([key, value]) => (
      value === undefined || !KEY.test(key) || (typeof value === "number" && !Number.isFinite(value)) ? [] : [{ key, value: otlpValue(value) }]
    )),
  };
  if (pending.length >= MAX_PENDING) pending.shift();
  pending.push(record);
  if (flushScheduled) return;
  flushScheduled = true;
  try { after(flushServerLogs); }
  catch { void flushServerLogs(); } // Outside a request scope: send straight away.
}

export async function flushServerLogs() {
  flushScheduled = false;
  const logRecords = pending;
  pending = [];
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!logRecords.length || !token) return;
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com").replace(/\/$/, "");
  const resource = [
    { key: "service.name", value: { stringValue: "pastpaperprep" } },
    { key: "deployment.environment", value: { stringValue: process.env.VERCEL_ENV ?? "unknown" } },
    ...(process.env.VERCEL_GIT_COMMIT_SHA ? [{ key: "service.version", value: { stringValue: process.env.VERCEL_GIT_COMMIT_SHA } }] : []),
  ];
  try {
    await fetch(`${host}/i/v1/logs`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ resourceLogs: [{ resource: { attributes: resource }, scopeLogs: [{ scope: { name: "pastpaperprep" }, logRecords }] }] }),
    });
  } catch { /* Logs are best effort; a PostHog outage must never affect a request. */ }
}
