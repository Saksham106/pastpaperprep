import "server-only";

/**
 * Transactional email through Resend's HTTP API (the provider already behind Supabase's auth
 * mail). No SDK: one fetch with a timeout and an idempotency key, so a retried send within
 * Resend's 24-hour window never delivers twice.
 */

export type EmailMessage = { to: string; subject: string; text: string; html: string; idempotencyKey: string };
export type EmailResult = { ok: true } | { ok: false; retryable: boolean };

const RESEND_URL = "https://api.resend.com/emails";
const FROM = /^[^\r\n<>]{0,80}<[^\s@<>]+@pastpaperprep\.com>$|^[^\s@<>]+@pastpaperprep\.com$/;

export function transactionalEmailConfig(env: Record<string, string | undefined> = process.env) {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.ACCESS_END_REMINDER_FROM?.trim();
  if (!apiKey || !apiKey.startsWith("re_") || !from || !FROM.test(from)) return null;
  return { apiKey, from };
}

export async function sendTransactionalEmail(
  message: EmailMessage,
  config: { apiKey: string; from: string },
  fetchImpl: typeof fetch = fetch,
): Promise<EmailResult> {
  if (!message.to.includes("@") || /[\r\n]/.test(message.to) || /[\r\n]/.test(message.subject)) return { ok: false, retryable: false };
  try {
    const response = await fetchImpl(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({ from: config.from, to: [message.to], subject: message.subject, text: message.text, html: message.html, reply_to: "hello@pastpaperprep.com" }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return { ok: true };
    // 429 and 5xx may succeed later; any other 4xx (bad address, rejected key) won't.
    return { ok: false, retryable: response.status === 429 || response.status >= 500 };
  } catch {
    // Timeout or network error: the email may have gone out. Retrying with the same key is safe.
    return { ok: false, retryable: true };
  }
}
