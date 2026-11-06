import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assetManifestFileName } from "@/lib/asset-manifest";
import type { BankSlug } from "@/lib/banks";
import type { SearchCorpusRow } from "@/lib/question-search-corpus-build";

// Server-only: rows hold premium search text. Like the asset manifests, this never imports the
// question loader, so a cold search reads one small file instead of normalizing a whole bank.

const cache = new Map<string, Promise<readonly SearchCorpusRow[]>>();

/**
 * One bank's search corpus, written by `npm run generate:asset-manifest` (prebuild, predev,
 * pretest). The path is a constant so file tracing ships only that directory.
 */
export function loadBankSearchCorpus(
  slug: BankSlug,
  read: (path: string) => Promise<string> = (path) => readFile(path, "utf8"),
): Promise<readonly SearchCorpusRow[]> {
  const name = assetManifestFileName(slug);
  const cached = cache.get(name);
  if (cached) return cached;
  const loaded = read(join(process.cwd(), "generated", "question-search", name))
    .then((text) => JSON.parse(text) as SearchCorpusRow[]);
  cache.set(name, loaded);
  void loaded.catch(() => { if (cache.get(name) === loaded) cache.delete(name); });
  return loaded;
}
