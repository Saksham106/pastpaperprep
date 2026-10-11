#!/usr/bin/env tsx
// Prebuild: one server-only asset manifest per bank (see src/lib/asset-manifest.ts), so the
// signing routes stop normalizing a whole bank on every cold start. Each bank runs in its own
// child process because the question loader caches every bank for the life of a process.
import { spawn } from "node:child_process";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getAvailableBanks, type BankSlug } from "@/lib/banks";
import { assetManifestFileName } from "@/lib/asset-manifest";
import { buildBankAssetManifest } from "@/lib/asset-manifest-build";
import { loadBankQuestions } from "@/lib/question-loader";

const ASSET_MANIFEST_DIRECTORY = join(process.cwd(), "generated", "asset-manifest");

const single = process.argv.indexOf("--bank");
if (single >= 0) {
  const slug = process.argv[single + 1] as BankSlug;
  const questions = await loadBankQuestions(slug).catch(() => null);
  if (!questions) {
    console.log(`${slug}: not runnable in this environment, skipped`);
    process.exit(0);
  }
  const file = join(ASSET_MANIFEST_DIRECTORY, assetManifestFileName(slug));
  await writeFile(file, JSON.stringify(buildBankAssetManifest(questions)));
  console.log(`${slug}: ${questions.length} questions -> ${assetManifestFileName(slug)}`);
  process.exit(0);
}

await mkdir(ASSET_MANIFEST_DIRECTORY, { recursive: true });
for (const name of await readdir(ASSET_MANIFEST_DIRECTORY)) await unlink(join(ASSET_MANIFEST_DIRECTORY, name));
const queue: string[] = getAvailableBanks().map((bank) => bank.slug);
const run = (slug: string) => new Promise<void>((resolve, reject) => {
  const child = spawn(process.execPath, [...process.execArgv, process.argv[1], "--bank", slug], { stdio: "inherit", env: process.env });
  child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${slug} asset manifest failed (${code})`)));
});
await Promise.all([0, 1].map(async () => { while (queue.length) await run(queue.shift()!); }));
