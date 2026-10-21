import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { assertPinnedReceipt, candidateContentSha256 } from "../../scripts/ib-science-receipt-contract.mjs";
import { BANK_CATALOG } from "@/lib/catalog";

const root = process.cwd();
const expected = {
  // Chemistry also holds the official May 2026 papers (HL 144, SL 109 questions, all year >= 2020), appended after the sealed rows.
  // Chemistry HL later appended its 20 2019 Paper 2 questions after the May 2026 rows (hl2019Paper2Release).
  "ib-chemistry-hl": [1083 + 144, 789 + 20, 1872 + 144 + 20], "ib-chemistry-sl": [810 + 109, 602, 1412 + 109],
  // Physics also holds the official May 2026 papers (HL 153, SL 99 questions, all year >= 2020), appended after the sealed rows.
  "ib-physics-hl": [1111 + 153, 764, 1875 + 153], "ib-physics-sl": [774 + 99, 540, 1314 + 99],
  // Biology also holds the official May 2026 papers (HL 160, SL 123 served questions, all year >= 2020; one HL question is withheld, see may2026Release.excludedFromPractice), appended after the sealed rows.
  "ib-biology-hl": [1139 + 160, 772, 1911 + 160], "ib-biology-sl": [936 + 123, 612, 1548 + 123],
};

