import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { approvedObjects, projectionDigest, readApproved, type Manifest, type Projection } from "./clean-source-cohort";

const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const prefix = "igcse-chemistry-0620/releases/candidate-v2-6eeb3fccddb4/";

/** Two reviewed crops, their candidate files and a matching manifest in a fresh folder. */
function cohort() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "clean-cohort-")));
  const files = [Buffer.from("question crop"), Buffer.from("markscheme crop")];
  const [q, m] = files.map((bytes) => { writeFileSync(join(root, `${sha(bytes)}.webp`), bytes); return sha(bytes); });
  const projection: Projection = { schema: "reviewed-clean-source-crops-v1", namespace: "", banks: { "igcse-chemistry-0620": {
    "questions/0620-2026-s-41/q2-4-1.webp": { oldSha256: "a".repeat(64), sha256: q },
    "markschemes/0620-2026-s-41/q2-8-1.webp": { oldSha256: "b".repeat(64), sha256: m },
  } } };
  const digest = projectionDigest(projection);
  projection.namespace = `repairs/clean-source-v1-${digest.slice(0, 16)}`;
  const manifest: Manifest = { schema: "clean-source-crops-v1", projectionSha256: digest, replacementCount: 2, objectCount: 2, objects: files.map((bytes) => ({
    objectKey: `${prefix}${projection.namespace}/${sha(bytes)}.webp`, localPath: join(root, `${sha(bytes)}.webp`), sha256: sha(bytes), bytes: bytes.length,
  })) };
  return { root, projection, manifest };
}

describe("clean-source upload cohort", () => {
  it("approves and reads an untouched cohort", () => {
    const { projection, manifest } = cohort();
    const objects = approvedObjects(manifest, projection);
    expect(objects.map((o) => readApproved(o).toString())).toEqual(["question crop", "markscheme crop"]);
  });

  it("refuses a projection whose question and mark-scheme crops were swapped", () => {
    const { projection, manifest } = cohort();
    const entries = projection.banks["igcse-chemistry-0620"];
    const [a, b] = Object.keys(entries);
    [entries[a].sha256, entries[b].sha256] = [entries[b].sha256, entries[a].sha256];
    expect(() => approvedObjects(manifest, projection)).toThrow(/approved digest/);
  });

  it("refuses an edited namespace or manifest digest", () => {
    const one = cohort();
    one.projection.namespace = "repairs/clean-source-v1-0000000000000000";
    expect(() => approvedObjects(one.manifest, one.projection)).toThrow(/approved digest/);
    const two = cohort();
    two.manifest.projectionSha256 = "f".repeat(64);
    expect(() => approvedObjects(two.manifest, two.projection)).toThrow(/approved digest/);
  });

  it("refuses sources outside the folder, through dot-dot, or behind a symlinked folder", () => {
    const outside = cohort();
    const elsewhere = realpathSync(mkdtempSync(join(tmpdir(), "clean-elsewhere-")));
    const moved = outside.manifest.objects[1];
    writeFileSync(join(elsewhere, `${moved.sha256}.webp`), readFileSync(moved.localPath));
    moved.localPath = join(elsewhere, `${moved.sha256}.webp`);
    expect(() => approvedObjects(outside.manifest, outside.projection)).toThrow(/one folder/);

    const dotted = cohort();
    mkdirSync(join(dotted.root, "sub"));
    for (const o of dotted.manifest.objects) o.localPath = `${dotted.root}/sub/../${o.sha256}.webp`;
    expect(() => approvedObjects(dotted.manifest, dotted.projection)).toThrow(/canonical/);

    const linked = cohort();
    const alias = join(realpathSync(mkdtempSync(join(tmpdir(), "clean-alias-"))), "candidates");
    symlinkSync(linked.root, alias);
    for (const o of linked.manifest.objects) o.localPath = join(alias, `${o.sha256}.webp`);
    expect(() => approvedObjects(linked.manifest, linked.projection)).toThrow(/canonical/);
  });

  it("refuses a symlinked candidate even when its bytes match", () => {
    const { root, projection, manifest } = cohort();
    const target = realpathSync(mkdtempSync(join(tmpdir(), "clean-target-")));
    const o = manifest.objects[0];
    writeFileSync(join(target, "real.webp"), readFileSync(o.localPath));
    const path = join(root, `${o.sha256}.webp`);
    rmSync(path);
    symlinkSync(join(target, "real.webp"), path);
    const [first] = approvedObjects(manifest, projection);
    expect(() => readApproved(first)).toThrow(/regular file/);
  });

  it("refuses a manifest that drops or adds an object", () => {
    const { projection, manifest } = cohort();
    manifest.objects.pop();
    manifest.objectCount = 1;
    expect(() => approvedObjects(manifest, projection)).toThrow(/cover the projection/);
  });

  it("matches the committed projection's namespace", () => {
    const projection = JSON.parse(readFileSync("src/data/reviewed-clean-source-crops.json", "utf8")) as Projection;
    const manifest = JSON.parse(readFileSync("data/storage/clean-source-crops.manifest.json", "utf8")) as Manifest;
    expect(manifest.projectionSha256).toBe(projectionDigest(projection));
    expect(projection.namespace).toBe(`repairs/clean-source-v1-${manifest.projectionSha256.slice(0, 16)}`);
  });
});
