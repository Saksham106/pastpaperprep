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

export function safeNextPath(value: string | null | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return DEFAULT_NEXT_PATH;
  }

  return value;
}
