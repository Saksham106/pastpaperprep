import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import repairs from "@/data/reviewed-0606-ms-right-edge-repairs.json";
import mathsRepairs from "@/data/reviewed-maths-source-answer-repairs.json";
import geometry0606 from "@/data/print-geometry-0606.json";
import { isPreviewQuestion } from "@/lib/access";
import { planWholePdfImage, type PdfExportQuestion } from "@/lib/pdf-export";
import { printGeometryForSignedAssets } from "@/lib/print-geometry";
import { loadBankQuestions } from "@/lib/question-loader";
import { normalizeBankQuestions } from "@/lib/questions";
import { reviewed0606RightEdgeGeometry, reviewed0606RightEdgePaths } from "@/lib/reviewed-0606-ms-right-edge-repairs";
import { reviewed0606ContinuationPaths } from "@/lib/reviewed-0606-ms-continuation-repairs";
import { reviewedMarkschemePaths } from "@/lib/reviewed-mcq-answer-repairs";
import { reviewed0606SplitQuestionPaths } from "@/lib/reviewed-0606-question-splits";
import { verify0606PdfMetadata } from "@/lib/verified-0606-client";

type Entry = {
  oldPaths: string[]; oldSha256: string[]; newPaths: string[]; sha256: string[];
  printGeometry?: { physicalSizePt: [number, number]; imageDimensions: [number, number]; segments: [number, number, number, number][] };
  clipXPt?: [number, number][];
};
type StorageObject = { objectKey: string; path: string; questionIds: string[]; sha256: string; bytes: number; freeYear: boolean };
const entries = repairs.entries as unknown as Record<string, Entry>;
const storage = JSON.parse(readFileSync("data/storage/0606-ms-right-edge-repairs.manifest.json", "utf8")) as {
  namespace: string; objectCount: number; freeObjectCount: number; objects: StorageObject[];
};
const raw = JSON.parse(readFileSync("src/data/raw/igcse-additional.json", "utf8")) as {
  questions: { id: string; markschemeImages: string[]; questionImages: string[]; [key: string]: unknown }[];
};
const maths = mathsRepairs["igcse-additional"] as Record<string, { newPaths: string[]; sha256: string[] }>;
const historicalGeometry = geometry0606.entries as unknown as Record<string, [unknown, { physicalSizePt: [number, number]; imageDimensions: [number, number]; segments: [number, number, number, number][] }]>;

