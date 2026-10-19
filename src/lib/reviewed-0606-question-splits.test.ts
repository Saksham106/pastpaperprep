import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { reviewed0606SplitMarks, reviewed0606SplitQuestionPaths } from "@/lib/reviewed-0606-question-splits";
import { printGeometryForSignedAssets } from "@/lib/print-geometry";
import { loadBankQuestions } from "@/lib/question-loader";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";

const QID = "0606-2024-june-22-q10";
const splits = JSON.parse(readFileSync("src/data/reviewed-0606-question-splits.json", "utf8"));
const entry = splits.entries[QID];
const manifestBytes = readFileSync("data/storage/0606-question-splits.manifest.json");
const manifest = JSON.parse(manifestBytes.toString());
const raw = JSON.parse(readFileSync("src/data/raw/igcse-additional.json", "utf8"));
const row = raw.questions.find((q: { id: string }) => q.id === QID);
const research = "/Users/sakshamgoel/Documents/ProjectsInternships/research/0606-2024-june-22-q11-split";
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

describe("reviewed 0606 question split", () => {
  test("exact cohort: Q10 of 0606-2024-june-22 only, one new object; Q11 is held out", () => {
    expect(Object.keys(splits.entries)).toEqual([QID]);
    expect(manifest.objects).toEqual([{ objectKey: `igcse-additional/${entry.newPaths[0]}`, sha256: entry.sha256[0], bytes: manifest.objectBytes }]);
    expect(entry.held).toMatchObject({ id: "0606-2024-june-22-q11", number: 11, marks: 8, sourcePage: 15 });
    expect(raw.questions.some((q: { id: string }) => q.id === entry.held.id)).toBe(false);
  });

  test("binds the raw row exactly: stitched crop, 16 marks and the delivered text", () => {
    expect(row.questionImages).toEqual(entry.oldPaths);
    expect(row.marks).toBe(16);
    expect(sha(row.accessibleText)).toBe(entry.accessibleText.oldSha256);
    expect(row.accessibleText).toContain("binomial expansion");
    expect(entry.accessibleText.text).not.toMatch(/binomial|[\u0000-\u001f]/);
    expect(() => reviewed0606SplitQuestionPaths("igcse-additional", QID, ["questions/stale.webp"])).toThrow(/disagrees/);
    expect(() => reviewed0606SplitMarks("igcse-additional", QID, 8)).toThrow(/disagrees/);
  });

  test("the loader serves the page-14 segment, the printed 8 marks and the reviewed text; nothing else moves", async () => {
    const before = JSON.stringify(raw);
    const questions = await loadBankQuestions("igcse-additional");
    const q = questions.find((x) => x.id === QID)!;
    expect(q.questionAssetPaths).toEqual([`igcse-additional/${entry.newPaths[0]}`]);
    expect(q.marks).toBe(8);
    expect(q.accessibleText).toBe(entry.accessibleText.text);
    expect(metadataFromRaw(row, { bank: "igcse-additional" })).toMatchObject({ marks: 8, questionImageCount: 1 });
    const paper = questions.filter((x) => x.id.startsWith("0606-2024-june-22-"));
    expect(paper.reduce((n, x) => n + (x.marks ?? 0), 0)).toBe(80 - entry.held.marks);
    for (const x of questions) if (x.id !== QID) expect(x.questionAssetPaths.some((p) => p.includes("0606-question-split"))).toBe(false);
    expect(JSON.stringify(raw)).toBe(before);
  });

  test("print geometry is the pinned page-14 segment of the historical receipt", () => {
    const historical = JSON.parse(readFileSync("src/data/print-geometry-0606.json", "utf8")).entries[QID][0];
    expect(entry.printGeometry.segments).toEqual([historical.segments[0]]);
    expect(entry.printGeometry.imageDimensions).toEqual([historical.imageDimensions[0], historical.segments[0][1]]);
    const g = printGeometryForSignedAssets("igcse-additional", QID, "question", [`https://x.test/igcse-additional/${entry.newPaths[0]}`]);
    expect(g.printSizesPt).toEqual([entry.printGeometry.physicalSizePt]);
    expect(g.printSegments[0]).toEqual([{ sourceY: 0, sourceHeight: 1599, physicalHeightPt: historical.segments[0][2], sourcePage: 14 }]);
  });

  test("sealed remote receipt binds the immutable object and the exact manifest", () => {
    const receipt = JSON.parse(readFileSync("data/storage/0606-question-splits.receipt.json", "utf8"));
    expect(receipt.state).toBe("verified_readback");
    expect(receipt.manifestSha256).toBe(createHash("sha256").update(manifestBytes).digest("hex"));
    expect(receipt.records).toEqual(manifest.objects.map((o: { objectKey: string; sha256: string; bytes: number }) => ({ ...o, contentType: receipt.contentTypeObserved ? "image/webp" : null })));
  });

  test.skipIf(!existsSync(research))("builder is reproducible from the research package", () => {
    execFileSync("node", ["scripts/build-reviewed-0606-question-splits.mjs", research, "--check"], { stdio: "pipe" });
  });
});
