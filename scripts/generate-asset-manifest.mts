#!/usr/bin/env tsx
// Prebuild: one server-only asset manifest per bank (see src/lib/asset-manifest.ts), so the
// signing routes stop normalizing a whole bank on every cold start. The same pass writes each
// bank's server-only search corpus (src/lib/question-search-corpus.ts) for /api/questions/search. Each bank runs in its own
// child process because the question loader caches every bank for the life of a process.
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getAvailableBanks, type BankSlug } from "@/lib/banks";
import { assetManifestFileName } from "@/lib/asset-manifest";
import { buildBankAssetManifest } from "@/lib/asset-manifest-build";
import { imageSizeLookup, staleQuestionShapes, type EncodedImageSizes, type EncodedQuestionShapes } from "@/lib/image-sizes";
import { loadBankMcqAnswers } from "@/lib/mcq-answer-letters";
import { loadBankQuestions } from "@/lib/question-loader";
import { buildSearchCorpus } from "@/lib/question-search-corpus-build";

const ASSET_MANIFEST_DIRECTORY = join(process.cwd(), "generated", "asset-manifest");
const SEARCH_CORPUS_DIRECTORY = join(process.cwd(), "generated", "question-search");

const single = process.argv.indexOf("--bank");
if (single >= 0) {
  const slug = process.argv[single + 1] as BankSlug;
  // Only banks getAvailableBanks() returned are queued, so a loader failure here is real:
  // fail the child (and the build) instead of leaving the bank without a manifest.
  let questions: Awaited<ReturnType<typeof loadBankQuestions>>;
  try {
    questions = await loadBankQuestions(slug);
  } catch (error) {
    console.error(`${slug}: question loader failed`, error);
    process.exit(1);
  }
  // Unlike the bank itself, bad letters are never skipped: an invalid overlay fails the build.
  const mcqAnswers = await loadBankMcqAnswers(slug);
  // Pixel sizes from scripts/generate-image-sizes.mts; a bank without a file keeps unsized images.
  const sizes = await readFile(join(process.cwd(), "src", "data", "image-sizes", `${slug}.json`), "utf8")
    .then((text) => JSON.parse(text) as EncodedImageSizes, (error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return null; throw error; });
  const manifest = buildBankAssetManifest(questions, mcqAnswers, imageSizeLookup(sizes));
  // The per-question shapes (card placeholders) must describe the images this manifest delivers.
  const shapes = await readFile(join(process.cwd(), "src", "data", "image-shapes", `${slug}.json`), "utf8")
    .then((text) => JSON.parse(text) as EncodedQuestionShapes, (error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return null; throw error; });
  const stale = staleQuestionShapes(manifest, shapes);
  if (stale.length) {
    console.error(`${slug}: src/data/image-shapes disagrees with the delivered question images for ${stale.length} questions (${stale.slice(0, 3).join(", ")}); re-run scripts/generate-image-sizes.mts`);
    process.exit(1);
  }
  const file = join(ASSET_MANIFEST_DIRECTORY, assetManifestFileName(slug));
  await writeFile(file, JSON.stringify(manifest));
  await writeFile(join(SEARCH_CORPUS_DIRECTORY, assetManifestFileName(slug)), JSON.stringify(buildSearchCorpus(questions)));
  console.log(`${slug}: ${questions.length} questions${mcqAnswers.size ? `, ${mcqAnswers.size} MCQ letters` : ""} -> ${assetManifestFileName(slug)}`);
  process.exit(0);
}

for (const directory of [ASSET_MANIFEST_DIRECTORY, SEARCH_CORPUS_DIRECTORY]) {
  await mkdir(directory, { recursive: true });
  for (const name of await readdir(directory)) await unlink(join(directory, name));
}
const queue: string[] = getAvailableBanks().map((bank) => bank.slug);
const run = (slug: string) => new Promise<void>((resolve, reject) => {
  const child = spawn(process.execPath, [...process.execArgv, process.argv[1], "--bank", slug], { stdio: "inherit", env: process.env });
  child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${slug} asset manifest failed (${code})`)));
});
await Promise.all([0, 1].map(async () => { while (queue.length) await run(queue.shift()!); }));