describe("IB 2016–2019 science extension candidate", () => {
  it("has exact base, extension, combined counts and year closure", () => {
    for (const [bank, [base, extension, combined]] of Object.entries(expected)) {
      const runtime = JSON.parse(fs.readFileSync(path.join(root, "src/data/raw", `${bank}.json`), "utf8"));
      expect(runtime.questions).toHaveLength(combined);
      expect(runtime.questions.filter((q: { year: number }) => q.year < 2020)).toHaveLength(extension);
      expect(runtime.questions.filter((q: { year: number }) => q.year >= 2020)).toHaveLength(base);
      expect(runtime.years).toEqual(/^ib-(biology|chemistry|physics)/.test(bank) ? [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] : [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
      expect(new Set(runtime.questions.map((q: { id: string }) => q.id)).size).toBe(combined);
      expect(runtime.extensionRelease.combinedQuestionCount).toBe(/^ib-(biology|chemistry|physics)/.test(bank) ? runtime.may2026Release.baseQuestionCount : combined);
      if (runtime.hl2019Paper2Release) expect(runtime.hl2019Paper2Release.combinedQuestionCount).toBe(combined);
    }
  });

  it("keeps runtime paper counts and catalog metadata identical for all six banks", () => {
    for (const bank of Object.keys(expected)) {
      const runtime = JSON.parse(fs.readFileSync(path.join(root, "src/data/raw", `${bank}.json`), "utf8"));
      const catalog = BANK_CATALOG.find((entry) => entry.slug === bank);
      expect(catalog).toBeDefined();
      expect(catalog?.questionCount).toBe(runtime.questions.length);
      // Papers that hold questions: Chemistry HL lists three excluded 2019 Paper 2s (docs/ib-paper-count-gaps-2026-10-21.md).
      const withQuestions = new Set(runtime.questions.map((question: { id: string }) => question.id.replace(/-q\d+$/, "")));
      expect(catalog?.paperCount).toBe(runtime.papers.filter((paper: { id: string }) => withQuestions.has(paper.id)).length);
      expect(catalog?.years).toBe(/^ib-(biology|chemistry|physics)/.test(bank) ? "2016-2026" : "2016-2025");
    }
  });

  it("derives a non-empty P1/P2/P3 component for every extension row in canonical order", () => {
    for (const bank of Object.keys(expected)) {
      const runtime = JSON.parse(fs.readFileSync(path.join(root, "src/data/raw", `${bank}.json`), "utf8"));
      const extension = runtime.questions.filter((q: { year: number }) => q.year < 2020);
      expect(extension.every((q: { component?: string }) => ["P1", "P2", "P3"].includes(q.component ?? ""))).toBe(true);
      // The sealed extension rows are in id order; a later append (hl2019Paper2Release) follows the 2026 rows, in id order itself.
      const appended = runtime.hl2019Paper2Release ? runtime.questions.slice(runtime.hl2019Paper2Release.baseQuestionCount) : [];
      const sealed = extension.filter((q: { id: string }) => !appended.includes(q));
      for (const rows of [sealed, appended]) expect(rows.map((q: { id: string }) => q.id)).toEqual([...rows].sort((a, b) => a.id.localeCompare(b.id)).map((q: { id: string }) => q.id));
      for (const component of ["P1", "P2", "P3"]) expect(extension.filter((q: { component: string }) => q.component === component).length).toBe(extension.filter((q: { id: string }) => q.id.includes(`-${component.toLowerCase()}-`)).length);
    }
  });

  it("preserves committed base rows byte-for-byte", () => {
    for (const bank of Object.keys(expected)) {
      const current = JSON.parse(fs.readFileSync(path.join(root, "src/data/raw", `${bank}.json`), "utf8"));
      const committed = JSON.parse(execFileSync("git", ["show", `HEAD:src/data/raw/${bank}.json`], { encoding: "utf8", maxBuffer: 100 * 1024 * 1024 }));
      const base = (value: { questions: Array<{ year: number }> }) => value.questions.filter((q) => q.year >= 2020);
      expect(base(current)).toEqual(base(committed));
    }
  });

  it("seals immutable candidate content without commit self-reference", () => {
    const pins = JSON.parse(fs.readFileSync(path.join(root, "docs/ib-science-extension/candidate-seal.json"), "utf8"));
    expect(pins.schemaVersion).toBe("ib-science-candidate-seal.v2");
    expect(pins.sealSemantics).toBe("immutable_candidate_content");
    expect(pins).not.toHaveProperty("origin");
    expect(pins.contentSha256).toBe(candidateContentSha256(root));
    expect(pins.contentFiles).toHaveLength(21);
  });

  it("pins source commits and keeps create-only manifests", () => {
    for (const bank of Object.keys(expected)) {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, "docs/ib-science-storage", `${bank}.pending-upload-manifest.json`), "utf8"));
      expect(manifest.upload).toBe(false);
      expect(manifest.prefix).toBe(`${bank}/`);
      expect(manifest.assets.every((a: { sha256: string; byteSize: number; sourcePath: string }) => /^[a-f0-9]{64}$/.test(a.sha256) && a.byteSize > 0 && !a.sourcePath.includes(".."))).toBe(true);
    }
  });

  it("records complete create-only R2 upload and full remote hash readback", () => {
    const receipt = JSON.parse(fs.readFileSync(path.join(root, "docs/ib-science-storage/ib-science-r2-upload-receipt.json"), "utf8"));
    expect(receipt.schemaVersion).toBe("ib-science-r2-upload-receipt.v1");
    expect(receipt.status).toBe("verified-readback");
    expect(receipt.mode).toBe("create-only");
    expect(receipt.candidateContentSha256).toBe(candidateContentSha256(root));
    expect(receipt.objects).toBe(12839);
    expect(receipt.uploaded).toBe(12839);
    expect(receipt.verified).toBe(12839);
    expect(receipt.failures).toBe(0);
    expect(Object.values(receipt.counts).reduce((sum: number, count) => sum + Number(count), 0)).toBe(12839);
    for (const bank of Object.keys(expected)) {
      const manifestPath = path.join(root, "docs/ib-science-storage", `${bank}.pending-upload-manifest.json`);
      const manifestSha256 = createHash("sha256").update(fs.readFileSync(manifestPath)).digest("hex");
      expect(receipt.manifestSha256[bank]).toBe(manifestSha256);
    }
  });

  it("rejects mutated source receipts", () => {
    const receipt = Buffer.from("immutable source receipt");
    expect(() => assertPinnedReceipt("chemistry", receipt)).toThrow(/receipt hash mismatch/);
    expect(() => assertPinnedReceipt("biology", Buffer.concat([receipt, Buffer.from("x")]))).toThrow(/receipt hash mismatch/);
    expect(() => assertPinnedReceipt("physics", Buffer.from("different receipt"))).toThrow(/receipt hash mismatch/);
  });
});
