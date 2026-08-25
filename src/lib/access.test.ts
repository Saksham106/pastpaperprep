import { describe, expect, it } from "vitest";
import {
  PREVIEW_QUESTION_IDS,
  canExportPdf,
  canViewAnswer,
  canViewQuestionAsset,
  hasBankAccess,
  type AccessEntitlement,
} from "@/lib/access";

const now = new Date("2026-08-25T18:00:00.000Z");

function entitlement(
  productId: AccessEntitlement["productId"],
  overrides: Partial<AccessEntitlement> = {},
): AccessEntitlement {
  return {
    productId,
    status: "active",
    startsAt: "2026-08-01T18:00:00.000Z",
    expiresAt: "2026-09-25T18:00:00.000Z",
    ...overrides,
  };
}

describe("bank access", () => {
  it("grants only the purchased bank", () => {
    const entitlements = [entitlement("bank_ib_sl")];

    expect(hasBankAccess("ib-sl", entitlements, now)).toBe(true);
    expect(hasBankAccess("ib-hl", entitlements, now)).toBe(false);
    expect(hasBankAccess("igcse", entitlements, now)).toBe(false);
  });

  it("grants every bank for the all-access bundle", () => {
    const entitlements = [entitlement("bundle_all")];

    expect(hasBankAccess("ib-sl", entitlements, now)).toBe(true);
    expect(hasBankAccess("ib-hl", entitlements, now)).toBe(true);
    expect(hasBankAccess("igcse", entitlements, now)).toBe(true);
  });

  it("rejects expired, revoked, and unrelated entitlements", () => {
    expect(hasBankAccess("ib-sl", [entitlement("bank_ib_sl", { expiresAt: now.toISOString() })], now)).toBe(false);
    expect(hasBankAccess("ib-sl", [entitlement("bank_ib_sl", { startsAt: "2026-08-26T18:00:00.000Z" })], now)).toBe(false);
    expect(hasBankAccess("ib-sl", [entitlement("bank_ib_sl", { status: "revoked" })], now)).toBe(false);
    expect(hasBankAccess("ib-sl", [entitlement("bank_ib_hl")], now)).toBe(false);
  });
});

describe("preview and premium actions", () => {
  it("allows the explicit public sample questions and answers", () => {
    const previewId = PREVIEW_QUESTION_IDS["ib-sl"][0];

    expect(canViewQuestionAsset("ib-sl", previewId, [], now)).toBe(true);
    expect(canViewAnswer("ib-sl", previewId, [], now)).toBe(true);
  });

  it("does not make arbitrary questions public", () => {
    expect(canViewQuestionAsset("ib-sl", "not-a-preview", [], now)).toBe(false);
    expect(canViewAnswer("ib-sl", "not-a-preview", [], now)).toBe(false);
  });

  it("requires paid bank access for PDF export", () => {
    expect(canExportPdf("ib-hl", [], now)).toBe(false);
    expect(canExportPdf("ib-hl", [entitlement("bank_ib_hl")], now)).toBe(true);
    expect(canExportPdf("ib-hl", [entitlement("bundle_all")], now)).toBe(true);
  });
});
