import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import repairs from "@/data/reviewed-0580-core-crop-repairs.json";
import questionSplits0580 from "@/data/reviewed-0580-question-splits.json";
import repairGeometry from "@/data/print-geometry-0580-core-crop-repairs.json";
import historicalGeometry from "@/data/print-geometry-0580.json";
import mathsRepairs from "@/data/reviewed-maths-source-answer-repairs.json";
import { loadBankQuestions } from "@/lib/question-loader";
import { normalizeBankQuestions } from "@/lib/questions";
import { printGeometryForSignedAssets } from "@/lib/print-geometry";
import { reviewed0580CoreQuestionPaths } from "@/lib/reviewed-0580-core-crop-repairs";

type Row = { id: string; questionImages: string[]; markschemeImages: string[]; [key: string]: unknown };
type Entry = { oldPaths: string[]; oldSha256: string[]; newPaths: string[]; sha256: string[]; defects: string[] };
type GeometryEntry = [string, string, number, number, number, number, [number, number, number, number, 0 | 1][]];

const rawText = readFileSync("src/data/raw/igcse.json", "utf8");
const raw = JSON.parse(rawText) as { questions: Row[] };
const byId = new Map(raw.questions.map((row) => [row.id, row]));
const entries = repairs.questions as Record<string, Entry>;
const ids = Object.keys(entries);
const historical = historicalGeometry.entries as unknown as Record<string, [GeometryEntry, GeometryEntry]>;
const repaired = repairGeometry.entries as unknown as Record<string, [GeometryEntry, null]>;
const plan = JSON.parse(readFileSync("docs/igcse-0580-core-crop-repairs-r2-upload-plan.json", "utf8")) as {
  status: string; objectCount: number; totalBytes: number; objectPrefix: string;
  upload: { readbackLog: string; readbackLogSha256: string; objects: number; createdNew: number; overwritten: number };
  objects: { key: string; questionId: string; sha256: string; bytes: number; replacesKey: string; replacesSha256: string }[];
};
const LOG_SHA256 = "d5498f00151311fad67a3bc5e08d382c5d1c8927f08729c8201ffe645a6ea4e7";

