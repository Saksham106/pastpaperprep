import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const readFile = vi.fn<(path: string) => Promise<string>>();

import { assetManifestFileName, authorizeManifestAssetRequests, loadBankAssetManifest } from "@/lib/asset-manifest";
import { buildBankAssetManifest } from "@/lib/asset-manifest-build";
import { isPreviewQuestion } from "@/lib/access";
import { loadBankQuestions } from "@/lib/question-loader";
import type { BankSlug } from "@/lib/banks";

const entry = { questionAssetPaths: ["a.webp"], markschemeAssetPaths: ["m.webp"], details: { summary: "s", accessibleText: "t", solution: "x", sourceQuestionUrl: null, sourceMarkSchemeUrl: null } };

describe("buildBankAssetManifest", () => {
  it.each(["ib-sl", "igcse-additional", "igcse-economics-0455"] as BankSlug[])("matches the full loader for free and paid questions in %s", async (slug) => {
    const questions = await loadBankQuestions(slug).catch(() => null);
    if (!questions) return; // gated bank not runnable in this environment
    const manifest = buildBankAssetManifest(questions);
    expect(Object.keys(manifest)).toHaveLength(questions.length);
    const samples = [questions.find((question) => isPreviewQuestion(slug, question.id)), questions.find((question) => !isPreviewQuestion(slug, question.id))];
    for (const question of samples.filter((sample) => sample !== undefined)) {
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
});

describe("loadBankAssetManifest", () => {
  beforeEach(() => readFile.mockReset());

  it("names files by runtime mode", () => {
    expect(assetManifestFileName("ib-sl")).toBe("ib-sl.preview.json");
  });

  it("reads the generated file for the bank's runtime mode", async () => {
    readFile.mockResolvedValueOnce(JSON.stringify({ "x-q1": entry }));
    const manifest = await loadBankAssetManifest("ib-hl", readFile);
    expect(readFile).toHaveBeenCalledWith(join(process.cwd(), "generated", "asset-manifest", "ib-hl.preview.json"));
    expect(manifest.get("x-q1")).toEqual(entry);
  });

  it("rejects when the generated file is missing, and retries next time", async () => {
    readFile.mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    await expect(loadBankAssetManifest("ib-ai-sl", readFile)).rejects.toThrow("ENOENT");
    readFile.mockResolvedValueOnce(JSON.stringify({ "x-q1": entry }));
    await expect(loadBankAssetManifest("ib-ai-sl", readFile)).resolves.toHaveProperty("size", 1);
  });
});

describe("authorizeManifestAssetRequests", () => {
  const manifest = new Map([["2017-may-p1-tz1-q1", entry], ["m26-math-aasl-p2-tza-q2", entry]]);

  it("returns paths and unrestricted details for allowed assets", () => {
    expect(authorizeManifestAssetRequests("ib-sl", [{ questionId: "2017-may-p1-tz1-q1", kind: "answer" }], [], manifest)).toEqual([
      { questionId: "2017-may-p1-tz1-q1", kind: "answer", paths: ["m.webp"], details: entry.details },
    ]);
  });

  it("refuses paid assets without an entitlement", () => {
    expect(() => authorizeManifestAssetRequests("ib-sl", [{ questionId: "m26-math-aasl-p2-tza-q2", kind: "question" }], [], manifest)).toThrow(/not authorized/);
  });

  it("rejects unknown, duplicate, and oversized requests", () => {
    expect(() => authorizeManifestAssetRequests("ib-sl", [{ questionId: "nope", kind: "question" }], [], manifest)).toThrow("Unknown question");
    expect(() => authorizeManifestAssetRequests("ib-sl", [{ questionId: "2017-may-p1-tz1-q1", kind: "question" }, { questionId: "2017-may-p1-tz1-q1", kind: "question" }], [], manifest)).toThrow("Duplicate");
    expect(() => authorizeManifestAssetRequests("ib-sl", [], [], manifest)).toThrow(/between 1 and 20/);
  });
});
