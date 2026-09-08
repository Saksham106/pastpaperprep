import { describe, expect, it } from "vitest";
import {
  FREE_QUESTION_YEARS,
  PREVIEW_QUESTION_IDS,
  canExportPdf,
  canViewAnswer,
  canViewQuestionAsset,
  hasBankAccess,
  isPreviewQuestion,
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

  it("grants only the related banks for subject-pair bundles", () => {
    expect(hasBankAccess("igcse", [entitlement("bundle_igcse")], now)).toBe(true);
    expect(hasBankAccess("igcse-additional", [entitlement("bundle_igcse")], now)).toBe(true);
    expect(hasBankAccess("ib-hl", [entitlement("bundle_ib_aa")], now)).toBe(true);
    expect(hasBankAccess("ib-sl", [entitlement("bundle_ib_aa")], now)).toBe(true);
    expect(hasBankAccess("ib-ai-hl", [entitlement("bundle_ib_ai")], now)).toBe(true);
    expect(hasBankAccess("ib-ai-sl", [entitlement("bundle_ib_ai")], now)).toBe(true);
    expect(hasBankAccess("ib-ai-hl", [entitlement("bundle_ib_aa")], now)).toBe(false);
    expect(hasBankAccess("ib-chemistry-hl", [entitlement("bundle_ib_chemistry")], now)).toBe(true);
    expect(hasBankAccess("ib-chemistry-sl", [entitlement("bundle_ib_chemistry")], now)).toBe(true);
    expect(hasBankAccess("ib-chemistry-hl", [entitlement("bundle_ib_ai")], now)).toBe(false);
  });

  it("rejects expired, revoked, and unrelated entitlements", () => {
    expect(hasBankAccess("ib-sl", [entitlement("bank_ib_sl", { expiresAt: now.toISOString() })], now)).toBe(false);
    expect(hasBankAccess("ib-sl", [entitlement("bank_ib_sl", { startsAt: "2026-08-26T18:00:00.000Z" })], now)).toBe(false);
    expect(hasBankAccess("ib-sl", [entitlement("bank_ib_sl", { startsAt: null })], now)).toBe(false);
    expect(hasBankAccess("ib-sl", [entitlement("bank_ib_sl", { startsAt: "not-a-date" })], now)).toBe(false);
    expect(hasBankAccess("ib-sl", [entitlement("bank_ib_sl", { expiresAt: "not-a-date" })], now)).toBe(false);
    expect(hasBankAccess("ib-sl", [entitlement("bank_ib_sl", { status: "revoked" })], now)).toBe(false);
    expect(hasBankAccess("ib-sl", [entitlement("bank_ib_hl")], now)).toBe(false);
  });
});

describe("preview and premium actions", () => {
  it("makes reviewed older years free while keeping newer years paid", () => {
    expect(FREE_QUESTION_YEARS).toEqual({
      igcse: [2016, 2017, 2018],
      "igcse-additional": [2016, 2017, 2018],
      "ib-hl": [2017],
      "ib-sl": [2017],
      "ib-ai-hl": [2021],
      "ib-ai-sl": [2021],
      "ib-chemistry-hl": [2020],
      "ib-chemistry-sl": [2020],
      "ib-physics-hl": [2020],
      "ib-physics-sl": [2020],
    });
    expect(isPreviewQuestion("igcse", "0580-2018-june-22-q1")).toBe(true);
    expect(isPreviewQuestion("igcse", "0580-2019-june-22-q1")).toBe(false);
    expect(isPreviewQuestion("igcse-additional", "0606-2018-june-22-q1")).toBe(true);
    expect(isPreviewQuestion("igcse-additional", "0606-2019-june-22-q1")).toBe(false);
    expect(isPreviewQuestion("ib-hl", "2017-may-tz1-p1-q1")).toBe(true);
    expect(isPreviewQuestion("ib-hl", "2018-may-tz1-p1-q1")).toBe(false);
    expect(isPreviewQuestion("ib-sl", "2017-may-p1-tz1-q1")).toBe(true);
    expect(isPreviewQuestion("ib-ai-hl", "2021-may-tz1-p1-q1")).toBe(true);
    expect(isPreviewQuestion("ib-ai-sl", "2022-may-tz1-p1-q1")).toBe(false);
    expect(isPreviewQuestion("ib-chemistry-hl", "2020-november-tz0-hl-p1-q1")).toBe(true);
    expect(isPreviewQuestion("ib-chemistry-sl", "2021-may-tz1-sl-p1-q1")).toBe(false);
  });

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
