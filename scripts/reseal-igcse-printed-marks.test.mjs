import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BANKS, BASE, bankChanges, resealBank } from "./reseal-igcse-printed-marks.mjs";
import { assertPrintedMarksRepair, getIGCSERuntimeArtifact, withoutPrintedMarks } from "../src/lib/igcse-runtime.ts";

const census = JSON.parse(readFileSync("scripts/data/igcse-science-printed-marks-census.json", "utf8"));
const readBase = (file) => JSON.parse(execFileSync("git", ["show", `${BASE}:${file}`], { maxBuffer: 80_000_000 }));
const current = (bank) => JSON.parse(readFileSync(`src/data/production/${bank}.json`, "utf8"));
const env = { NEXT_PUBLIC_IGCSE_RELEASE_BANKS: "1", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const EXPECTED = { "igcse-chemistry-0620": 62, "igcse-coordinated-sciences-0654": 3 };

describe("IGCSE science printed marks reseal", () => {
  for (const bank of BANKS) {
    it(`${bank}: replays the published runtime and changes only marks/maxMarks on ${EXPECTED[bank]} rows`, () => {
      const baseline = readBase(`src/data/production/${bank}.json`);
      const result = resealBank(bank, { baseline, census });
      const published = current(bank);
      expect(result).toEqual(published);
      const changed = result.questions.filter((q, i) => JSON.stringify(q) !== JSON.stringify(baseline.questions[i]));
      expect(changed).toHaveLength(EXPECTED[bank]);
      for (const q of changed) {
        const before = baseline.questions.find((row) => row.id === q.id);
        expect(Object.keys(q).filter((key) => JSON.stringify(q[key]) !== JSON.stringify(before[key])).sort()).toEqual(["marks", "maxMarks"]);
        expect(/^[3-6]/.test(String(q.component))).toBe(true);
      }
    }, 60000);

    it(`${bank}: rebuilds the exact sealed baseline for earlier seals and loads`, () => {
      const published = current(bank);
      expect(withoutPrintedMarks(bank, published)).toEqual(readBase(`src/data/production/${bank}.json`));
      expect(() => assertPrintedMarksRepair(bank, published)).not.toThrow();
      expect(getIGCSERuntimeArtifact(bank, env).questions).toHaveLength(published.questions.length);
      const tampered = structuredClone(published);
      const [id, , printed] = published.runtimeArtifact.printedMarksRepair.changes[0];
      tampered.questions.find((q) => q.id === id).marks = printed + 1;
      expect(() => assertPrintedMarksRepair(bank, tampered)).toThrow(/finalized content mismatch/);
    }, 60000);

    it(`${bank}: private index marks follow the runtime`, () => {
      const marks = new Map(current(bank).questions.map((q) => [q.id, q.marks]));
      const index = JSON.parse(readFileSync(`src/data/private-index/${bank}.json`, "utf8"));
      expect(index.questions.every((q) => q.marks === marks.get(q.id))).toBe(true);
    });
  }

  it("every accepted paper reconciles, unresolved papers and the removed-part exception stay untouched", () => {
    const chem = current("igcse-chemistry-0620");
    expect(chem.questions.find((q) => q.id === "0620-2026-m-32-q3").marks).toBeNull();
    for (const bank of BANKS) {
      const entry = census.banks[bank];
      const marks = new Map(current(bank).questions.map((q) => [q.id, q.marks]));
      const base = new Map(readBase(`src/data/production/${bank}.json`).questions.map((q) => [q.id, q.marks]));
      for (const paper of entry.unresolvedPapers) {
        for (const [id, value] of marks) if (id.startsWith(`${paper}-q`)) expect(value, id).toBe(base.get(id));
      }
    }
    const broken = structuredClone(census);
    broken.banks["igcse-coordinated-sciences-0654"].papers["0654-2020-winter-32"].questions[6][2] += 1;
    expect(() => bankChanges("igcse-coordinated-sciences-0654", readBase("src/data/production/igcse-coordinated-sciences-0654.json"), broken)).toThrow(/do not sum/);
  });
});
