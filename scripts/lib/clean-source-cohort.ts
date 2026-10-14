/**
 * The approved clean-source crop cohort (docs/papacambridge-watermark-repairs.md): which objects may
 * be uploaded, and the only way to read their local bytes.
 */
import { createHash } from "node:crypto";
import { basename, dirname } from "node:path";
import { canonicalRoot, readConfined } from "./safe-files";

export const CLEAN_SOURCE_BANK = "igcse-chemistry-0620";
const OBJECT_PREFIX = "igcse-chemistry-0620/releases/candidate-v2-6eeb3fccddb4/";
const HASH = /^[a-f0-9]{64}$/;
const MAX_CROP_BYTES = 8 * 1024 * 1024;

type Entry = { oldSha256: string; sha256: string };
export type Projection = { schema: string; namespace: string; banks: Record<string, Record<string, Entry>> };
export type Manifest = { schema: string; projectionSha256: string; replacementCount: number; objectCount: number; objects: { objectKey: string; localPath: string; sha256: string; bytes: number }[] };
export type ApprovedObject = { objectKey: string; sha256: string; bytes: number; root: string; name: string };

const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

/** Same bytes as the generator's json.dumps(sort_keys=True, separators=(",", ":")). */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Digest of the reviewed path → crop assignments; any swap or edit changes it. */
export function projectionDigest(projection: Projection): string {
  return sha256(canonicalJson(projection.banks));
}

/**
 * The manifest's objects, only if the projection still hashes to its approved namespace and the
 * manifest covers exactly its crops. All sources must sit directly in one canonical folder.
 */
export function approvedObjects(manifest: Manifest, projection: Projection): ApprovedObject[] {
  const banks = Object.keys(projection.banks);
  if (projection.schema !== "reviewed-clean-source-crops-v1" || banks.length !== 1 || banks[0] !== CLEAN_SOURCE_BANK) throw new Error("Unexpected projection scope");
  const entries = Object.entries(projection.banks[CLEAN_SOURCE_BANK]);
  for (const [path, entry] of entries) {
    if (!entry || Object.keys(entry).sort().join() !== "oldSha256,sha256" || !HASH.test(entry.oldSha256) || !HASH.test(entry.sha256) || entry.oldSha256 === entry.sha256 || !path.endsWith(".webp")) {
      throw new Error(`Invalid projection entry ${path}`);
    }
  }
  const digest = projectionDigest(projection);
  if (manifest.schema !== "clean-source-crops-v1" || manifest.projectionSha256 !== digest || projection.namespace !== `repairs/clean-source-v1-${digest.slice(0, 16)}`) {
    throw new Error("Projection no longer matches its approved digest");
  }
  if (manifest.replacementCount !== entries.length) throw new Error("Replacement count disagrees with the projection");
  const wanted = new Set(entries.map(([, entry]) => `${OBJECT_PREFIX}${projection.namespace}/${entry.sha256}.webp`));
  const keys = new Set(manifest.objects.map((o) => o.objectKey));
  if (manifest.objectCount !== wanted.size || manifest.objects.length !== wanted.size || keys.size !== wanted.size || [...wanted].some((key) => !keys.has(key))) {
    throw new Error("Manifest does not cover the projection exactly");
  }
  const folders = new Set(manifest.objects.map((o) => dirname(o.localPath)));
  if (folders.size !== 1) throw new Error("Sources must share one folder");
  const [folder] = folders;
  const root = canonicalRoot(folder);
  if (root !== folder) throw new Error("Source folder must be canonical (no symlinks or aliases)");
  return manifest.objects.map((o) => {
    const name = `${o.sha256}.webp`;
    if (!HASH.test(o.sha256) || o.objectKey !== `${OBJECT_PREFIX}${projection.namespace}/${name}` || basename(o.localPath) !== name || !Number.isSafeInteger(o.bytes) || o.bytes < 1) {
      throw new Error(`Unsafe object ${o.objectKey}`);
    }
    return { objectKey: o.objectKey, sha256: o.sha256, bytes: o.bytes, root, name };
  });
}

/** The approved bytes, read without following symlinks and only from inside the source folder. */
export function readApproved(o: ApprovedObject): Buffer {
  const bytes = readConfined(o.root, o.name, MAX_CROP_BYTES);
  if (bytes.length !== o.bytes || sha256(bytes) !== o.sha256) throw new Error(`Source bytes differ for ${o.objectKey}`);
  return bytes;
}
