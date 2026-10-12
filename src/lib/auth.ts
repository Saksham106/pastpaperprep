const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 72;
const DEFAULT_NEXT_PATH = "/pricing";

export type MagicLinkState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialMagicLinkState: MagicLinkState = {
  status: "idle",
  message: "",
};

export function isValidEmail(value: string) {
  const email = value.trim();
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email);
}

// Supabase issues 8-digit email codes (mailer_otp_length); accept 6-10 so a length change can't lock people out.
export function normalizeEmailCode(value: string) {
  return value.replace(/[\s-]/g, "");
}

export function isValidEmailCode(value: string) {
  return /^\d{6,10}$/.test(value);
}

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "aol.com",
  "proton.me", "protonmail.com", "qq.com", "163.com", "126.com", "naver.com", "gmx.com", "mail.ru", "yandex.com",
]);

// School and work inboxes (usually Microsoft 365) often quarantine mail from new senders before it reaches junk.
export function isLikelyOrganizationEmail(email: string) {
  const domain = email.trim().toLowerCase().split("@")[1];
  return Boolean(domain) && !PERSONAL_EMAIL_DOMAINS.has(domain);
}

export function isValidPassword(value: string) {
  return value.length >= MIN_PASSWORD_LENGTH && value.length <= MAX_PASSWORD_LENGTH;
}

const NEXT_PATH_PROBE_ORIGIN = "https://next-path.invalid";

export function safeNextPath(value: string | null | undefined) {
  // URL parsing silently drops tab/CR/LF, so "/\t/evil.example" would become //evil.example.
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return DEFAULT_NEXT_PATH;
  }
  if (new URL(value, NEXT_PATH_PROBE_ORIGIN).origin !== NEXT_PATH_PROBE_ORIGIN) {
    return DEFAULT_NEXT_PATH;
  }

  return value;
}
