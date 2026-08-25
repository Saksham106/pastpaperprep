import { describe, expect, it } from "vitest";
import { PREVIEW_QUESTION_IDS, type AccessEntitlement } from "@/lib/access";
import { authorizeAssetRequests } from "@/lib/asset-access";

const now = new Date("2026-08-25T18:00:00.000Z");
const paid: AccessEntitlement[] = [{
  productId: "bank_ib_sl",
  status: "active",
  startsAt: "2026-08-01T18:00:00.000Z",
  expiresAt: "2026-09-25T18:00:00.000Z",
}];

describe("asset request authorization", () => {
  it("authorizes a public preview question and answer", () => {
    const questionId = PREVIEW_QUESTION_IDS["ib-sl"][0];
    const result = authorizeAssetRequests(
      "ib-sl",
      [{ questionId, kind: "question" }, { questionId, kind: "answer" }],
      [],
      now,
    );

    expect(result).toHaveLength(2);
    expect(result[0].paths.every((path) => path.startsWith("ib-sl/questions/"))).toBe(true);
    expect(result[1].paths.every((path) => path.startsWith("ib-sl/"))).toBe(true);
  });

  it("denies a non-preview question without access", () => {
    expect(() => authorizeAssetRequests(
      "ib-sl",
      [{ questionId: "m26-math-aasl-p1-tza-q4", kind: "question" }],
      [],
      now,
    )).toThrow("not authorized");
  });

  it("authorizes paid bank assets but not another bank", () => {
    expect(authorizeAssetRequests(
      "ib-sl",
      [{ questionId: "m26-math-aasl-p1-tza-q4", kind: "question" }],
      paid,
      now,
    )).toHaveLength(1);
    expect(() => authorizeAssetRequests(
      "ib-hl",
      [{ questionId: "2026-may-tza-p1-q4", kind: "question" }],
      paid,
      now,
    )).toThrow("not authorized");
  });

  it("rejects unknown questions, duplicate requests, and oversized batches", () => {
    expect(() => authorizeAssetRequests("ib-sl", [{ questionId: "missing", kind: "question" }], paid, now)).toThrow("Unknown question");
    expect(() => authorizeAssetRequests("ib-sl", [
      { questionId: "m26-math-aasl-p1-tza-q4", kind: "question" },
      { questionId: "m26-math-aasl-p1-tza-q4", kind: "question" },
    ], paid, now)).toThrow("Duplicate");
    expect(() => authorizeAssetRequests(
      "ib-sl",
      Array.from({ length: 21 }, (_, index) => ({ questionId: `q${index}`, kind: "question" as const })),
      paid,
      now,
    )).toThrow("between 1 and 20");
  });
});
