import "server-only";
import { after } from "next/server";
import { PostHog } from "posthog-node";
import { scrubStack } from "@/lib/error-privacy";

const AUTH_PHASES = new Set(["signup_result", "magic_link_result", "resend_result", "password_signin_result", "confirmation_result"]);
const SAFE_PROPERTY_KEYS = new Set(["router_kind", "route_type", "route", "auth_phase", "provider_code", "error_source"]);
const PROVIDER_FAILURE_CODES = new Set(["unexpected_failure", "smtp_error"]);
let client: PostHog | null = null;

function getClient() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return null;
  try { return client ??= new PostHog(token, { host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com", flushAt: 1, flushInterval: 0, disableGeoip: true }); }
  catch { return null; }
}

function sanitizeError(error: unknown): Error | null {
  if (!(error instanceof Error)) return null;
  const safe = new Error("Application server exception");
  safe.name = /^[A-Za-z]+Error$/.test(error.name) && error.name.length <= 40 ? error.name : "Error";
  safe.stack = scrubStack(error.stack, safe.name)?.replace(": Application exception", ": Application server exception");
  return safe;
}

export function captureServerException(error: unknown, metadata: Record<string, unknown> = {}) {
  const safe = sanitizeError(error);
  const posthog = getClient();
  if (!safe || !posthog) return;
  const properties = Object.fromEntries(Object.entries(metadata).filter(([key, value]) => SAFE_PROPERTY_KEYS.has(key) && typeof value === "string" && value.length <= 80));
  try {
    after(async () => {
      try { await posthog.captureExceptionImmediate(safe, `server:${globalThis.crypto.randomUUID()}`, { ...properties, $process_person_profile: false }); }
      catch { /* Provider outages must not affect authentication or request handling. */ }
    });
  } catch { /* Request telemetry is best effort. */ }
}

export function captureAuthProviderFailure(phase: string, providerCode: string) {
  if (!AUTH_PHASES.has(phase) || !PROVIDER_FAILURE_CODES.has(providerCode)) return;
  captureServerException(new Error("Authentication provider failure"), {
    error_source: "auth_provider", auth_phase: phase, provider_code: providerCode,
  });
}
