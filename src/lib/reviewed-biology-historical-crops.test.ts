import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { BankSlug } from "@/lib/banks";
import { normalizeBankQuestions, type UnifiedQuestion } from "@/lib/questions";
import { historicalMarks, historicalMarkschemePaths, historicalQuestionPaths } from "@/lib/reviewed-biology-historical-crops";
import { reviewedMarkschemePaths } from "@/lib/reviewed-mcq-answer-repairs";
import biology from "@/data/production/igcse-biology-0610.json";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";

type CropList = { oldPaths: string[]; oldSha256: string[]; newPaths: string[]; sha256: string[] };
type Entry = { question?: CropList; markscheme?: CropList; marks?: { old: number; new: number; evidence: string } };
type Overlay = { schema: string; bank: string; namespace: string; source: { repository: string; commit: string; package: string; packageSha256: string }; entries: Record<string, Entry> };
type Asset = { objectKey: string; relativePath: string; sourcePath: string; sha256: string; size: number; contentType: string };
type Manifest = {
  state: string; bank: string; objectPrefix: string; namespace: string; source: Overlay["source"]; runtimeSha256: string;
  releaseAssetManifestSha256: string; releaseReceiptSha256: string; counts: Record<string, number>;
  markschemeDeferredToWrittenAnswerRepair: string[]; assets: Asset[]; kept: Array<{ objectKey: string; sha256: string; size: number }>;
};

const BANK: BankSlug = "igcse-biology-0610";
const SOURCE_ROOT = process.env.PASTPAPERPREP_IGCSE_BIOLOGY_SOURCE_ROOT ?? join(process.cwd(), "..", "igcse-biology-0610-topic-practice");
const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const read = (path: string) => readFileSync(path);
const overlayBytes = read("src/data/reviewed-biology-historical-crop-repairs.json");
const overlay = JSON.parse(overlayBytes.toString()) as Overlay;
const manifestBytes = read("data/storage/biology-historical-crop-repairs.manifest.json");
const manifest = JSON.parse(manifestBytes.toString()) as Manifest;
const receipt = JSON.parse(read("data/storage/biology-historical-crop-repairs.receipt.json").toString()) as {
  storageState: string; manifestSha256: string; completed: string[]; failed: unknown[];
  readbackProvenance: Array<{ scope: string; count: number; readbackLog?: string; readbackLogSha256?: string; releaseReceiptSha256?: string; createdNew?: number; uploadPlan?: string; uploadPlanSha256?: string }>;
};
const release = JSON.parse(read("data/storage/igcse-biology-0610.manifest.json").toString()) as { objectPrefix: string; assets: Array<{ objectKey: string; sha256: string; size: number }> };
const releaseReceipt = JSON.parse(read("data/storage/igcse-biology-0610.receipt.json").toString()) as { storageState: string; completed: string[]; failed: unknown[] };
const written = JSON.parse(read("src/data/reviewed-biology-written-answer-repairs.json").toString()) as Record<string, unknown>;
const superseded = JSON.parse(read("docs/0610-historical-crops-superseded-keys.json").toString()) as { count: number; overlaySha256: string; keys: Array<{ questionId: string; role: string; objectKey: string; sha256: string }> };
const entries = Object.entries(overlay.entries);
const runtime = biology as unknown as { questions: Array<Record<string, unknown> & { id: string; component: string; marks: number; questionImages: string[]; markschemeImages: string[] }> };
const byId = new Map(runtime.questions.map((q) => [q.id, q]));
const sourcePackagePath = join(SOURCE_ROOT, overlay.source.package);
const sourcePackageBytes = existsSync(sourcePackagePath) && sha256(read(sourcePackagePath)) === overlay.source.packageSha256 ? read(sourcePackagePath) : null;

