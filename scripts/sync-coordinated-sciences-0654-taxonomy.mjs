#!/usr/bin/env node
/**
 * Repoint (copy) the emitted IGCSE Co-ordinated Sciences 0654 taxonomy into this app
 * checkout, byte-for-byte, with an exact sha256 pin.
 *
 * Source of the emitted taxonomy (pinned):
 *   <PASTPAPERPREP_IGCSE_COORDINATED_TAXONOMY_SOURCE>
 *     default: /Users/sakshamgoel/Documents/ProjectsInternships/pastpaperprep/src/data/igcse-coordinated-sciences-0654-taxonomy.json
 *   produced by the source repo's scripts/emit_app_taxonomy.py
 *
 * Output:
 *   src/data/igcse-coordinated-sciences-0654-taxonomy.json
 *
 * The copy is byte-identical, so the taxonomy file sha256 equals the frozen
 * emitted-taxonomy hash and the runtime seal can pin it directly. The script is
 * idempotent and refuses to write anything else. It never rewrites, merges, or
 * "repairs" the taxonomy: the flat shape is adapted by consumers, not edited.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const TAXONOMY_SHA256 = "0f4790a44465163b5d8f6b1e09120df11e256f473f9e4b929fc6bf467aafdc6e";
export const DEFAULT_TAXONOMY_SOURCE = "/Users/sakshamgoel/Documents/ProjectsInternships/pastpaperprep/src/data/igcse-coordinated-sciences-0654-taxonomy.json";

export function taxonomySourcePath(environment = process.env) {
  return environment.PASTPAPERPREP_IGCSE_COORDINATED_TAXONOMY_SOURCE?.trim() || DEFAULT_TAXONOMY_SOURCE;
}

export function taxonomyOutputPath(repo = path.resolve(import.meta.dirname, "..")) {
  return path.join(repo, "src/data/igcse-coordinated-sciences-0654-taxonomy.json");
}

export async function syncTaxonomy({ repo, environment = process.env } = {}) {
  const source = taxonomySourcePath(environment);
  const bytes = await readFile(source);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== TAXONOMY_SHA256) {
    throw new Error(`0654 taxonomy sha256 mismatch: expected ${TAXONOMY_SHA256}, got ${digest}`);
  }
  const output = taxonomyOutputPath(repo);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, bytes);
  return { source, output, sha256: digest, bytes: bytes.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const result = await syncTaxonomy();
  console.log(`${result.output}: ${result.bytes} bytes, sha256=${result.sha256}`);
}
