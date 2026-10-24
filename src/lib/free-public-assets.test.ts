import { describe, expect, it } from "vitest";
import { isPreviewQuestion } from "@/lib/access";
import type { AssetManifest, AssetManifestEntry } from "@/lib/asset-manifest";
import { buildFreeAssetIndex, isSafeFreeAssetPath, listFreePublicAssets } from "@/lib/free-public-assets";
import { fetchFreeAssets } from "@/lib/signed-assets";

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

  it("copies R2-only repair crops from R2 in Supabase-backed banks", () => {
    const id = "2020-november-tz0-sl-p1-q1";
    const repair = "ib-biology-sl/repairs/ib-shared-stimulus-v1-d53ab265e7e81518/a.webp";
    const assets = listFreePublicAssets("ib-biology-sl", new Map([[id, { ...entry(id, false), questionAssetPaths: [repair, `ib-biology-sl/questions/${id}-page-3.webp`] }]]));
    expect(assets.map(({ path, source }) => [path, source])).toEqual([
      [repair, "r2"],
      [`ib-biology-sl/questions/${id}-page-3.webp`, "supabase"],
      [`bank/markschemes/${id}.webp`, "supabase"],
    ]);
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

  it("accepts only plain image and explanation paths", () => {
    for (const ok of ["igcse/questions/0580-2016-june-21-q1.webp", "explanations/ib-hl/2017-may-tz1-p1-q1.json", "igcse-biology-0610/releases/combined4913-v1-9e97cd0c0455/questions/0610-2021-m-12/q1-2-1.webp"]) expect(isSafeFreeAssetPath(ok)).toBe(true);
    for (const bad of ["../igcse/questions/a.webp", "igcse/../../etc/passwd.webp", "/igcse/a.webp", "igcse/a.png", "igcse//a.webp", "igcse/a..b.webp", "igcse"]) expect(isSafeFreeAssetPath(bad)).toBe(false);
  });

  it("refuses to list an unsafe path", () => {
    const bad: AssetManifest = new Map([[FREE, { ...entry(FREE), questionAssetPaths: ["../../private/paid.webp"] }]]);
    expect(() => listFreePublicAssets("igcse", bad)).toThrow(/unsafe asset path/);
  });

  it("round-trips explicit empty/text-only entries without signing but rescues stale omissions", async () => {
    const index = buildFreeAssetIndex("igcse", new Map([[FREE, { ...entry(FREE, false), questionAssetPaths: [], markschemeAssetPaths: [] }]]),
      (_id, value) => ({ ...value, solution: "Text-only answer" }));
    const calls: string[] = [];
    const fetcher = async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return Response.json(index);
    };
    const requests = ["question", "answer", "explanation"].map((kind) => ({ questionId: FREE, kind: kind as "question" | "answer" | "explanation" }));
    const result = await fetchFreeAssets("igcse", requests, fetcher);
    expect(result.failedKeys).toEqual([]);
    expect(result.assets.size).toBe(3);
    for (const asset of result.assets.values()) expect(asset).toMatchObject({ urls: [], details: { ...details, solution: "Text-only answer" } });
    expect(calls).toEqual(["/free-assets/igcse.json"]);

    // An old index omitting a kind is not evidence that the answer is empty.
    delete index.questions[FREE].answer;
    const staleCalls: string[] = [];
    const staleFetcher = async (input: RequestInfo | URL) => {
      staleCalls.push(String(input));
      return String(input).startsWith("/free-assets/") ? Response.json(index)
        : Response.json({ expiresIn: 3600, maxAge: 0, asset: { questionId: FREE, kind: "answer", urls: ["https://assets.example/answer.webp"] } });
    };
    const stale = await fetchFreeAssets("igcse", [{ questionId: FREE, kind: "answer" }], staleFetcher);
    expect(stale.assets.get(`${FREE}:answer`)?.urls).toEqual(["https://assets.example/answer.webp"]);
    expect(staleCalls).toHaveLength(2);
  });

  it("encodes known text-only and absent kinds explicitly with projected rich details", () => {
    const index = buildFreeAssetIndex("igcse", new Map([[FREE, {
      ...entry(FREE, false), questionAssetPaths: [], markschemeAssetPaths: [],
    }]]), (_id, value) => ({ ...value, solution: "Text-only answer" }));
    expect(index.questions[FREE]).toEqual({
      details: { ...details, solution: "Text-only answer" },
      question: { urls: [], displayCrops: [] },
      answer: { urls: [], displayCrops: [] },
      explanation: { urls: [], displayCrops: [] },
    });
  });
});

describe("free index MCQ letters", () => {
  const BANK = "igcse-chemistry-0620";
  const FREE_MCQ = "0620-2021-m-12-q1";
  const PAID_MCQ = "0620-2025-m-12-q1";
  const mcq = (id: string, answers: Array<"A" | "D">): AssetManifestEntry => ({ ...entry(id, false), mcqAnswer: { answers, note: null } });

  it("lists a free-year letter in place of its answer crop, and nothing for paid years", () => {
    const index = buildFreeAssetIndex(BANK, new Map([[FREE_MCQ, mcq(FREE_MCQ, ["D"])], [PAID_MCQ, mcq(PAID_MCQ, ["A"])]]), (_id, value) => value);
    expect(Object.keys(index.questions)).toEqual([FREE_MCQ]);
    expect(JSON.stringify(index)).not.toContain(PAID_MCQ);
    expect(index.questions[FREE_MCQ].answer).toEqual({ urls: [], displayCrops: [], mcqAnswer: { answers: ["D"], note: null } });
    expect(index.questions[FREE_MCQ].question).toEqual({ urls: [`https://free.pastpaperprep.com/images/bank/questions/${FREE_MCQ}.webp`], displayCrops: [null] });
  });

  it("still publishes the answer crop file so the letter can be withdrawn without a re-upload", () => {
    expect(listFreePublicAssets(BANK, new Map([[FREE_MCQ, mcq(FREE_MCQ, ["D"])]])).map((asset) => asset.kind)).toEqual(["question", "answer"]);
  });
});
