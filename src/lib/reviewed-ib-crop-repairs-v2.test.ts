import { describe, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import type { BankSlug } from "@/lib/banks";
import { normalizeBankQuestions } from "@/lib/questions";
import { reviewedMarkschemePaths } from "@/lib/reviewed-mcq-answer-repairs";
import { rotatedChemistryMarkschemePaths } from "@/lib/reviewed-ib-chemistry-rotated-ms";
import { reviewedIbQuestionPaths } from "@/lib/reviewed-ib-shared-stimulus";
import { reviewedIbBoundaryMarks, reviewedIbBoundaryPaths } from "@/lib/reviewed-ib-question-boundaries";
import { reviewed0606ContinuationGeometry, reviewed0606ContinuationPaths } from "@/lib/reviewed-0606-ms-continuation-repairs";
import { printGeometryForSignedAssets } from "@/lib/print-geometry";
import { isR2OnlyObjectPath } from "@/lib/private-asset-providers";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";

type Entry = { oldPaths: string[]; oldSha256: string[]; newPaths: string[]; sha256: string[]; marks?: { old: number; new: number } };
type Overlay = { namespace: string; banks: Record<string, Record<string, Entry>> };
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const chem = json("src/data/reviewed-ib-chemistry-rotated-ms-repairs.json") as Overlay;
const stimulus = json("src/data/reviewed-ib-shared-stimulus-repairs-v2.json") as Overlay & { reuses: string };
const stimulusV1 = json("src/data/reviewed-ib-shared-stimulus-repairs.json") as Overlay;
const boundary = json("src/data/reviewed-ib-question-boundary-repairs-v2.json") as Overlay;
const additional = json("src/data/reviewed-0606-ms-continuation-repairs.json") as { namespace: string; entries: Record<string, Entry> };
type ManifestObject = { objectKey: string; path: string; sha256: string; bytes: number; contentType: string; freeYear: boolean; questionIds: string[] };
const manifest = (name: string) => json(`data/storage/${name}.manifest.json`) as { namespace: string; objectCount: number; freeObjectCount: number; objects: ManifestObject[] };
// The build package (scripts/ib-crop-repairs-v2/build_crops.py output); kept in research/ once the upload is approved.
const PACKAGE = process.env.IB_CROP_REPAIRS_V2_PACKAGE ?? "/Users/sakshamgoel/Documents/ProjectsInternships/research/ib-crop-repairs-v2";

const raw = new Map<string, Map<string, Record<string, unknown> & { id: string; questionImages: string[]; marks: number }>>();
function rows(bank: string) {
  if (!raw.has(bank)) raw.set(bank, new Map(json(`src/data/raw/${bank}.json`).questions.map((q: { id: string }) => [q.id, q])));
  return raw.get(bank)!;
}
const key = (bank: string, p: string) => `${bank}/${p.replace(/^https:\/\/saksham106\.github\.io\/ib-[a-z]+-topic-practice\//, "")}`;
const normalized = (bank: BankSlug, ids: string[]) => {
  const all = rows(bank);
  return new Map(normalizeBankQuestions(bank, ids.map((id) => all.get(id)! as never), { economicsAssetMode: "private", applyReviewedBlankPages: bank === "igcse-additional" }).map((q) => [q.id, q]));
};

// The held explanations this repair unblocks (docs/ib-crop-repairs-v2.md).
const HELD_CHEM_MS: Record<string, string[]> = {
  "ib-chemistry-hl": [
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `2017-may-tz1-hl-p2-q${n}`), ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `2017-november-tz0-hl-p2-q${n}`),
    "2017-november-tz0-hl-p3-q12", "2017-may-tz1-hl-p3-q2", ...[2, 16, 17, 18, 19, 20, 21, 22].map((n) => `2018-november-tz0-hl-p3-q${n}`),
  ],
  "ib-chemistry-sl": ["2017-may-tz1-sl-p3-q2", "2017-may-tz1-sl-p3-q9", "2017-may-tz2-sl-p3-q18", "2018-may-tz1-sl-p3-q7", "2018-may-tz1-sl-p3-q8", "2018-may-tz1-sl-p3-q9"],
};