describe("historical Biology 0610 crop repairs (reviewed overlay)", () => {
  it("is bound to the source repair package and leaves the finalized runtime and release receipt as they were", () => {
    expect(overlay.schema).toBe("reviewed-biology-historical-crop-repairs-v1");
    expect(overlay.bank).toBe(BANK);
    // Pinned to the first package's SHA-256 prefix; objects under it are content-addressed, so the
    // PR #292 review fix (a new package) reuses the 626 uploaded objects and adds one.
    expect(overlay.namespace).toBe("repairs/historical-crops-v1-08cb6b182b98620f");
    expect(overlay.source.packageSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.namespace).toBe(overlay.namespace);
    expect(manifest.source).toEqual(overlay.source);
    expect(manifest.runtimeSha256).toBe(sha256(read(`src/data/production/${BANK}.json`)));
    expect(manifest.releaseAssetManifestSha256).toBe(sha256(read(`data/storage/${BANK}.manifest.json`)));
    expect(manifest.releaseReceiptSha256).toBe(sha256(read(`data/storage/${BANK}.receipt.json`)));
    expect(manifest.objectPrefix).toBe(release.objectPrefix);
    expect(manifest.counts.questions).toBe(entries.length);
  });

  it("projects exactly the runtime's crops onto kept released keys or new content-addressed keys", () => {
    const releaseByKey = new Map(release.assets.map((a) => [a.objectKey.slice(release.objectPrefix.length), a]));
    const newPaths = new Set(manifest.assets.map((a) => a.relativePath));
    for (const [qid, entry] of entries) {
      const q = byId.get(qid)!;
      expect(q, qid).toBeTruthy();
      expect(q.component.startsWith("1") || q.component.startsWith("2"), qid).toBe(false);
      for (const role of ["question", "markscheme"] as const) {
        const list = entry[role];
        if (!list) continue;
        list.oldPaths.forEach((path, i) => expect(releaseByKey.get(path)?.sha256, `${qid} ${path}`).toBe(list.oldSha256[i]));
        list.newPaths.forEach((path, i) => {
          if (list.oldPaths.includes(path)) expect(releaseByKey.get(path)?.sha256).toBe(list.sha256[i]);
          else {
            expect(path).toBe(`${overlay.namespace}/${list.sha256[i]}.webp`);
            expect(newPaths.has(path), path).toBe(true);
          }
        });
      }
      if (entry.markscheme) {
        expect(written[qid], `${qid} also has a written-answer repair`).toBeUndefined();
        expect(entry.markscheme.oldPaths).toEqual(q.markschemeImages);
      }
    }
  });

  it("serves the repaired lists through normalization and changes nothing else", () => {
    const frozen = JSON.stringify(biology);
    const before = normalizeBankQuestions(BANK, runtime.questions, { economicsAssetMode: "private" });
    const after = normalizeBankQuestions(BANK, runtime.questions, { economicsAssetMode: "private", applyReviewedBlankPages: true });
    const prefix = (paths: string[]) => paths.map((path) => `${release.objectPrefix}${path}`);
    const ignored = new Set(["questionImages", "questionAssetPaths", "questionImageCount", "markschemeImages", "markschemeAssetPaths", "markschemeImageCount"]);
    const stable = (q: UnifiedQuestion) => Object.fromEntries(Object.entries(q).filter(([k]) => !ignored.has(k)));
    expect(after.map((q) => q.id)).toEqual(before.map((q) => q.id));
    for (let i = 0; i < after.length; i++) expect(stable(after[i])).toEqual(stable(before[i]));
    const byIdAfter = new Map(after.map((q) => [q.id, q]));
    for (const [qid, entry] of entries) {
      const q = byIdAfter.get(qid)!;
      if (entry.question) {
        expect(q.questionAssetPaths).toEqual(prefix(entry.question.newPaths));
        expect(q.questionImageCount).toBe(entry.question.newPaths.length);
      }
      if (entry.markscheme) {
        expect(q.markschemeAssetPaths).toEqual(prefix(entry.markscheme.newPaths));
        expect(q.markschemeImageCount).toBe(entry.markscheme.newPaths.length);
      }
    }
    expect(JSON.stringify(biology)).toBe(frozen);
  });

  it("corrects only marks a repaired crop proves wrong: 0610-2019-s-31-q3 prints [Total: 10]", () => {
    const marks = entries.filter(([, e]) => e.marks).map(([qid, e]) => [qid, e.marks!.old, e.marks!.new]);
    expect(marks).toEqual([["0610-2019-s-31-q3", 4, 10]]);
    expect(byId.get("0610-2019-s-31-q3")!.marks).toBe(4); // the finalized runtime is untouched
    expect(historicalMarks(BANK, "0610-2019-s-31-q3", 4)).toBe(10);
    expect(() => historicalMarks(BANK, "0610-2019-s-31-q3", 5)).toThrow(/disagrees/);
    const normalized = normalizeBankQuestions(BANK, runtime.questions, { economicsAssetMode: "private", applyReviewedBlankPages: true });
    const paper = normalized.filter((q) => q.id.startsWith("0610-2019-s-31-"));
    expect(paper.reduce((total, q) => total + (q.marks ?? 0), 0)).toBe(80); // the paper's printed maximum
    expect(metadataFromRaw(byId.get("0610-2019-s-31-q3"), { bank: BANK, normalizedProduction: true }).marks).toBe(10);
  });

  it("public index image counts follow the overlay", () => {
    for (const [qid, entry] of entries) {
      const meta = metadataFromRaw(byId.get(qid), { bank: BANK, normalizedProduction: true });
      if (entry.question) expect(meta.questionImageCount, qid).toBe(entry.question.newPaths.length);
      if (entry.markscheme) expect(meta.markschemeImageCount, qid).toBe(entry.markscheme.newPaths.length);
    }
  });

  it("every new object was created and read back, and kept objects are covered by the verified release receipt", () => {
    expect(receipt.storageState).toBe("verified_readback");
    expect(receipt.failed).toEqual([]);
    expect(receipt.manifestSha256).toBe(sha256(manifestBytes));
    const all = [...manifest.assets.map((a) => a.objectKey), ...manifest.kept.map((k) => k.objectKey)].sort();
    expect(receipt.completed).toEqual(all);
    const logs = receipt.readbackProvenance.filter((p) => p.readbackLog);
    expect(logs.map((p) => p.readbackLog)).toEqual(["docs/0610-historical-crops-r2-upload-log.jsonl", "docs/0610-historical-crops-w63-r2-upload-log.jsonl"]);
    const verified = new Map<string, { key: string; sha256: string; bytes: number; status: string; existedBefore: boolean }>();
    for (const log of logs) {
      const logText = read(log.readbackLog!).toString();
      expect(log.readbackLogSha256).toBe(sha256(logText));
      const rows = logText.split("\n").filter(Boolean).map((line) => JSON.parse(line) as { key: string; sha256: string; bytes: number; status: string; existedBefore: boolean });
      expect(rows).toHaveLength(log.count);
      expect(log.createdNew).toBe(log.count);
      for (const row of rows) {
        expect(row.status).toBe("verified");
        expect(verified.has(row.key), `${row.key} is in two logs`).toBe(false);
        verified.set(row.key, row);
      }
    }
    expect(verified.size).toBe(manifest.assets.length);
    for (const a of manifest.assets) {
      expect(verified.get(a.objectKey), a.objectKey).toMatchObject({ sha256: a.sha256, bytes: a.size, existedBefore: false });
      expect(a.objectKey).toBe(`${manifest.objectPrefix}${overlay.namespace}/${a.sha256}.webp`);
      expect(a.contentType).toBe("image/webp");
    }
    expect(releaseReceipt.storageState).toBe("verified_readback");
    const releaseByKey = new Map(release.assets.map((a) => [a.objectKey, a]));
    const releaseVerified = new Set(releaseReceipt.completed);
    for (const k of manifest.kept) {
      expect(releaseByKey.get(k.objectKey)).toMatchObject({ sha256: k.sha256, size: k.size });
      expect(releaseVerified.has(k.objectKey)).toBe(true);
    }
    expect(receipt.readbackProvenance.find((p) => p.releaseReceiptSha256)?.releaseReceiptSha256).toBe(manifest.releaseReceiptSha256);
  });

  it("lists every released key the overlay stops serving (left in the bucket for the owner)", () => {
    expect(superseded.overlaySha256).toBe(sha256(overlayBytes));
    const expected = entries.flatMap(([qid, e]) => (["question", "markscheme"] as const).flatMap((role) =>
      (e[role]?.oldPaths ?? []).filter((path) => !e[role]!.newPaths.includes(path)).map((path) => `${qid}|${role}|${release.objectPrefix}${path}`)));
    expect(superseded.keys.map((k) => `${k.questionId}|${k.role}|${k.objectKey}`).sort()).toEqual(expected.sort());
    expect(superseded.count).toBe(expected.length);
  });

  it("0610-2019-w-63-q1 serves mark-scheme page 4 with 1(a)(i)-1(c)(i), then pages 5-6 (PR #292 review)", () => {
    // Page 4 is headed `Question | Mark scheme | Mark | Guidance`; the source lane's first-answer-page
    // rule knew only `Question | Answer`, so it started at page 5 (1(c)(ii)) and dropped 10 of 18 marks.
    const pages = [
      { page: 4, parts: ["1(a)(i)", "1(a)(ii)", "1(a)(iii)", "1(a)(iv)", "1(b)", "1(c)(i)"], sha256: "3462b4d1cd3ffc8fde945baf036fd8a1c57c5024c0a9321359e3772fcb141108" },
      { page: 5, parts: ["1(c)(ii)"], sha256: "ae35c1a9231ba59273152893ed82f3813c9f683136731c25d67f45f26b7dc50d" },
      { page: 6, parts: ["1(d)"], sha256: "5c45d3f5b8cde96d2e0a38b5026f7c8f9d2f0a6a20df00e807837f409a0544cb" },
    ];
    const qid = "0610-2019-w-63-q1";
    const list = overlay.entries[qid].markscheme!;
    expect(list.oldPaths).toEqual(["markschemes/0610-2019-w-63/q1-row1-5.webp", "markschemes/0610-2019-w-63/q1-row2-6.webp"]);
    expect(list.sha256).toEqual(pages.map((p) => p.sha256));
    expect(list.newPaths).toEqual(pages.map((p) => `${overlay.namespace}/${p.sha256}.webp`));
    const q = normalizeBankQuestions(BANK, runtime.questions, { economicsAssetMode: "private", applyReviewedBlankPages: true }).find((x) => x.id === qid)!;
    expect(q.markschemeAssetPaths).toEqual(list.newPaths.map((path) => `${release.objectPrefix}${path}`));
    expect(q.marks).toBe(18);
    const page4 = manifest.assets.find((a) => a.sha256 === pages[0].sha256)!;
    expect(page4).toMatchObject({ sourcePath: `data/segmentation/historical-crop-repairs/assets/0610-2019-w-63/markscheme/${pages[0].sha256}.webp`, size: 20742 });
    const plan = JSON.parse(read("docs/0610-historical-crops-w63-r2-upload-plan.json").toString()) as { overlayManifestSha256: string; assets: Asset[] };
    expect(plan.overlayManifestSha256).toBe(sha256(manifestBytes));
    expect(plan.assets.map((a) => a.objectKey)).toEqual([page4.objectKey]);
    const w63 = receipt.readbackProvenance.find((p) => p.uploadPlan);
    expect(w63).toMatchObject({ uploadPlan: "docs/0610-historical-crops-w63-r2-upload-plan.json", uploadPlanSha256: sha256(read("docs/0610-historical-crops-w63-r2-upload-plan.json")), count: 1 });
  });

  // Needs the source checkout at this overlay's package revision; skipped otherwise.
  it.skipIf(!sourcePackageBytes)("the source package places those crops on MS pages 4, 5 and 6", () => {
    const pkg = JSON.parse(sourcePackageBytes!.toString()) as { repairs: Array<{ question_id: string; markscheme?: { repaired: Array<{ sha256: string; source_page: number }> } }> };
    const repaired = pkg.repairs.find((r) => r.question_id === "0610-2019-w-63-q1")!.markscheme!.repaired;
    expect(repaired.map((c) => c.source_page)).toEqual([4, 5, 6]);
    expect(repaired.map((c) => c.sha256)).toEqual(overlay.entries["0610-2019-w-63-q1"].markscheme!.sha256);
  });

  it("fails closed on stale crops and never touches another bank", () => {
    const [qid, entry] = entries.find(([, e]) => e.markscheme)!;
    expect(reviewedMarkschemePaths(BANK, qid, entry.markscheme!.oldPaths)).toEqual(entry.markscheme!.newPaths);
    expect(() => historicalMarkschemePaths(BANK, qid, ["stale.webp"])).toThrow(/disagrees/);
    const [qpId, qp] = entries.find(([, e]) => e.question)!;
    expect(() => historicalQuestionPaths(BANK, qpId, ["stale.webp"])).toThrow(/disagrees/);
    expect(historicalQuestionPaths("igcse-chemistry-0620", qpId, qp.question!.oldPaths)).toEqual(qp.question!.oldPaths);
    expect(historicalMarkschemePaths("igcse-physics-0625", qid, ["x.webp"])).toBeNull();
  });
});
