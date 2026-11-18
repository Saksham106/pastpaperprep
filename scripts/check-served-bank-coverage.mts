/**
 * Postbuild serving-coverage contract (CI build job, same release gates as production).
 *
 * - Registry: the bank index registry lists exactly the served catalog: every canonical bank except the held
 *   (pendingStorage) ones, which leave no public artifact (src/lib/held-banks.mjs, owner review 2026-11-18).
 *   Each listed file exists in public/bank-index; no held bank has one. The held list equals the catalog's
 *   pendingStorage banks, so switching a bank on puts it back in the registry.
 * - Served: every bank enabled under this build's environment has an asset manifest and search entries.
 * - Staged: every bank hidden for pending storage has neither, so nothing about it is served.
 *
 *   NODE_ENV=production npx tsx scripts/check-served-bank-coverage.mts
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { BANK_CATALOG } from "../src/lib/catalog";
import { getAvailableBanks } from "../src/lib/banks";
import { HELD_BANKS } from "../src/lib/held-banks.mjs";

const registryEntries = [...readFileSync("src/lib/bank-index-manifest.ts", "utf8").matchAll(/^ {2}"([a-z0-9-]+)": "([^"]+)"/gm)].map((match) => ({ bank: match[1], file: match[2] }));
const registry = registryEntries.map((entry) => entry.bank);
const indexFiles = existsSync("public/bank-index") ? readdirSync("public/bank-index") : [];
const catalog = BANK_CATALOG.map((bank) => bank.slug);
const served = getAvailableBanks(process.env).map((bank) => bank.slug);
const staged = BANK_CATALOG.filter((bank) => "pendingStorage" in bank && bank.pendingStorage).map((bank) => bank.slug);
const manifests = existsSync("generated/asset-manifest") ? readdirSync("generated/asset-manifest") : [];
const search = readFileSync("public/search/index.json", "utf8");
const hasManifest = (bank: string) => manifests.some((file) => file.startsWith(`${bank}.`) && file.endsWith(".json"));

const problems: string[] = [];
if (JSON.stringify([...HELD_BANKS].sort()) !== JSON.stringify([...staged].sort())) problems.push(`held banks [${HELD_BANKS.join(", ")}] != catalog pendingStorage banks [${staged.join(", ")}]`);
const expectedRegistry = catalog.filter((bank) => !staged.includes(bank));
if (JSON.stringify([...registry].sort()) !== JSON.stringify([...expectedRegistry].sort())) problems.push(`bank index registry ${registry.length} != catalog ${catalog.length} - held ${staged.length}`);
for (const { bank, file } of registryEntries) if (!indexFiles.includes(file)) problems.push(`registry names a missing public/bank-index file: ${bank} -> ${file}`);
if (served.length !== catalog.length - staged.length) problems.push(`served ${served.length} != catalog ${catalog.length} - staged ${staged.length}; are the release gates on?`);
for (const bank of served) {
  if (!hasManifest(bank)) problems.push(`missing asset manifest: ${bank}`);
  if (!search.includes(`/${bank}/`)) problems.push(`missing search entries: ${bank}`);
}
for (const bank of staged) {
  if (served.includes(bank)) problems.push(`staged bank is served: ${bank}`);
  if (hasManifest(bank)) problems.push(`staged bank has an asset manifest: ${bank}`);
  if (registry.includes(bank)) problems.push(`staged bank is in the bank index registry: ${bank}`);
  if (indexFiles.some((file) => file.startsWith(`${bank}.v`))) problems.push(`staged bank has a public/bank-index file: ${bank}`);
  if (search.includes(`/${bank}`)) problems.push(`staged bank has search entries: ${bank}`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(JSON.stringify({ catalog: catalog.length, served: served.length, registry: registry.length, staged }));
