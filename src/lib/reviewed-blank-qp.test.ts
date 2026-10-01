import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { BANK_PRODUCTS } from "@/lib/access";
import { authorizeAssetRequests } from "@/lib/asset-access";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";
import { createPublicBankIndex } from "@/lib/question-index";
import { loadBankQuestions } from "@/lib/question-loader";
import reviewed from "@/data/reviewed-blank-qp.json";
import { activeQuestionImagePaths } from "@/lib/reviewed-blank-qp";
import { normalizeBankQuestions } from "@/lib/questions";

const biology = JSON.parse(readFileSync(path.join(process.cwd(), "src/data/production/igcse-biology-0610.json"), "utf8")) as {
  questions: Array<{ id: string; questionImages: string[]; markschemeImages: string[] }>;
};

describe("source- and receipt-reviewed whole BLANK PAGE assets", () => {
  it("pins exactly 887 question-paper images across four banks; never touches mark schemes", () => {
    expect(reviewed.counts).toEqual({
      "igcse-biology-0610": 206, "igcse-chemistry-0620": 269,
      "igcse-coordinated-sciences-0654": 262, "igcse-physics-0625": 150,
    });
    expect(Object.values(reviewed.counts).reduce((a, b) => a + b, 0)).toBe(887);
  });

  it("hides only the exact reviewed page, not a question's other pages or a held/other-bank asset", () => {
    const id = "0610-2019-m-12-q40";
    const q = biology.questions.find((item) => item.id === id)!;
    expect(q.questionImages).toHaveLength(3);
    expect(activeQuestionImagePaths("igcse-biology-0610", id, q.questionImages)).toEqual([
      "questions/0610-2019-m-12/q40-14-1.webp", "questions/0610-2019-m-12/q40-16-3.webp",
    ]);
    expect(activeQuestionImagePaths("igcse-physics-0625", id, q.questionImages)).toEqual(q.questionImages);
    expect(activeQuestionImagePaths("igcse-biology-0610", "0610-2026-m-32-q4", ["questions/held.webp"]))
      .toEqual(["questions/held.webp"]);
  });

  it("projects the same visible image count and signed path list without mutating raw runtime", () => {
    const raw = biology.questions.find((item) => item.id === "0610-2019-m-12-q40")!;
    const [q] = normalizeBankQuestions("igcse-biology-0610", [raw as Record<string, unknown>], { economicsAssetMode: "private", applyReviewedBlankPages: true });
    expect(q.questionImageCount).toBe(2);
    expect(q.questionAssetPaths).toHaveLength(2);
    expect(q.questionAssetPaths.every((path) => !path.endsWith("q40-15-2.webp"))).toBe(true);
    expect(q.markschemeImageCount).toBeGreaterThan(0);
    expect(raw.questionImages).toHaveLength(3);
  });

  it("does not apply a release-only asset omission to partial metadata or reseal fixtures", () => {
    const source = biology.questions.find((item) => item.id === "0610-2019-m-12-q40")!;
    const partial = { ...source, questionImages: ["questions/fixture.webp"] };
    const [q] = normalizeBankQuestions("igcse-biology-0610", [partial as Record<string, unknown>]);
    expect(q.questionImageCount).toBe(1);
    expect(q.questionImages[0]).toContain("fixture.webp");
  });

  it("uses the same active paths for paid viewer signing and worksheet asset authorization", async () => {
    vi.stubEnv("PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS", "true");
    vi.stubEnv("PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED", "true");
    try {
      for (const bank of Object.keys(reviewed.entries) as Array<keyof typeof reviewed.entries>) {
        const [qid, hidden] = Object.entries(reviewed.entries[bank])[0];
        const expectedPath = hidden[0].path;
        const normalized = (await loadBankQuestions(bank)).find((item) => item.id === qid)!;
        const authorization = await authorizeAssetRequests(bank, [{ questionId: qid, kind: "question" }], [
          { productId: BANK_PRODUCTS[bank]!, status: "active", startsAt: "2020-01-01T00:00:00.000Z", expiresAt: null },
        ]);
        expect(normalized.questionImageCount).toBeGreaterThan(0);
        expect(normalized.questionAssetPaths).toEqual(authorization[0].paths);
        expect(authorization[0].paths.some((url) => url.endsWith(expectedPath))).toBe(false);
      }
    } finally { vi.unstubAllEnvs(); }
  }, 30_000);

  it("seals all 887 exact paths and digests to the reviewed artifact and current storage manifest", () => {
    const projection = readFileSync(path.join(process.cwd(), "src/data/reviewed-blank-qp.json"));
    expect(createHash("sha256").update(projection).digest("hex"))
      .toBe("a63859134fc8765d5d7a48bb9c1e1390d9dfe560f31a45e0d20713bf2ad39b70");
    expect(reviewed.evidenceSha256["strict-blank-full-crop-review-queue.json"])
      .toBe("0f8b152cebc4471c72fa5373c4bb2a514689ae7834f0f236f603fea5b0521d71");
    expect(reviewed.evidenceSha256["strict-blank-nearwhite-sensitivity.json"])
      .toBe("60661f78ac7b00f9bd458ed8c9ceb998ad879ddab8bc2568fb639be5302ab2b5");
    let checked = 0;
    for (const bank of Object.keys(reviewed.entries) as Array<keyof typeof reviewed.entries>) {
      const manifest = JSON.parse(readFileSync(path.join(process.cwd(), "data/storage", `${bank}.manifest.json`), "utf8")) as {
        assets: Array<{ objectKey: string; sha256: string }>;
      };
      const byPath = new Map(manifest.assets.map((asset) => [asset.objectKey.split("/questions/")[1], asset.sha256]));
      for (const [qid, images] of Object.entries(reviewed.entries[bank])) {
        for (const image of images) {
          expect(image.path).toContain(`questions/${qid.split("-q")[0]}/`);
          expect(byPath.get(image.path.slice("questions/".length))).toBe(image.sha256);
          expect(image.sourcePdfSha256).toMatch(/^[a-f0-9]{64}$/);
          checked++;
        }
      }
    }
    expect(checked).toBe(887);
  }, 30_000);

  it("keeps every published image count aligned with its private production projection", async () => {
    vi.stubEnv("PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS", "true");
    vi.stubEnv("PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED", "true");
    try {
      for (const bank of Object.keys(reviewed.entries) as Array<keyof typeof reviewed.entries>) {
        const served = JSON.parse(readFileSync(path.join(process.cwd(), "public/bank-index", PUBLIC_BANK_INDEX_FILES[bank]), "utf8")) as {
          questions: Array<{ id: string; questionImageCount: number; markschemeImageCount: number }>;
        };
        const privateIndex = createPublicBankIndex(bank, await loadBankQuestions(bank));
        // The 0610 public generator also projects official section names; the private
        // normalizer keeps raw labels. This gate compares only the asset-count contract.
        const byId = new Map(privateIndex.questions.map((row) => [row.id, row]));
        expect(served.questions).toHaveLength(byId.size);
        for (const row of served.questions) {
          const privateRow = byId.get(row.id);
          expect(privateRow, `${bank}:${row.id} missing privately`).toBeDefined();
          expect([row.questionImageCount, row.markschemeImageCount], `${bank}:${row.id} image counts`)
            .toEqual([privateRow!.questionImageCount, privateRow!.markschemeImageCount]);
        }
      }
    } finally { vi.unstubAllEnvs(); }
  }, 30_000);

  it("never allows a reviewed list to erase all image paths", () => {
    expect(() => activeQuestionImagePaths("igcse-biology-0610", "0610-2019-m-12-q40",
      ["questions/0610-2019-m-12/q40-15-2.webp"])).toThrow(/all question images/i);
  });
});
