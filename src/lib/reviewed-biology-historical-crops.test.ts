import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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
const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const read = (path: string) => readFileSync(path);
const overlayBytes = read("src/data/reviewed-biology-historical-crop-repairs.json");
const overlay = JSON.parse(overlayBytes.toString()) as Overlay;
const manifestBytes = read("data/storage/biology-historical-crop-repairs.manifest.json");
const manifest = JSON.parse(manifestBytes.toString()) as Manifest;
const receipt = JSON.parse(read("data/storage/biology-historical-crop-repairs.receipt.json").toString()) as {
  storageState: string; manifestSha256: string; completed: string[]; failed: unknown[];
  readbackProvenance: Array<{ scope: string; count: number; readbackLog?: string; readbackLogSha256?: string; releaseReceiptSha256?: string; createdNew?: number }>;
};
const release = JSON.parse(read("data/storage/igcse-biology-0610.manifest.json").toString()) as { objectPrefix: string; assets: Array<{ objectKey: string; sha256: string; size: number }> };
const releaseReceipt = JSON.parse(read("data/storage/igcse-biology-0610.receipt.json").toString()) as { storageState: string; completed: string[]; failed: unknown[] };
const written = JSON.parse(read("src/data/reviewed-biology-written-answer-repairs.json").toString()) as Record<string, unknown>;
const superseded = JSON.parse(read("docs/0610-historical-crops-superseded-keys.json").toString()) as { count: number; overlaySha256: string; keys: Array<{ questionId: string; role: string; objectKey: string; sha256: string }> };
const entries = Object.entries(overlay.entries);
const runtime = biology as unknown as { questions: Array<Record<string, unknown> & { id: string; component: string; marks: number; questionImages: string[]; markschemeImages: string[] }> };
const byId = new Map(runtime.questions.map((q) => [q.id, q]));

describe("historical Biology 0610 crop repairs (reviewed overlay)", () => {
  it("is bound to the source repair package and leaves the finalized runtime and release receipt as they were", () => {
    expect(overlay.schema).toBe("reviewed-biology-historical-crop-repairs-v1");
    expect(overlay.bank).toBe(BANK);
    expect(overlay.namespace).toBe(`repairs/historical-crops-v1-${overlay.source.packageSha256.slice(0, 16)}`);
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
    const log = receipt.readbackProvenance.find((p) => p.readbackLog)!;
    const logText = read(log.readbackLog!).toString();
    expect(log.readbackLogSha256).toBe(sha256(logText));
    const rows = logText.split("\n").filter(Boolean).map((line) => JSON.parse(line) as { key: string; sha256: string; bytes: number; status: string; existedBefore: boolean });
    const verified = new Map(rows.filter((r) => r.status === "verified").map((r) => [r.key, r]));
    expect(rows).toHaveLength(manifest.assets.length);
    expect(log.count).toBe(manifest.assets.length);
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
