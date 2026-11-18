import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BANK_CATALOG } from "@/lib/catalog";
import { HELD_BANKS, isPendingBankPreview, publishedIndexBanks } from "@/lib/held-banks.mjs";
import { publishedBankSources } from "../../scripts/generate-bank-index.mjs";
import { findHeldBankArtifacts } from "../../scripts/verify-held-bank-artifacts.mjs";

const PRODUCTION = { NODE_ENV: "production" };
const PREVIEW = { NODE_ENV: "development", PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true" };
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

/** A fake build root: public/bank-index files, a manifest naming `manifestBanks`, optional built page text. */
async function buildRoot(files: string[], manifestBanks: string[], page = "") {
  const root = await mkdtemp(join(tmpdir(), "held-banks-"));
  roots.push(root);
  await mkdir(join(root, "public", "bank-index"), { recursive: true });
  for (const file of files) await writeFile(join(root, "public", "bank-index", file), "{}");
  await mkdir(join(root, "src", "lib"), { recursive: true });
  await writeFile(join(root, "src", "lib", "bank-index-manifest.ts"), `export const PUBLIC_BANK_INDEX_FILES = ${JSON.stringify(Object.fromEntries(manifestBanks.map((bank) => [bank, `${bank}.v1-abc.json`])))} as const;\n`);
  await mkdir(join(root, ".next", "server", "app"), { recursive: true });
  await writeFile(join(root, ".next", "server", "app", "page.html"), page);
  return root;
}

describe("held (pendingStorage) banks", () => {
  it("lists exactly the catalog's pendingStorage banks", () => {
    const staged = BANK_CATALOG.filter((bank) => "pendingStorage" in bank && bank.pendingStorage).map((bank) => bank.slug);
    expect([...HELD_BANKS].sort()).toEqual([...staged].sort());
  });

  it("publishes no static index for a held bank outside the dev-only preview", () => {
    const held = ["a-level-maths-9709"];
    expect(publishedIndexBanks(["igcse", "a-level-maths-9709"], PRODUCTION, held)).toEqual(["igcse"]);
    expect(publishedIndexBanks(["igcse", "a-level-maths-9709"], {}, held)).toEqual(["igcse"]);
    expect(publishedIndexBanks(["igcse", "a-level-maths-9709"], PREVIEW, held)).toEqual(["igcse", "a-level-maths-9709"]);
    // The preview flag never applies to a production build.
    expect(isPendingBankPreview({ NODE_ENV: "production", PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true" })).toBe(false);
    expect(publishedBankSources(PRODUCTION).some(({ bank }) => HELD_BANKS.includes(bank))).toBe(false);
    // 9709 was switched on (2026-11-18): it is no longer held, so production publishes its index again.
    expect(publishedBankSources(PRODUCTION).some(({ bank }) => bank === "a-level-maths-9709")).toBe(true);
  });

  it("publishes the index again once the bank is switched on (no longer held)", () => {
    expect(publishedIndexBanks(["igcse", "a-level-maths-9709"], PRODUCTION, [])).toEqual(["igcse", "a-level-maths-9709"]);
  });
});

describe("production build output check", () => {
  it("passes a clean build and flags every kind of held-bank leak", async () => {
    expect(await findHeldBankArtifacts(await buildRoot(["igcse.v1-aaa.json"], ["igcse"]), ["a-level-maths-9709"])).toEqual([]);
    const leaks = await findHeldBankArtifacts(await buildRoot(["igcse.v1-aaa.json", "a-level-maths-9709.v1-bbb.json"], ["igcse", "a-level-maths-9709"], 'x "/bank-index/a-level-maths-9709.v1-bbb.json" y'), ["a-level-maths-9709"]);
    expect(leaks).toHaveLength(3);
    expect(leaks.join("\n")).toMatch(/public\/bank-index\/a-level-maths-9709\.v1-bbb\.json/);
    expect(leaks.join("\n")).toMatch(/bank-index-manifest\.ts names held bank a-level-maths-9709/);
    expect(leaks.join("\n")).toMatch(/\.next\/server\/app\/page\.html references/);
  });

  it("accepts a switched-on bank's index", async () => {
    const root = await buildRoot(["a-level-maths-9709.v1-bbb.json"], ["a-level-maths-9709"], '"/bank-index/a-level-maths-9709.v1-bbb.json"');
    expect(await findHeldBankArtifacts(root, [])).toEqual([]);
  });

  it("passes on this checkout's generated output", async () => {
    expect(await findHeldBankArtifacts(process.cwd())).toEqual([]);
  });
});
