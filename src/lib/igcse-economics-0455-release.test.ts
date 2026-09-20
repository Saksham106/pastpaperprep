import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import runtime from "@/data/production/igcse-economics-0455.json";
import manifest from "../../data/storage/igcse-economics-0455.manifest.json";
import receipt from "../../data/storage/igcse-economics-0455.receipt.json";
import { BANK_CATALOG } from "@/lib/catalog";
import { assertExactCohortSeals } from "../../scripts/igcse-release.mjs";

type ProductionRuntime = { questions: Array<{id:string;year:number;questionImages:string[];markschemeImages:string[];publicationStatus:string;classificationReviewStatus:string}>; paperCount:number; years:string; releaseStatus:string; runtimeArtifact: {baseQuestionCount:number; extensionQuestionCount:number; baseIdSeal:string; extensionIdSeal:string; combinedIdSeal:string; assetVerification:string; storageState:string; storageReceiptSha256:string; assetManifestSha256:string; contentSha256:string; finalizedContentSha256:string; sourceReconciliationReceiptSha256:string} };
const r = runtime as unknown as ProductionRuntime;
const seal = (ids: string[]) => createHash("sha256").update(JSON.stringify([...ids].sort())).digest("hex");
const jsonSha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
describe("Economics 0455 combined candidate", () => {
  it("has exactly the sealed base and extension cohorts", () => {
    expect(r.questions).toHaveLength(1723); expect(r.paperCount).toBe(98); expect(r.years).toBe("2019-2025");
    expect(r.runtimeArtifact.baseQuestionCount).toBe(1219); expect(r.runtimeArtifact.extensionQuestionCount).toBe(504);
    expect(new Set(r.questions.filter(q=>q.year<=2020).flatMap(q=>q.questionImages)).size).toBe(528);
    expect(new Set(r.questions.filter(q=>q.year<=2020).flatMap(q=>q.markschemeImages)).size).toBe(654);
    expect(r.runtimeArtifact.sourceReconciliationReceiptSha256).toBe("2647220c5e1571aaf2b62a69dd2c6741df904f38bc1104d66cb62807284bf020");
    expect(r.runtimeArtifact.baseIdSeal).toBe(seal(r.questions.filter((q: {id:string;year:number})=>q.year>=2021).map((q: {id:string;year:number})=>q.id)));
    expect(r.runtimeArtifact.extensionIdSeal).toBe(seal(r.questions.filter((q: {id:string;year:number})=>q.year<=2020).map((q: {id:string;year:number})=>q.id)));
    expect(r.runtimeArtifact.combinedIdSeal).toBe(seal(r.questions.map(q=>q.id)));
    expect(r.questions.every(q=>q.publicationStatus==="production" && q.classificationReviewStatus==="classified")).toBe(true);
  });
  it("fails closed on one base or extension substitution", () => {
    for (const predicate of [(q: {id:string;year:number})=>q.year>=2021, (q: {id:string;year:number})=>q.year<=2020]) {
      const copy = structuredClone(r); const i = copy.questions.findIndex(predicate); copy.questions[i].id = "adversarial-substitution";
      expect(() => assertExactCohortSeals(copy)).toThrow(/cohort seal mismatch/);
    }
  });
  it("is finalized only after verified storage readback", () => {
    expect(r.releaseStatus).toBe("production");
    expect(r.runtimeArtifact.assetVerification).toBe("verified_readback");
    expect(r.runtimeArtifact.storageState).toBe("verified_readback");
    expect(manifest.storageState).toBe("pending_upload");
    expect(receipt.storageState).toBe("verified_readback");
    expect(r.runtimeArtifact.contentSha256).toBe(manifest.contentSha256);
    expect(r.runtimeArtifact.finalizedContentSha256).toBe(jsonSha(r.questions));
    expect(r.runtimeArtifact.storageReceiptSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(r.runtimeArtifact.assetManifestSha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it("is wired to the combined catalog", () => { const b = BANK_CATALOG.find(x=>x.slug==="igcse-economics-0455")!; expect([b.questionCount,b.paperCount,b.years]).toEqual([1723,98,"2019-2025"]); });
});
