import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import runtime from "@/data/production/igcse-economics-0455.json";
import { BANK_CATALOG } from "@/lib/catalog";
import { assertExactCohortSeals } from "../../scripts/igcse-release.mjs";

type CandidateRuntime = { questions: Array<{id:string;year:number}>; paperCount:number; years:string; releaseStatus:string; runtimeArtifact: {baseQuestionCount:number; extensionQuestionCount:number; baseIdSeal:string; extensionIdSeal:string; combinedIdSeal:string; assetVerification:string; storageReceiptSha256:null; assetManifestSha256:null} };
const r = runtime as unknown as CandidateRuntime;
const seal = (ids: string[]) => createHash("sha256").update(JSON.stringify([...ids].sort())).digest("hex");
describe("Economics 0455 combined candidate", () => {
  it("has exactly the sealed base and extension cohorts", () => {
    expect(r.questions).toHaveLength(1723); expect(r.paperCount).toBe(98); expect(r.years).toBe("2019-2025");
    expect(r.runtimeArtifact.baseQuestionCount).toBe(1219); expect(r.runtimeArtifact.extensionQuestionCount).toBe(504);
    expect(r.runtimeArtifact.baseIdSeal).toBe(seal(r.questions.filter((q: {id:string;year:number})=>q.year>=2021).map((q: {id:string;year:number})=>q.id)));
    expect(r.runtimeArtifact.extensionIdSeal).toBe(seal(r.questions.filter((q: {id:string;year:number})=>q.year<=2020).map((q: {id:string;year:number})=>q.id)));
    expect(() => assertExactCohortSeals(r)).not.toThrow();
  });
  it("fails closed on one base or extension substitution", () => {
    for (const predicate of [(q: {id:string;year:number})=>q.year>=2021, (q: {id:string;year:number})=>q.year<=2020]) {
      const copy = structuredClone(r); const i = copy.questions.findIndex(predicate); copy.questions[i].id = "adversarial-substitution";
      expect(() => assertExactCohortSeals(copy)).toThrow(/cohort seal mismatch/);
    }
  });
  it("remains pending upload and hidden from finalized runtime", () => {
    expect(r.releaseStatus).toBe("authorized_production_candidate"); expect(r.runtimeArtifact.assetVerification).toBe("pending_storage_release");
    expect(r.runtimeArtifact.storageReceiptSha256).toBeNull(); expect(r.runtimeArtifact.assetManifestSha256).toBeNull();
  });
  it("is wired to the combined catalog", () => { const b = BANK_CATALOG.find(x=>x.slug==="igcse-economics-0455")!; expect([b.questionCount,b.paperCount,b.years]).toEqual([1723,98,"2019-2025"]); });
});