describe("IB Chemistry rotated mark-scheme re-cuts", () => {
  test("exact cohort: every answer crop of the 26 remaining rotated papers, one new object per crop", () => {
    expect(chem.namespace).toMatch(/^repairs\/ib-chem-rotated-ms-v1-[a-f0-9]{16}$/);
    const entries = Object.entries(chem.banks).flatMap(([bank, e]) => Object.entries(e).map(([id, x]) => ({ bank, id, ...x })));
    expect(entries.length).toBe(387);
    const papers = new Set(entries.map((e) => e.id.replace(/-q\d+$/, "")));
    expect(papers.size).toBe(26);
    expect([...papers].every((p) => /^(2017|2018)-|^2019-may-tz2-(hl-p3|sl-p2)$/.test(p))).toBe(true);
    for (const e of entries) e.newPaths.forEach((p, i) => expect(p).toBe(`${chem.namespace}/${e.sha256[i]}.webp`));
    const m = manifest("ib-chemistry-rotated-ms-repairs");
    expect(m.objects.map((o) => o.objectKey)).toEqual([...new Set(entries.flatMap((e) => e.newPaths.map((p) => `${e.bank}/${p}`)))].sort());
    expect([m.objectCount, m.freeObjectCount]).toEqual([600, 600]);
    for (const [bank, ids] of Object.entries(HELD_CHEM_MS)) for (const id of ids) expect(chem.banks[bank][id]).toBeDefined();
    // The 2019 May TZ2 HL Paper 2 crops were already re-cut (docs/ib-chemistry-hl-2019-p2.md).
    expect(Object.keys(chem.banks["ib-chemistry-hl"]).some((id) => id.startsWith("2019-may-tz2-hl-p2"))).toBe(false);
  });

  test("the loader and bank index serve the re-cuts; other answers are untouched", () => {
    for (const bank of ["ib-chemistry-hl", "ib-chemistry-sl"] as BankSlug[]) {
      const all = [...rows(bank).keys()];
      const loaded = normalized(bank, all);
      let changed = 0;
      for (const id of all) {
        const row = rows(bank).get(id)! as { officialMarkscheme?: { images?: string[] }; markschemeImages?: string[] };
        const entry = chem.banks[bank][id];
        const served = [...new Set([...(row.markschemeImages ?? []), ...(row.officialMarkscheme?.images ?? [])])];
        if (!entry) {
          expect(rotatedChemistryMarkschemePaths(bank, id, served)).toBeNull();
          continue;
        }
        changed += 1;
        expect(served).toEqual(entry.oldPaths);
        expect(reviewedMarkschemePaths(bank, id, served)).toEqual(entry.newPaths);
        expect(loaded.get(id)!.markschemeAssetPaths).toEqual(entry.newPaths.map((p) => `${bank}/${p}`));
        expect(metadataFromRaw(rows(bank).get(id), { bank, normalizedProduction: true }).markschemeImageCount).toBe(entry.newPaths.length);
      }
      expect(changed).toBe(Object.keys(chem.banks[bank]).length);
    }
  });

  test("stale paths fail closed", () => {
    const [id, entry] = Object.entries(chem.banks["ib-chemistry-sl"])[0];
    expect(() => rotatedChemistryMarkschemePaths("ib-chemistry-sl", id, [...entry.oldPaths, "markschemes/extra.webp"])).toThrow(/disagrees/);
  });
});

