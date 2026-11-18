#!/usr/bin/env node
/**
 * Production build output check (postbuild): a held bank (pendingStorage, src/lib/held-banks.mjs) must leave no
 * static artifact behind. Fails the build when public/bank-index holds a file for a held bank, when the generated
 * bank-index manifest names one, or when any built page or chunk under .next references a held bank's index file.
 * Page and API checks alone cannot prove this: public/ is deployed as is.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HELD_BANKS } from "../src/lib/held-banks.mjs";

async function listFiles(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true, recursive: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath ?? entry.path, entry.name));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

/** Returns one message per leak; empty when no held bank left an artifact. */
export async function findHeldBankArtifacts(root, held = HELD_BANKS) {
  const problems = [];
  const indexFiles = await readdir(join(root, "public", "bank-index")).catch(() => []);
  for (const bank of held) {
    for (const file of indexFiles) if (file.startsWith(`${bank}.v`)) problems.push(`public/bank-index/${file} publishes held bank ${bank}`);
  }
  const manifest = await readFile(join(root, "src", "lib", "bank-index-manifest.ts"), "utf8");
  for (const bank of held) if (manifest.includes(`"${bank}"`)) problems.push(`src/lib/bank-index-manifest.ts names held bank ${bank}`);
  const pattern = new RegExp(`bank-index/(?:${held.map((bank) => bank.replace(/[-]/g, "\\-")).join("|")})\\.v`);
  if (held.length) {
    for (const directory of [join(root, ".next", "server"), join(root, ".next", "static")]) {
      for (const file of await listFiles(directory)) {
        if (!/\.(?:html|rsc|js|json|body|meta)$/.test(file)) continue;
        const text = await readFile(file, "utf8");
        const hit = pattern.exec(text);
        if (hit) problems.push(`${file.slice(root.length + 1)} references ${hit[0]}`);
      }
    }
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const root = resolve(import.meta.dirname, "..");
  const problems = await findHeldBankArtifacts(root);
  if (problems.length) {
    console.error(`Held-bank artifact check failed:\n${problems.map((problem) => `- ${problem}`).join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log(`Held-bank artifact check passed: no static index for ${HELD_BANKS.join(", ") || "any held bank"}.`);
  }
}
