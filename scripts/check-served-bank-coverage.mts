/**
 * Postbuild serving-coverage contract (CI build job, same release gates as production).
 *
 * - Registry: the bank index registry lists exactly the canonical catalog, staged banks included.
 * - Served: every bank enabled under this build's environment has an asset manifest and search entries.
 * - Staged: every bank hidden for pending storage has neither, so nothing about it is served.
 *
 *   NODE_ENV=production npx tsx scripts/check-served-bank-coverage.mts
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { BANK_CATALOG } from "../src/lib/catalog";
import { getAvailableBanks } from "../src/lib/banks";

const registry = [...readFileSync("src/lib/bank-index-manifest.ts", "utf8").matchAll(/^ {2}"([a-z0-9-]+)":/gm)].map((match) => match[1]);
const catalog = BANK_CATALOG.map((bank) => bank.slug);
const served = getAvailableBanks(process.env).map((bank) => bank.slug);
const staged = BANK_CATALOG.filter((bank) => "pendingStorage" in bank && bank.pendingStorage).map((bank) => bank.slug);
const manifests = existsSync("generated/asset-manifest") ? readdirSync("generated/asset-manifest") : [];
const search = readFileSync("public/search/index.json", "utf8");
const hasManifest = (bank: string) => manifests.some((file) => file.startsWith(`${bank}.`) && file.endsWith(".json"));

const problems: string[] = [];
if (JSON.stringify([...registry].sort()) !== JSON.stringify([...catalog].sort())) problems.push(`bank index registry ${registry.length} != catalog ${catalog.length}`);
if (served.length !== catalog.length - staged.length) problems.push(`served ${served.length} != catalog ${catalog.length} - staged ${staged.length}; are the release gates on?`);
for (const bank of served) {
  if (!hasManifest(bank)) problems.push(`missing asset manifest: ${bank}`);
  if (!search.includes(`/${bank}/`)) problems.push(`missing search entries: ${bank}`);
}
for (const bank of staged) {
  if (served.includes(bank)) problems.push(`staged bank is served: ${bank}`);
  if (hasManifest(bank)) problems.push(`staged bank has an asset manifest: ${bank}`);
  if (search.includes(`/${bank}`)) problems.push(`staged bank has search entries: ${bank}`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(JSON.stringify({ catalog: catalog.length, served: served.length, staged }));