describe("IB Chemistry shared stimuli (v2)", () => {
  test("exact cohort; 2017 May TZ1 Paper 3 Q2-Q5 reuse the v1 data-block object", () => {
    expect(stimulus.namespace).toMatch(/^repairs\/ib-shared-stimulus-v2-[a-f0-9]{16}$/);
    expect(stimulus.reuses).toBe(stimulusV1.namespace);
    expect(Object.keys(stimulus.banks["ib-chemistry-hl"]).sort()).toEqual([
      "2017-may-tz1-hl-p3-q2", "2017-may-tz1-hl-p3-q3", "2017-may-tz1-hl-p3-q4", "2017-may-tz1-hl-p3-q5",
      "2017-may-tz2-hl-p1-q17", "2017-may-tz2-hl-p1-q18", "2017-may-tz2-hl-p1-q19",
      "2019-november-tz0-hl-p1-q13", "2019-november-tz0-hl-p1-q14", "2019-november-tz0-hl-p1-q15",
    ]);
    expect(Object.keys(stimulus.banks["ib-chemistry-sl"]).sort()).toEqual([
      "2017-may-tz1-sl-p3-q2", "2017-may-tz1-sl-p3-q3", "2017-may-tz1-sl-p3-q4", "2017-may-tz1-sl-p3-q5",
      "2017-may-tz2-sl-p1-q15", "2017-may-tz2-sl-p1-q16", "2017-may-tz2-sl-p1-q17",
      "2019-november-tz0-sl-p1-q12", "2019-november-tz0-sl-p1-q13", "2019-november-tz0-sl-p1-q14",
    ]);
    for (const level of ["hl", "sl"]) {
      const bank = `ib-chemistry-${level}`;
      const block = stimulusV1.banks[bank][`2017-may-tz1-${level}-p3-q1`].newPaths[0];
      for (const n of [2, 3, 4, 5]) expect(stimulus.banks[bank][`2017-may-tz1-${level}-p3-q${n}`].newPaths[0]).toBe(block);
    }
    const s = stimulus.banks;
    expect(s["ib-chemistry-sl"]["2019-november-tz0-sl-p1-q13"].newPaths[0]).toBe(s["ib-chemistry-sl"]["2019-november-tz0-sl-p1-q14"].newPaths[0]);
    expect(s["ib-chemistry-hl"]["2017-may-tz2-hl-p1-q18"].newPaths[0]).toBe(s["ib-chemistry-hl"]["2017-may-tz2-hl-p1-q19"].newPaths[0]);
    // A crop that held only the stimulus leaves the question before it.
    expect(s["ib-chemistry-sl"]["2019-november-tz0-sl-p1-q12"].newPaths).toEqual(s["ib-chemistry-sl"]["2019-november-tz0-sl-p1-q12"].oldPaths.slice(0, 1));
    expect(s["ib-chemistry-hl"]["2017-may-tz2-hl-p1-q17"].newPaths).toEqual(s["ib-chemistry-hl"]["2017-may-tz2-hl-p1-q17"].oldPaths.slice(0, 1));
    const m = manifest("ib-shared-stimulus-repairs-v2");
    expect(m.objectCount).toBe(6);
  });

  test("the loader and bank index serve every mapping", () => {
    for (const [bank, entries] of Object.entries(stimulus.banks) as [BankSlug, Record<string, Entry>][]) {
      const loaded = normalized(bank, Object.keys(entries));
      for (const [id, entry] of Object.entries(entries)) {
        expect(rows(bank).get(id)!.questionImages).toEqual(entry.oldPaths);
        expect(reviewedIbQuestionPaths(bank, id, entry.oldPaths)).toEqual(entry.newPaths);
        expect(loaded.get(id)!.questionAssetPaths).toEqual(entry.newPaths.map((p) => key(bank, p)));
        expect(metadataFromRaw(rows(bank).get(id), { bank, normalizedProduction: true }).questionImageCount).toBe(entry.newPaths.length);
      }
    }
    const [id, entry] = Object.entries(stimulus.banks["ib-chemistry-sl"])[0];
    expect(() => reviewedIbQuestionPaths("ib-chemistry-sl", id, entry.oldPaths.slice(1))).toThrow(/disagrees/);
  });
});

describe("IB Physics Paper 1 question boundaries (v2)", () => {
  test("seven pairs re-cut at the real anchor; marks unchanged", () => {
    expect(boundary.namespace).toMatch(/^repairs\/ib-question-boundary-v2-[a-f0-9]{16}$/);
    expect(Object.keys(boundary.banks["ib-physics-sl"]).sort()).toEqual([
      "2017-may-tz1-sl-p1-q18", "2017-may-tz1-sl-p1-q19", "2017-may-tz2-sl-p1-q5", "2017-may-tz2-sl-p1-q6",
      "2018-may-tz1-sl-p1-q2", "2018-may-tz1-sl-p1-q3", "2018-may-tz2-sl-p1-q12", "2018-may-tz2-sl-p1-q13",
    ]);
    expect(Object.keys(boundary.banks["ib-physics-hl"]).sort()).toEqual([
      "2017-may-tz1-hl-p1-q15", "2017-may-tz1-hl-p1-q16", "2018-may-tz1-hl-p1-q1", "2018-may-tz1-hl-p1-q2", "2018-may-tz1-hl-p1-q5", "2018-may-tz1-hl-p1-q6",
    ]);
    expect(manifest("ib-question-boundary-repairs-v2").objectCount).toBe(14);
    for (const [bank, entries] of Object.entries(boundary.banks) as [BankSlug, Record<string, Entry>][]) {
      const loaded = normalized(bank, Object.keys(entries));
      for (const [id, entry] of Object.entries(entries)) {
        expect(entry.marks).toEqual({ old: 1, new: 1 });
        expect(reviewedIbBoundaryMarks(bank, id, 1)).toBe(1);
        expect(reviewedIbBoundaryPaths(bank, id, entry.oldPaths)).toEqual(entry.newPaths);
        expect(loaded.get(id)!.questionAssetPaths).toEqual(entry.newPaths.map((p) => key(bank, p)));
        expect(loaded.get(id)!.marks).toBe(1);
      }
    }
    expect(() => reviewedIbBoundaryMarks("ib-physics-sl", "2018-may-tz1-sl-p1-q2", 2)).toThrow(/disagrees/);
  });
});

