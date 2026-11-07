#!/usr/bin/env tsx
// Prebuild, after generate:free-asset-index: downloads the worked explanations of free-year questions
// from the public free bucket into generated/free-explanations/<bank>.json, so free past-paper pages
// can print them as crawlable HTML (see src/lib/free-explanations.ts). Only questions the free asset
// index lists are fetched, so nothing paid can end up here. Every body is checked with parseExplanation.
// A run that loses more than 2% of explanations fails the build: a CDN outage must not silently
// strip worked answers and drop those pages from the search index.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isPreviewQuestion } from "@/lib/access";
import { getAvailableBanks } from "@/lib/banks";
import { parseExplanation, type Explanation } from "@/lib/explanation-format";
import { freeAssetIndexPath, isFreePublicAssetUrl, type FreeAssetIndex } from "@/lib/free-asset-index";

const OUT = join(process.cwd(), "generated", "free-explanations");
const CONCURRENCY = 32;
const MAX_LOSS = 0.02;

async function fetchOne(url: string, bank: string, questionId: string): Promise<Explanation | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (response.status === 404) return null;
      if (response.ok) return parseExplanation(await response.json(), bank, questionId);
    } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  return null;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

let wanted = 0, got = 0;
const started = Date.now();
for (const bank of getAvailableBanks()) {
  const index = JSON.parse(await readFile(join(process.cwd(), "public", freeAssetIndexPath(bank.slug)), "utf8")) as FreeAssetIndex;
  const jobs = Object.entries(index.questions)
    .filter(([questionId, entry]) => isPreviewQuestion(bank.slug, questionId) && isFreePublicAssetUrl(entry.explanation?.urls[0]))
    .map(([questionId, entry]) => ({ questionId, url: entry.explanation!.urls[0] }));
  const results: Record<string, Explanation> = {};
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const explanation = await fetchOne(job.url, bank.slug, job.questionId);
      if (explanation) results[job.questionId] = explanation;
    }
  }));
  wanted += jobs.length;
  got += Object.keys(results).length;
  await writeFile(join(OUT, `${bank.slug}.json`), JSON.stringify(results));
  console.log(`${bank.slug}: ${Object.keys(results).length}/${jobs.length} free explanations`);
}
console.log(`free explanations: ${got}/${wanted} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
if (wanted && (wanted - got) / wanted > MAX_LOSS) throw new Error(`Only ${got} of ${wanted} free explanations downloaded; refusing to build pages without them`);
