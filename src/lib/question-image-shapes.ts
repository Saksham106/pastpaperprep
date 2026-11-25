import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BankSlug } from "@/lib/banks";
import { questionShapes, type EncodedQuestionShapes } from "@/lib/image-sizes";

// Server-only. The path is a constant so file tracing ships only this directory (next.config.ts).
const cache = new Map<BankSlug, Promise<EncodedQuestionShapes | null>>();

/**
 * Each question's image sizes from src/data/image-shapes/<bank>.json (scripts/generate-image-sizes.mts),
 * so the first page of cards renders placeholders in the images' real shapes. A missing or
 * unreadable file means no sizes, never a failed page.
 */
export async function loadQuestionImageShapes(bank: BankSlug): Promise<(questionId: string) => Array<[number, number] | null> | undefined> {
  let loaded = cache.get(bank);
  if (!loaded) {
    loaded = readFile(join(process.cwd(), "src", "data", "image-shapes", `${bank}.json`), "utf8")
      .then((text) => JSON.parse(text) as EncodedQuestionShapes)
      .catch(() => null);
    cache.set(bank, loaded);
  }
  const encoded = await loaded;
  return (questionId) => questionShapes(encoded, questionId);
}