describe("0606 mark-scheme continuation rows", () => {
  test("adds the missing rows after the served crops' own overlays and keeps every served crop", () => {
    expect(Object.keys(additional.entries).sort()).toEqual(["0606-2017-june-21-q9", "0606-2019-november-23-q6"]);
    const loaded = normalized("igcse-additional", Object.keys(additional.entries));
    const q6 = additional.entries["0606-2019-november-23-q6"];
    expect(q6.newPaths[0]).toBe("markschemes/0606-2019-november-23-q6.webp");
    const q9 = additional.entries["0606-2017-june-21-q9"];
    expect(q9.newPaths[1]).toMatch(/^repairs\/maths-source-grid-v1-/);
    for (const [id, entry] of Object.entries(additional.entries)) {
      const row = rows("igcse-additional").get(id)! as unknown as { markschemeImages: string[] };
      const served = reviewedMarkschemePaths("igcse-additional", id, row.markschemeImages);
      expect(reviewed0606ContinuationPaths("igcse-additional", id, served)).toEqual(entry.newPaths);
      expect(loaded.get(id)!.markschemeAssetPaths).toEqual(entry.newPaths.map((p) => `igcse-additional/${p}`));
      expect(metadataFromRaw(row, { bank: "igcse-additional", normalizedProduction: true }).markschemeImageCount).toBe(entry.newPaths.length);
      const added = entry.newPaths.find((p) => p.startsWith(`${additional.namespace}/`))!;
      const geometry = reviewed0606ContinuationGeometry(id, `igcse-additional/${added}`)!;
      const signed = printGeometryForSignedAssets("igcse-additional", id, "answer", [`igcse-additional/${added}`]);
      expect(signed.printSizesPt[0]).toEqual(geometry.physicalSizePt);
      expect(signed.printSegments[0]!.reduce((n, s) => n + s.sourceHeight, 0)).toBe(geometry.imageDimensions[1]);
      expect(() => reviewed0606ContinuationPaths("igcse-additional", id, ["markschemes/stale.webp"])).toThrow(/disagrees/);
    }
    const m = manifest("0606-ms-continuation-repairs");
    expect(m.objects.map((o) => [o.questionIds[0], o.freeYear])).toEqual(expect.arrayContaining([["0606-2017-june-21-q9", true], ["0606-2019-november-23-q6", false]]));
  });
});

describe("storage", () => {
  test("IB repair objects sign from R2 only; the 0606 objects keep the bank's Supabase previews", () => {
    for (const name of ["ib-chemistry-rotated-ms-repairs", "ib-shared-stimulus-repairs-v2", "ib-question-boundary-repairs-v2"]) {
      for (const o of manifest(name).objects) {
        expect(isR2OnlyObjectPath(o.objectKey)).toBe(true);
        expect(o.contentType).toBe("image/webp");
      }
    }
    for (const o of manifest("0606-ms-continuation-repairs").objects) expect(isR2OnlyObjectPath(o.objectKey)).toBe(false);
  });

  test.skipIf(!existsSync(`${PACKAGE}/repairs.json`))("overlays and manifests replay from the build package", () => {
    execFileSync("node", ["scripts/build-reviewed-ib-crop-repairs-v2.mjs", PACKAGE, "--check"], { stdio: "pipe" });
  });
});
