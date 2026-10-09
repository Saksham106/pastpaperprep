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
