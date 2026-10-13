import { describe, expect, it } from "vitest";
import { isPreviewQuestion } from "@/lib/access";
import type { AssetManifest, AssetManifestEntry } from "@/lib/asset-manifest";
import { buildFreeAssetIndex, listFreePublicAssets } from "@/lib/free-public-assets";

const details = { summary: "s", accessibleText: "a", solution: null, sourceQuestionUrl: null, sourceMarkSchemeUrl: null };
const entry = (id: string, explanation = true): AssetManifestEntry => ({
  questionAssetPaths: [`bank/questions/${id}.webp`],
  markschemeAssetPaths: [`bank/markschemes/${id}.webp`],
  ...(explanation ? { explanationAssetPaths: [`explanations/bank/${id}.json`] } : {}),
  details,
});
// 0580: 2016–2018 are free, 2026 is paid.
const FREE = "0580-2016-june-21-q1";
const PAID = "0580-2026-june-21-q1";
const manifest: AssetManifest = new Map([[FREE, entry(FREE)], [PAID, entry(PAID)]]);

describe("free public assets", () => {
  it("lists only free-year files, each with the private store it is copied from", () => {
    expect(isPreviewQuestion("igcse", FREE)).toBe(true);
    expect(isPreviewQuestion("igcse", PAID)).toBe(false);
    expect(listFreePublicAssets("igcse", manifest)).toEqual([
      { bank: "igcse", questionId: FREE, kind: "question", source: "supabase", path: `bank/questions/${FREE}.webp` },
      { bank: "igcse", questionId: FREE, kind: "answer", source: "supabase", path: `bank/markschemes/${FREE}.webp` },
      { bank: "igcse", questionId: FREE, kind: "explanation", source: "r2", path: `explanations/bank/${FREE}.json` },
    ]);
  });

  it("copies R2-backed banks from R2", () => {
    const id = "0610-2021-m-12-q1";
    expect(listFreePublicAssets("igcse-biology-0610", new Map([[id, entry(id, false)]])).map((asset) => asset.source)).toEqual(["r2", "r2"]);
  });

  it("builds a static index of public links for free questions only", () => {
    const index = buildFreeAssetIndex("igcse", manifest, (_id, value) => ({ ...value, solution: "worked" }));
    expect(Object.keys(index.questions)).toEqual([FREE]);
    expect(JSON.stringify(index)).not.toContain(PAID);
    expect(index.questions[FREE]).toEqual({
      details: { ...details, solution: "worked" },
      question: { urls: [`https://free.pastpaperprep.com/images/bank/questions/${FREE}.webp`], displayCrops: [null] },
      answer: { urls: [`https://free.pastpaperprep.com/images/bank/markschemes/${FREE}.webp`], displayCrops: [null] },
      explanation: { urls: [`https://free.pastpaperprep.com/images/explanations/bank/${FREE}.json`], displayCrops: [null] },
    });
  });

  it("omits kinds a question has no files for", () => {
    const index = buildFreeAssetIndex("igcse", new Map([[FREE, entry(FREE, false)]]), (_id, value) => value);
    expect(index.questions[FREE].explanation).toBeUndefined();
  });
});
