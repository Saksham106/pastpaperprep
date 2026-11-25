import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";
import { loadBankAssetManifest } from "@/lib/asset-manifest";
import { staleQuestionShapes, type EncodedQuestionShapes } from "@/lib/image-sizes";
import type { PublicBankIndex } from "@/lib/question-index";
import { loadQuestionImageShapes } from "@/lib/question-image-shapes";

const BANK = "igcse";

it("gives every card in the public bank index the same image sizes the page's first cards get", async () => {
  const index = JSON.parse(readFileSync(join(process.cwd(), "public", "bank-index", PUBLIC_BANK_INDEX_FILES[BANK]), "utf8")) as PublicBankIndex;
  const shapesOf = await loadQuestionImageShapes(BANK);
  let sized = 0;
  for (const question of index.questions) {
    const expected = shapesOf(question.id);
    expect(question.imageSizes, question.id).toEqual(expected?.length === question.questionImageCount ? expected : undefined);
    if (question.imageSizes) sized += 1;
  }
  expect(sized).toBeGreaterThan(index.questions.length * 0.99);
});

it("keeps the committed shapes in step with the images the bank delivers", async () => {
  const shapes = JSON.parse(readFileSync(join(process.cwd(), "src", "data", "image-shapes", `${BANK}.json`), "utf8")) as EncodedQuestionShapes;
  expect(staleQuestionShapes(Object.fromEntries(await loadBankAssetManifest(BANK)), shapes)).toEqual([]);
});