describe("reviewed 0606 mark-scheme edge repairs", () => {
  test("exact cohort: 271 historical crops and 2 source-grid images, each a new content-addressed object", () => {
    expect(repairs.namespace).toMatch(/^repairs\/0606-ms-right-edge-v1-[a-f0-9]{16}$/);
    expect(repairs.namespace).toBe(storage.namespace);
    const ids = Object.keys(entries);
    expect(ids).toHaveLength(273);
    const chained = ids.filter((id) => maths[id]);
    expect(chained.sort()).toEqual(["0606-2024-november-22-q8", "0606-2026-june-12-q9"]);
    const replaced = ids.flatMap((id) => entries[id].newPaths.filter((path, i) => path !== entries[id].oldPaths[i]));
    expect(replaced).toHaveLength(273);
    // Content-addressed: papers that reprint an identical table share one object.
    expect(storage.objectCount).toBe(new Set(replaced).size);
    expect(storage.objects.map((o) => o.path).sort()).toEqual([...new Set(replaced)].sort());
    expect(storage.objects.flatMap((o) => o.questionIds).sort()).toEqual(ids.sort());
    for (const object of storage.objects) {
      expect(object.objectKey).toBe(`igcse-additional/${object.path}`);
      expect(object.path).toBe(`${repairs.namespace}/${object.sha256}.webp`);
      expect(object.freeYear).toBe(object.questionIds.some((id) => isPreviewQuestion("igcse-additional", id)));
      for (const id of object.questionIds) expect(entries[id].newPaths).toContain(object.path);
    }
    expect(storage.freeObjectCount).toBe(storage.objects.filter((o) => o.freeYear).length);
    expect(ids.filter((id) => isPreviewQuestion("igcse-additional", id))).toHaveLength(129);
  });

  test("every entry is bound to the exact active answer it replaces", () => {
    const rows = new Map(raw.questions.map((q) => [q.id, q]));
    for (const [id, entry] of Object.entries(entries)) {
      const row = rows.get(id)!;
      expect(reviewedMarkschemePaths("igcse-additional", id, row.markschemeImages)).toEqual(entry.oldPaths);
      if (maths[id]) expect(entry.oldSha256).toEqual(maths[id].sha256);
      else expect(entry.oldSha256).toEqual([expect.stringMatching(/^[a-f0-9]{64}$/)]);
      expect(entry.newPaths).toHaveLength(entry.oldPaths.length);
      if (!maths[id]) {
        expect(entry.oldPaths).toEqual([`markschemes/${id}.webp`]);
        expect(entry.printGeometry).toBeDefined();
      } else {
        expect(entry.printGeometry).toBeUndefined();
      }
    }
  });

  test("the loader serves the repairs and leaves every other path untouched", async () => {
    const before = JSON.stringify(raw.questions);
    const baseline = new Map(normalizeBankQuestions("igcse-additional", raw.questions).map((q) => [q.id, q]));
    const loaded = new Map((await loadBankQuestions("igcse-additional")).map((q) => [q.id, q]));
    expect(JSON.stringify(raw.questions)).toBe(before);
    let changed = 0;
    for (const row of raw.questions) {
      const question = loaded.get(row.id)!;
      // Question crops change only through the reviewed question split (reviewed-0606-question-splits.test.ts).
      const split = reviewed0606SplitQuestionPaths("igcse-additional", row.id, row.questionImages);
      expect(question.questionAssetPaths).toEqual(JSON.stringify(split) === JSON.stringify(row.questionImages)
        ? baseline.get(row.id)!.questionAssetPaths : split.map((path) => `igcse-additional/${path}`));
      // Continuation rows are added after this overlay (docs/ib-crop-repairs-v2.md).
      const expected = reviewed0606ContinuationPaths("igcse-additional", row.id, reviewed0606RightEdgePaths("igcse-additional", row.id, reviewedMarkschemePaths("igcse-additional", row.id, row.markschemeImages)));
      expect(question.markschemeAssetPaths).toEqual(expected.map((path) => `igcse-additional/${path}`));
      if (entries[row.id]) {
        expect(question.markschemeAssetPaths).toEqual(entries[row.id].newPaths.map((path) => `igcse-additional/${path}`));
        changed += 1;
      } else {
        expect(reviewed0606RightEdgePaths("igcse-additional", row.id, reviewedMarkschemePaths("igcse-additional", row.id, row.markschemeImages))).toEqual(reviewedMarkschemePaths("igcse-additional", row.id, row.markschemeImages));
      }
    }
    expect(changed).toBe(273);
  });

  test("stale or foreign paths fail closed; other banks pass through", () => {
    const [id] = Object.keys(entries);
    expect(() => reviewed0606RightEdgePaths("igcse-additional", id, ["markschemes/stale.webp"])).toThrow();
    expect(reviewed0606RightEdgePaths("igcse", id, ["markschemes/x.webp"])).toEqual(["markschemes/x.webp"]);
    expect(reviewed0606RightEdgePaths("igcse-additional", "0606-not-a-question", ["a.webp"])).toEqual(["a.webp"]);
  });

  test("repaired answers keep their verified vertical print geometry at the new width and fit the PDF", () => {
    let checked = 0;
    for (const [id, entry] of Object.entries(entries)) {
      if (!entry.printGeometry) continue;
      const historical = historicalGeometry[id][1];
      const [left, right] = entry.clipXPt![0];
      expect(entry.printGeometry.segments).toEqual(historical.segments);
      expect(entry.printGeometry.physicalSizePt).toEqual([right - left, historical.physicalSizePt[1]]);
      expect(entry.printGeometry.imageDimensions[1]).toBe(historical.imageDimensions[1]);
      expect(entry.printGeometry.imageDimensions[0]).toBeGreaterThan(historical.imageDimensions[0]);
      const signed = printGeometryForSignedAssets("igcse-additional", id, "answer", [`igcse-additional/${entry.newPaths[0]}`]);
      expect(signed.printSizesPt[0]).toEqual(entry.printGeometry.physicalSizePt);
      expect(signed.rasterSizesPx[0]).toEqual(entry.printGeometry.imageDimensions);
      expect(signed.printSegments[0]!.reduce((sum, part) => sum + part.sourceHeight, 0)).toBe(entry.printGeometry.imageDimensions[1]);
      expect(reviewed0606RightEdgeGeometry(id, `igcse-additional/${entry.newPaths[0]}`)).toEqual(entry.printGeometry);
      // The question side and the historical path keep the historical receipt.
      expect(printGeometryForSignedAssets("igcse-additional", id, "answer", [entry.oldPaths[0]]).printSizesPt[0]).toEqual(historical.physicalSizePt);
      const [width, height] = entry.printGeometry.imageDimensions;
      const placement = planWholePdfImage(width, height, entry.printGeometry.physicalSizePt);
      expect(placement.scale).toBeGreaterThan(0);
      expect(placement.scale).toBeLessThanOrEqual(1);
      // Tall crops print one source page at a time; each page keeps (almost) its printed size.
      for (const [, sourceHeight, physicalHeightPt] of entry.printGeometry.segments) {
        expect(planWholePdfImage(width, sourceHeight, [entry.printGeometry.physicalSizePt[0], physicalHeightPt]).scale).toBeGreaterThan(0.95);
      }
      checked += 1;
    }
    expect(checked).toBe(271);
  });

  test("client PDF verification accepts repaired geometry and rejects the superseded one", async () => {
    const id = "0606-2016-june-12-q5";
    const entry = entries[id];
    const signed = printGeometryForSignedAssets("igcse-additional", id, "answer", [`igcse-additional/${entry.newPaths[0]}`]);
    const question = {
      id, bankSlug: "igcse-additional", markschemeImages: ["https://example.test/a.webp"], questionImages: [],
      markschemePrintSizesPt: signed.printSizesPt, markschemePrintSegments: signed.printSegments, markschemeRasterSizesPx: signed.rasterSizesPx,
    } as unknown as PdfExportQuestion;
    await expect(verify0606PdfMetadata(question, "answer", 0)).resolves.toBeUndefined();
    const historical = historicalGeometry[id][1];
    const stale = { ...question, markschemePrintSizesPt: [historical.physicalSizePt], markschemeRasterSizesPx: [historical.imageDimensions] } as PdfExportQuestion;
    await expect(verify0606PdfMetadata(stale, "answer", 0)).rejects.toThrow();
  });

  test("upload log: every superseded live object matched and every new object verified on its stores", () => {
    type Row = { store: string; key: string; sha256: string; bytes: number; status: string; publicUrlVerified?: boolean };
    const rows = readFileSync("docs/0606-ms-right-edge-upload-log.jsonl", "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as Row);
    const byStore = (store: string) => new Map(rows.filter((row) => row.store === store).map((row) => [row.key, row]));
    const superseded = byStore("r2-private-superseded");
    for (const [, entry] of Object.entries(entries)) {
      entry.newPaths.forEach((path, i) => {
        if (path === entry.oldPaths[i]) return;
        const row = superseded.get(`igcse-additional/${entry.oldPaths[i]}`);
        expect(row?.status).toBe("matched");
        expect(row?.sha256).toBe(entry.oldSha256[i]);
      });
    }
    const required: [string, (o: StorageObject) => boolean, (o: StorageObject) => string][] = [
      ["r2-private", () => true, (o) => o.objectKey],
      ["supabase", () => true, (o) => o.objectKey],
      ["r2-public-free", (o) => o.freeYear, (o) => `images/${o.objectKey}`],
    ];
    for (const [store, needed, keyOf] of required) {
      const verified = byStore(store);
      const objects = storage.objects.filter(needed);
      expect(verified.size).toBe(objects.length);
      for (const object of objects) {
        const row = verified.get(keyOf(object));
        expect(row).toMatchObject({ status: "verified", sha256: object.sha256, bytes: object.bytes });
        if (store === "r2-public-free") expect(row?.publicUrlVerified).toBe(true);
      }
    }
  });
});
