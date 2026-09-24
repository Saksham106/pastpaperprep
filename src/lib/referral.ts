export const REFERRAL_COOKIE = "ppp_referral";
export const REFERRAL_WINDOW_SECONDS = 30 * 24 * 60 * 60;

import { createHmac, timingSafeEqual } from "node:crypto";

const REFERRAL_SECRET = () => process.env.REFERRAL_COOKIE_SECRET ?? "";

export function encodeReferral(code: string, now = Date.now()): string | null {
  const secret = REFERRAL_SECRET();
  if (!secret) return null;
  const payload = `${code}.${now}`;
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function decodeReferral(value: string | undefined, now = Date.now()): { code: string; attributedAt: number } | null {
  const secret = REFERRAL_SECRET();
  if (!secret || !value) return null;
  const match = /^([a-z0-9_-]{2,40})\.(\d{10,})\.([A-Za-z0-9_-]+)$/.exec(value);
  if (!match) return null;
  const [, code, timeText, signature] = match;
  const attributedAt = Number(timeText);
  if (!Number.isSafeInteger(attributedAt) || attributedAt > now || now - attributedAt > REFERRAL_WINDOW_SECONDS * 1000) return null;
  const expected = createHmac("sha256", secret).update(`${code}.${timeText}`).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, "base64url"); } catch { return null; }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  return { code, attributedAt };
}

export function referralCookie(value: string) {
  if (!decodeReferral(value)) throw new Error("Invalid signed referral");
  return {
    name: REFERRAL_COOKIE,
    value,
    maxAge: REFERRAL_WINDOW_SECONDS,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: true,
  };
}
