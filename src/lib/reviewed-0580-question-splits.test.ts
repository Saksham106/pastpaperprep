import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { reviewed0580SplitMarks, reviewed0580SplitQuestionPaths } from "@/lib/reviewed-0580-question-splits";
import { printGeometryForSignedAssets } from "@/lib/print-geometry";
import { loadBankQuestions } from "@/lib/question-loader";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";

const PAPER = "0580-2020-june-41";
const IDS = [`${PAPER}-q6`, `${PAPER}-q7`];
const splits = JSON.parse(readFileSync("src/data/reviewed-0580-question-splits.json", "utf8"));
const manifestBytes = readFileSync("data/storage/0580-question-splits.manifest.json");
const manifest = JSON.parse(manifestBytes.toString());
const raw = JSON.parse(readFileSync("src/data/raw/igcse.json", "utf8"));
const historical = JSON.parse(readFileSync("src/data/print-geometry-0580.json", "utf8")).entries;
const source = "/Users/sakshamgoel/Documents/ProjectsInternships/igcse-0580-topic-practice";
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const row = (id: string) => raw.questions.find((q: { id: string }) => q.id === id);

describe("reviewed 0580 question splits", () => {
  test("exact cohort: Q6 and Q7 of 0580-2020-june-41, one new object each", () => {
    expect(Object.keys(splits.entries)).toEqual(IDS);
    expect(manifest.objects.map((o: { objectKey: string }) => o.objectKey)).toEqual(IDS.map((id) => `igcse/${splits.entries[id].newPaths[0]}`));
    expect(splits.source.override.question).toEqual({ 7: [12, 60.62] });
  });

  test("binds the raw rows exactly: served crops, marks 3 and 24 and the delivered text", () => {
    for (const id of IDS) {
      const entry = splits.entries[id];
      expect(row(id).questionImages).toEqual(entry.oldPaths);
      expect(historical[id][0].slice(0, 2)).toEqual([entry.oldPaths[0], entry.oldSha256[0]]);
      expect(sha(row(id).accessibleText)).toBe(entry.accessibleText.oldSha256);
      expect(entry.accessibleText.text.startsWith(`${id.split("-q").at(-1)} `)).toBe(true);
    }
    expect([row(IDS[0]).marks, row(IDS[1]).marks]).toEqual([3, 24]);
    // The served Q7 text opens with the 6(c) grid labels and carries 6(d).
    expect(row(IDS[1]).accessibleText).toMatch(/^0 2 4 6 .*\(d\) He makes \$40 profit/);
    expect(splits.entries[IDS[0]].accessibleText.text).toMatch(/\(d\) He makes \$40 profit on each basket/);
    expect(splits.entries[IDS[1]].accessibleText.text).not.toMatch(/baskets|mats/);
    expect(() => reviewed0580SplitQuestionPaths("igcse", IDS[0], ["questions/stale.webp"])).toThrow(/disagrees/);
    expect(() => reviewed0580SplitMarks("igcse", IDS[1], 17)).toThrow(/disagrees/);
  });

  test("the loader serves the re-cut crops, the printed marks and the transcripts; nothing else moves", async () => {
    const before = JSON.stringify(raw);
    const questions = await loadBankQuestions("igcse");
    const byId = new Map(questions.map((q) => [q.id, q]));
    for (const id of IDS) {
      const q = byId.get(id)!;
      expect(q.questionAssetPaths).toEqual([`igcse/${splits.entries[id].newPaths[0]}`]);
      expect(q.accessibleText).toBe(splits.entries[id].accessibleText.text);
    }
    expect([byId.get(IDS[0])!.marks, byId.get(IDS[1])!.marks]).toEqual([10, 17]);
    expect(splits.entries[IDS[0]].marks.printed).toEqual([1, 2, 5, 2]);
    expect(splits.entries[IDS[1]].marks.printed).toEqual([3, 3, 3, 2, 3, 3]);
    expect([metadataFromRaw(row(IDS[0]), { bank: "igcse" }), metadataFromRaw(row(IDS[1]), { bank: "igcse" })]).toMatchObject([{ marks: 10 }, { marks: 17 }]);
    const paper = questions.filter((q) => q.id.startsWith(`${PAPER}-`));
    expect(paper.reduce((n, q) => n + (q.marks ?? 0), 0)).toBe(130);
    for (const q of questions) if (!IDS.includes(q.id)) expect(q.questionAssetPaths.some((p) => p.includes("0580-question-split"))).toBe(false);
    expect(JSON.stringify(raw)).toBe(before);
  });

  test("print geometry covers the re-cut pages only through the new immutable path", () => {
    const q6 = splits.entries[IDS[0]].printGeometry;
    const q7 = splits.entries[IDS[1]].printGeometry;
    expect(q6[6].map((s: number[]) => s[3])).toEqual([10, 11]);
    expect(q7[6].map((s: number[]) => s[3])).toEqual([12, 13]);
    const g = printGeometryForSignedAssets("igcse", IDS[0], "question", [`https://x.test/igcse/${splits.entries[IDS[0]].newPaths[0]}`]);
    expect(g.printSizesPt).toEqual([[q6[4], q6[5]]]);
    expect(g.printSegments[0]?.map((s) => s.sourcePage)).toEqual([10, 11]);
    // The superseded crop keeps its historical geometry only under its own path.
    expect(printGeometryForSignedAssets("igcse", IDS[0], "question", [splits.entries[IDS[0]].oldPaths[0]]).printSizesPt[0]).toEqual([513, 1046.6]);
  });

  test("sealed remote receipt binds the immutable objects and the exact manifest", () => {
    const receipt = JSON.parse(readFileSync("data/storage/0580-question-splits.receipt.json", "utf8"));
    expect(receipt.state).toBe("verified_readback");
    expect(receipt.manifestSha256).toBe(createHash("sha256").update(manifestBytes).digest("hex"));
    expect(receipt.records).toEqual(manifest.objects.map((o: { objectKey: string; sha256: string; bytes: number }) => ({
      objectKey: o.objectKey, sha256: o.sha256, bytes: o.bytes, contentType: null,
    })));
  });

  test.skipIf(!existsSync(`${source}/data/crop-boundary-overrides.json`) ||
    !JSON.parse(readFileSync(`${source}/data/crop-boundary-overrides.json`, "utf8")).overrides[PAPER])(
    "builder is reproducible from the source checkout", () => {
      execFileSync("node", ["scripts/build-reviewed-0580-question-splits.mjs", source, "--check"], { stdio: "pipe" });
    });
});
