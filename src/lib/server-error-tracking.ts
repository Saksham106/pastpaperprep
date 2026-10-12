import "server-only";
import { after } from "next/server";
import { PostHog } from "posthog-node";
import { safeErrorMessage, scrubStack } from "@/lib/error-privacy";
import { BANK_CATALOG } from "@/lib/catalog";
import { safeServerErrorCode } from "@/lib/safe-server-error-code";
import { serverLog } from "@/lib/server-logs";

const AUTH_PHASES = new Set(["signup_result", "magic_link_result", "resend_result", "password_signin_result", "confirmation_result"]);
const ENUMS: Record<string, Set<string>> = {
  router_kind: new Set(["App Router", "Pages Router"]),
  route_type: new Set(["render", "route", "action", "middleware"]),
  auth_phase: AUTH_PHASES,
  provider_code: new Set(["unexpected_failure", "smtp_error"]),
  error_source: new Set(["handled_response", "auth_provider"]),
  stage: new Set(["manifest", "signing", "entitlement", "quota", "response"]),
  storage_provider: new Set(["local", "supabase", "r2", "unknown"]),
  bank: new Set(BANK_CATALOG.map((bank) => bank.slug)),
};
function safeMetadata(metadata: Record<string, unknown>) {
  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value !== "string" || value.length > 80) continue;
    if (Object.prototype.hasOwnProperty.call(ENUMS, key) && ENUMS[key].has(value)
      || key === "error_code" && safeServerErrorCode(value)
      || key === "http_status" && /^5\d{2}$/.test(value)
      || key === "route" && /^\/[A-Za-z0-9_\-/[\].()]*$/.test(value)
      // Next's render digest also reaches the browser error boundary, which links the two reports.
      || key === "digest" && /^[A-Za-z0-9_-]{1,40}$/.test(value) && !value.startsWith("NEXT_")
      || key === "correlation_id" && UUID.test(value)) properties[key] = value;
  }
  return properties;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
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
  const safe = new Error(safeErrorMessage(error.message) ?? "Application server exception");
  safe.name = /^[A-Za-z]+Error$/.test(error.name) && error.name.length <= 40 ? error.name : "Error";
  safe.stack = scrubStack(error.stack, safe.name)?.replace(": Application exception", ": Application server exception");
  return safe;
}

/** Reports a scrubbed server exception and returns its correlation id (also logged and sent to PostHog). */
export function captureServerException(error: unknown, metadata: Record<string, unknown> = {}): string | undefined {
  const safe = sanitizeError(error);
  const posthog = getClient();
  if (!safe) return undefined;
  const properties = safeMetadata(metadata);
  // Preview deploys share the PostHog project; tag the environment so their failures stay separable.
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production" || vercelEnv === "preview" || vercelEnv === "development") properties.vercel_env = vercelEnv;
  const environment = typeof properties.vercel_env === "string" ? properties.vercel_env : process.env.NODE_ENV === "production" ? "production" : process.env.NODE_ENV === "test" ? "test" : "development";
  properties.signal_kind = "server";
  properties.correlation_id ??= globalThis.crypto.randomUUID();
  const correlationId = properties.correlation_id as string;
  properties.$process_person_profile = false;
  // Public SDK additionalProperties supports these documented ingestion properties.
  // Exclude the occurrence ID (and release) so a new occurrence/deploy does not split an issue.
  const group = [environment, properties.route ?? "unknown", properties.error_source ?? "request", properties.auth_phase ?? "", properties.stage ?? "", properties.bank ?? "", properties.storage_provider ?? "", properties.error_code ?? properties.provider_code ?? safe.name];
  // Unknown failures retain the SDK's scrubbed-frame grouping, rather than merging
  // every unrelated render exception on the same route into one generic issue.
  // Unclassified ones keep PostHog's own title too, which now shows the scrubbed message.
  if (properties.error_code || properties.provider_code) {
    properties.$exception_fingerprint = `server:v1:${JSON.stringify(group)}`;
    properties.$issue_name = `Server ${properties.route ?? "unknown"} ${properties.stage ?? properties.auth_phase ?? "request"}: ${properties.error_code ?? properties.provider_code}`;
  }
  try { console.error("server_exception", properties); } catch { /* Logging is best effort too. */ }
  serverLog("error", "server_exception", {
    message: safe.message, error_name: safe.name,
    ...Object.fromEntries(Object.entries(properties).filter(([key, value]) => !key.startsWith("$") && typeof value === "string")) as Record<string, string>,
  });
  if (!posthog) return correlationId;
  try {
    after(async () => {
      try { await posthog.captureExceptionImmediate(safe, `server:pastpaperprep:${environment}`, { ...properties, $process_person_profile: false }); }
      catch { /* Provider outages must not affect authentication or request handling. */ }
    });
  } catch { /* Request telemetry is best effort. */ }
  return correlationId;
}

export function captureAuthProviderFailure(phase: string, providerCode: string) {
  if (!AUTH_PHASES.has(phase) || !PROVIDER_FAILURE_CODES.has(providerCode)) return;
  captureServerException(new Error("Authentication provider failure"), {
    error_source: "auth_provider", auth_phase: phase, provider_code: providerCode,
  });
}
