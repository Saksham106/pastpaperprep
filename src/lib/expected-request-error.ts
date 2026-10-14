const PROGRAMMING_ERRORS = new Set(["TypeError", "ReferenceError", "RangeError", "SyntaxError", "URIError", "EvalError"]);
const EXPECTED_AUTH_CODES = new Set(["invalid_credentials", "over_request_rate_limit", "over_email_send_rate_limit", "over_sms_send_rate_limit"]);
const EXPECTED_MESSAGES = new Set(["invalid credentials", "invalid login credentials", "rate limit exceeded", "too many requests", "cooldown"]);

/** Framework markers or explicit auth/limit outcomes, never a keyword inside a crash. */
export function isExpectedRequestError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { digest?: unknown; name?: unknown; code?: unknown; message?: unknown };
  const digest = typeof value.digest === "string" ? value.digest : "";
  if (/^NEXT_REDIRECT(?:;|$)/.test(digest) || /^NEXT_NOT_FOUND(?:;|$)/.test(digest)
    || /^NEXT_HTTP_ERROR_FALLBACK;(?:401|403|404)$/.test(digest)) return true;
  if (typeof value.name === "string" && PROGRAMMING_ERRORS.has(value.name)) return false;
  if (typeof value.code === "string" && EXPECTED_AUTH_CODES.has(value.code)) return true;
  return typeof value.message === "string" && value.message.length <= 80
    && EXPECTED_MESSAGES.has(value.message.trim().toLowerCase());
}
