import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const expected = {
  "ib-chemistry-hl": [1083, 789, 1872], "ib-chemistry-sl": [810, 602, 1412],
  "ib-physics-hl": [1111, 764, 1875], "ib-physics-sl": [774, 540, 1314],
  "ib-biology-hl": [1139, 772, 1911], "ib-biology-sl": [936, 612, 1548],
};

describe("IB 2016–2019 science extension candidate", () => {
  it("has exact base, extension, combined counts and year closure", () => {
    for (const [bank, [base, extension, combined]] of Object.entries(expected)) {
      const runtime = JSON.parse(fs.readFileSync(path.join(root, "src/data/raw", `${bank}.json`), "utf8"));
      expect(runtime.questions).toHaveLength(combined);
      expect(runtime.questions.filter((q: { year: number }) => q.year < 2020)).toHaveLength(extension);
      expect(runtime.questions.filter((q: { year: number }) => q.year >= 2020)).toHaveLength(base);
      expect(runtime.years).toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
      expect(new Set(runtime.questions.map((q: { id: string }) => q.id)).size).toBe(combined);
      expect(runtime.extensionRelease.combinedQuestionCount).toBe(combined);
    }
  });

  it("pins source commits, sealed receipts, and create-only manifests", () => {
    const pins = JSON.parse(fs.readFileSync(path.join(root, "docs/ib-science-extension/candidate-seal.json"), "utf8"));
    expect(pins.status).toBe("pending_upload");
    for (const bank of Object.keys(expected)) {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, "docs/ib-science-storage", `${bank}.pending-upload-manifest.json`), "utf8"));
      expect(manifest.upload).toBe(false);
      expect(manifest.prefix).toBe(`${bank}/`);
      expect(manifest.assets.every((a: { sha256: string; byteSize: number; sourcePath: string }) => /^[a-f0-9]{64}$/.test(a.sha256) && a.byteSize > 0 && !a.sourcePath.includes(".."))).toBe(true);
    }
  });
});
