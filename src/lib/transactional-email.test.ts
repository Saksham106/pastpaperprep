import { describe, expect, it, vi } from "vitest";
import { sendTransactionalEmail, transactionalEmailConfig } from "@/lib/transactional-email";

const config = { apiKey: "re_test_key", from: "PastPaperPrep <hello@pastpaperprep.com>" };
const message = { to: "student@example.com", subject: "Subject", text: "Text", html: "<p>Html</p>", idempotencyKey: "access-end-reminder/sub_1/123" };

describe("transactionalEmailConfig", () => {
  it("needs a Resend key and a pastpaperprep.com sender", () => {
    expect(transactionalEmailConfig({ RESEND_API_KEY: "re_x", ACCESS_END_REMINDER_FROM: "PastPaperPrep <hello@pastpaperprep.com>" })).toEqual({ apiKey: "re_x", from: "PastPaperPrep <hello@pastpaperprep.com>" });
    expect(transactionalEmailConfig({ RESEND_API_KEY: "re_x", ACCESS_END_REMINDER_FROM: "hello@pastpaperprep.com" })).not.toBeNull();
    expect(transactionalEmailConfig({ RESEND_API_KEY: "sk_x", ACCESS_END_REMINDER_FROM: "hello@pastpaperprep.com" })).toBeNull();
    expect(transactionalEmailConfig({ RESEND_API_KEY: "re_x", ACCESS_END_REMINDER_FROM: "x@evil.example" })).toBeNull();
    expect(transactionalEmailConfig({ RESEND_API_KEY: "re_x", ACCESS_END_REMINDER_FROM: "x@pastpaperprep.com.evil.example" })).toBeNull();
    expect(transactionalEmailConfig({})).toBeNull();
  });
});

describe("sendTransactionalEmail", () => {
  it("posts to Resend with the idempotency key", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    expect(await sendTransactionalEmail(message, config, fetchImpl as unknown as typeof fetch)).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({ Authorization: "Bearer re_test_key", "Idempotency-Key": message.idempotencyKey });
    expect(JSON.parse(init.body as string)).toMatchObject({ from: config.from, to: ["student@example.com"], subject: "Subject", reply_to: "hello@pastpaperprep.com" });
  });

  it("retries rate limits, server errors and timeouts, never rejected sends", async () => {
    const status = (code: number) => vi.fn(async () => new Response("{}", { status: code })) as unknown as typeof fetch;
    expect(await sendTransactionalEmail(message, config, status(429))).toEqual({ ok: false, retryable: true });
    expect(await sendTransactionalEmail(message, config, status(502))).toEqual({ ok: false, retryable: true });
    expect(await sendTransactionalEmail(message, config, status(422))).toEqual({ ok: false, retryable: false });
    expect(await sendTransactionalEmail(message, config, vi.fn(async () => { throw new Error("timeout"); }) as unknown as typeof fetch)).toEqual({ ok: false, retryable: true });
  });

  it("refuses header injection before calling the provider", async () => {
    const fetchImpl = vi.fn();
    expect(await sendTransactionalEmail({ ...message, to: "a@b.com\r\nBcc: x@y.z" }, config, fetchImpl as unknown as typeof fetch)).toEqual({ ok: false, retryable: false });
    expect(await sendTransactionalEmail({ ...message, subject: "Hi\nthere" }, config, fetchImpl as unknown as typeof fetch)).toEqual({ ok: false, retryable: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
