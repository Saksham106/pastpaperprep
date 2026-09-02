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
  it("authorizes a public preview question and answer", async () => {
    const questionId = PREVIEW_QUESTION_IDS["ib-sl"][0];
    const result = await authorizeAssetRequests(
      "ib-sl",
      [{ questionId, kind: "question" }, { questionId, kind: "answer" }],
      [],
      now,
    );

    expect(result).toHaveLength(2);
    expect(result[0].paths.every((path) => path.startsWith("ib-sl/questions/"))).toBe(true);
    expect(result[1].paths.every((path) => path.startsWith("ib-sl/"))).toBe(true);
  });

  it("denies a non-preview question without access", async () => {
    await expect(authorizeAssetRequests(
      "ib-sl",
      [{ questionId: "m26-math-aasl-p1-tza-q4", kind: "question" }],
      [],
      now,
    )).rejects.toThrow("not authorized");
  });

  it("authorizes paid bank assets but not another bank", async () => {
    await expect(authorizeAssetRequests(
      "ib-sl",
      [{ questionId: "m26-math-aasl-p1-tza-q4", kind: "question" }],
      paid,
      now,
    )).resolves.toHaveLength(1);
    await expect(authorizeAssetRequests(
      "ib-hl",
      [{ questionId: "2026-may-tza-p1-q4", kind: "question" }],
      paid,
      now,
    )).rejects.toThrow("not authorized");
  });

  it("rejects unknown questions, duplicate requests, and oversized batches", async () => {
    await expect(authorizeAssetRequests("ib-sl", [{ questionId: "missing", kind: "question" }], paid, now)).rejects.toThrow("Unknown question");
    await expect(authorizeAssetRequests("ib-sl", [
      { questionId: "m26-math-aasl-p1-tza-q4", kind: "question" },
      { questionId: "m26-math-aasl-p1-tza-q4", kind: "question" },
    ], paid, now)).rejects.toThrow("Duplicate");
    await expect(authorizeAssetRequests(
      "ib-sl",
      Array.from({ length: 21 }, (_, index) => ({ questionId: `q${index}`, kind: "question" as const })),
      paid,
      now,
    )).rejects.toThrow("between 1 and 20");
  });
});
