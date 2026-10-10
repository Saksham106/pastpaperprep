import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assetManifestFileName, buildBankAssetManifest, loadBankAssetManifest } from "@/lib/asset-manifest";
import { loadBankQuestions } from "@/lib/question-loader";
import type { BankSlug } from "@/lib/banks";

describe("bank asset manifest", () => {
  it.each(["ib-sl", "igcse-additional", "igcse-economics-0455"] as BankSlug[])("matches the full loader for %s", async (slug) => {
    const questions = await loadBankQuestions(slug).catch(() => null);
    if (!questions) return; // gated bank not runnable in this environment
    const manifest = buildBankAssetManifest(questions);
    expect(Object.keys(manifest)).toHaveLength(questions.length);
    for (const question of [questions[0], questions[Math.floor(questions.length / 2)], questions.at(-1)!]) {
      expect(manifest[question.id]).toEqual({
        questionAssetPaths: question.questionAssetPaths,
        markschemeAssetPaths: question.markschemeAssetPaths,
        details: {
          summary: question.summary,
          accessibleText: question.accessibleText,
          solution: question.solution,
          sourceQuestionUrl: question.sourceQuestionUrl,
          sourceMarkSchemeUrl: question.sourceMarkSchemeUrl,
        },
      });
    }
  });

  it("is deterministic", async () => {
    const questions = await loadBankQuestions("ib-sl");
    expect(JSON.stringify(buildBankAssetManifest(questions))).toBe(JSON.stringify(buildBankAssetManifest([...questions])));
  });

  it("names files by runtime mode", () => {
    expect(assetManifestFileName("ib-sl")).toBe("ib-sl.preview.json");
  });

  it("reads a generated file when present", async () => {
    const directory = mkdtempSync(join(tmpdir(), "asset-manifest-"));
    writeFileSync(join(directory, assetManifestFileName("ib-sl")), JSON.stringify({
      "x-q1": { questionAssetPaths: ["a.webp"], markschemeAssetPaths: [], details: { summary: "", accessibleText: "", solution: null, sourceQuestionUrl: null, sourceMarkSchemeUrl: null } },
    }));
    const manifest = await loadBankAssetManifest("ib-sl", { directory, useGenerated: true });
    expect(manifest.get("x-q1")?.questionAssetPaths).toEqual(["a.webp"]);
  });

  it("falls back when the generated file is missing", async () => {
    const directory = mkdtempSync(join(tmpdir(), "asset-manifest-empty-"));
    const manifest = await loadBankAssetManifest("ib-sl", { directory, useGenerated: true });
    const questions = await loadBankQuestions("ib-sl");
    expect(manifest.size).toBe(questions.length);
  });
});
