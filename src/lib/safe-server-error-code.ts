// Only explicit operational identifiers may cross the server telemetry boundary.
const CODES = new Set([
  "PGRST301", "PGRST302", "PGRST303", "refresh_token_already_used", "refresh_token_not_found",
  "unexpected_failure", "smtp_error", "manifest_unavailable", "signing_failed",
  "entitlement_unavailable", "quota_unavailable", "response_failed",
]);
export function safeServerErrorCode(value: unknown): string | undefined {
  return typeof value === "string" && CODES.has(value) ? value : undefined;
}