describe("reviewed 0580 Core 2021-2025 crop repairs", () => {
  test("75 live Core question crops map from their exact released path to a new immutable key", () => {
    expect(repairs.count).toBe(75);
    expect(ids).toHaveLength(75);
    expect(repairs.namespace).toMatch(/^repairs\/0580-core-crops-v1-[a-f0-9]{16}$/);
    expect(repairs.namespace.endsWith(repairs.source.receiptSha256.slice(0, 16))).toBe(true);
    const defects = new Map<string, number>();
    for (const [id, entry] of Object.entries(entries)) {
      expect(id).toMatch(/^0580-202[1-5]-(march|june|november)-[13][123]-q\d+$/);
      const row = byId.get(id)!;
      expect(row.questionImages).toEqual([`core-questions/${id}.webp`]);
      expect(entry.oldPaths).toEqual(row.questionImages);
      // The replaced bytes are the released crop pinned by the historical print-geometry receipt.
      expect(entry.oldSha256).toEqual([historical[id][0][1]]);
      expect(entry.newPaths).toEqual([`${repairs.namespace}/${entry.sha256[0]}.webp`]);
      expect(entry.sha256[0]).not.toBe(entry.oldSha256[0]);
      for (const defect of entry.defects) defects.set(defect, (defects.get(defect) ?? 0) + 1);
    }
    expect(Object.fromEntries(defects)).toEqual({
      trailing_furniture_page: 43,
      answer_line_cut_by_footer_margin: 29,
      answer_line_split_at_question_boundary: 2,
      text_cut_at_render_edge: 1,
    });
  });

  test("the live loader serves the repaired question crops and leaves every other path unchanged", async () => {
    const before = rawText;
    const loaded = new Map((await loadBankQuestions("igcse")).map((question) => [question.id, question]));
    const unrepaired = new Map(normalizeBankQuestions("igcse", raw.questions as never[]).map((question) => [question.id, question]));
    for (const [id, question] of loaded) {
      // The reviewed 0580 question splits (reviewed-0580-question-splits.test.ts) also serve new question crops.
      const entry = entries[id] ?? (questionSplits0580.entries as Record<string, { newPaths: string[] }>)[id];
      expect(question.questionAssetPaths).toEqual(entry ? entry.newPaths.map((path) => `igcse/${path}`) : unrepaired.get(id)?.questionAssetPaths);
      expect(question.questionImageCount).toBe(unrepaired.get(id)?.questionImageCount);
    }
    expect(readFileSync("src/data/raw/igcse.json", "utf8")).toBe(before);
  });

  test("mark-scheme repairs stay lane-only: those rows keep the reviewed maths-source grid images", () => {
    for (const id of ["0580-2022-june-31-q5", "0580-2023-november-31-q9", "0580-2025-june-33-q20",
      "0580-2025-november-12-q6", "0580-2025-november-12-q12", "0580-2025-november-32-q5"]) {
      expect((mathsRepairs.igcse as Record<string, unknown>)[id]).toBeTruthy();
      expect(entries[id]).toBeUndefined();
    }
  });

  test("stale or tampered rows fail closed", () => {
    const [id] = ids;
    expect(() => reviewed0580CoreQuestionPaths("igcse", id, ["core-questions/other.webp"])).toThrow(/disagrees/);
    expect(reviewed0580CoreQuestionPaths("igcse-additional", id, ["x.webp"])).toEqual(["x.webp"]);
    expect(reviewed0580CoreQuestionPaths("igcse", "0580-2016-june-21-q1", ["questions/a.webp"])).toEqual(["questions/a.webp"]);
  });

  test("repaired images carry verified print geometry keyed only to their new paths", () => {
    expect(Object.keys(repaired).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      const [entry, answer] = repaired[id];
      expect(answer).toBeNull();
      expect(entry[0]).toBe(entries[id].newPaths[0]);
      expect(entry[1]).toBe(entries[id].sha256[0]);
      expect(entry[6].every((segment) => segment[4] === 1)).toBe(true);
      const geometry = printGeometryForSignedAssets("igcse", id, "question", [`igcse/${entry[0]}`]);
      expect(geometry.printSizesPt).toEqual([[entry[4], entry[5]]]);
      expect(geometry.rasterSizesPx).toEqual([[entry[2], entry[3]]]);
      // The released path keeps its historical geometry (and its hidden blank segments).
      const old = printGeometryForSignedAssets("igcse", id, "question", [`igcse/core-questions/${id}.webp`]);
      expect(old.printSizesPt).toEqual([[historical[id][0][4], historical[id][0][5]]]);
    }
    // Every trailing blank page the exporter used to hide is now absent from the image itself.
    for (const [id, entry] of Object.entries(entries)) {
      if (entry.defects.includes("trailing_furniture_page")) {
        expect(historical[id][0][6].some((segment) => segment[4] === 0)).toBe(true);
      }
    }
  });

  test("every repaired object was created new in R2 and read back byte-for-byte", () => {
    expect(plan.status).toBe("UPLOADED AND VERIFIED");
    expect(plan.objectCount).toBe(75);
    expect(plan.objectPrefix).toBe(`igcse/${repairs.namespace}/`);
    const text = readFileSync(plan.upload.readbackLog, "utf8");
    expect(createHash("sha256").update(text).digest("hex")).toBe(plan.upload.readbackLogSha256);
    expect(plan.upload.readbackLogSha256).toBe(LOG_SHA256);
    const log = new Map(text.split("\n").filter(Boolean).map((line) => {
      const row = JSON.parse(line) as { key: string; sha256: string; bytes: number; status: string; existedBefore: boolean };
      return [row.key, row];
    }));
    expect(log.size).toBe(75);
    expect(plan.upload).toMatchObject({ objects: 75, createdNew: 75, overwritten: 0 });
    expect(plan.objects.reduce((sum, object) => sum + object.bytes, 0)).toBe(plan.totalBytes);
    for (const object of plan.objects) {
      const entry = entries[object.questionId];
      expect(object.key).toBe(`igcse/${entry.newPaths[0]}`);
      expect(object.replacesKey).toBe(`igcse/${entry.oldPaths[0]}`);
      expect(object.replacesSha256).toBe(entry.oldSha256[0]);
      expect(log.get(object.key)).toMatchObject({ sha256: object.sha256, bytes: object.bytes, status: "verified", existedBefore: false });
    }
    // Before upload, every superseded live object was read back and matched its released crop.
    const superseded = new Map(readFileSync("docs/igcse-0580-core-crop-repairs-r2-superseded-readback.jsonl", "utf8")
      .split("\n").filter(Boolean).map((line) => {
        const row = JSON.parse(line) as { key: string; sha256: string; status: string; supersededBy: string };
        return [row.key, row];
      }));
    expect(superseded.size).toBe(75);
    for (const object of plan.objects) {
      expect(superseded.get(object.replacesKey)).toMatchObject({ sha256: object.replacesSha256, status: "matches-released", supersededBy: object.key });
    }
  });
});
