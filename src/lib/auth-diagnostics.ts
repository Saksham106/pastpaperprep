import "server-only";
import { randomUUID } from "node:crypto";

const PHASES = ["signup_requested", "signup_result", "magic_link_requested", "magic_link_result", "resend_requested", "resend_result", "email_link_rendered", "confirmation_requested", "confirmation_result", "password_signin_requested", "password_signin_result"] as const;
const OUTCOMES = ["accepted", "rejected", "verified"] as const;
const PROVIDER_CODES = new Set([
  "otp_expired", "over_email_send_rate_limit", "over_request_rate_limit", "email_not_confirmed",
  "invalid_credentials", "email_address_invalid", "weak_password", "user_already_exists",
  "unexpected_failure", "request_timeout", "validation_failed", "smtp_error",
]);

type AuthDiagnostic = {
  attemptId: string;
  phase: typeof PHASES[number];
  outcome?: typeof OUTCOMES[number];
  providerCode?: string;
};

export function createAuthAttemptId(): string {
  return randomUUID();
}

export function validAuthAttemptId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// Operational correlation only: never authentication, authorization, or account identity.
export function logAuthDiagnostic(input: AuthDiagnostic): void {
  if (!validAuthAttemptId(input.attemptId) || !PHASES.includes(input.phase)) return;
  const record: AuthDiagnostic & { event: "auth_flow" } = {
    event: "auth_flow", attemptId: input.attemptId, phase: input.phase,
  };
  if (input.outcome && OUTCOMES.includes(input.outcome)) record.outcome = input.outcome;
  if (input.providerCode !== undefined) {
    record.providerCode = PROVIDER_CODES.has(input.providerCode) ? input.providerCode : "unknown";
  }
  const logger = input.providerCode === "unexpected_failure" || input.providerCode === "smtp_error" || record.providerCode === "unknown"
    ? console.error
    : input.outcome === "rejected" ? console.warn : console.info;
  try {
    logger(record);
  } catch {
    // Diagnostics must never break sign-up, confirmation, or a redirect.
  }
}
