import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { encodeImageSizes, imageSizeLookup, questionShapes } from "@/lib/image-sizes";

// The CLI, run against a throwaway repo: a paid 9709 question (never read from the bucket) whose
// crop is not on this machine.
const BANK = "a-level-maths-9709";
const ID = "9709-2026-m-12-q1";
const PATH = `${BANK}/releases/r1/questions/9709-2026-m-12/q1-3-1.webp`;
const fixtures: string[] = [];

function fixture(committed: Map<string, readonly [number, number]> | null) {
  const root = mkdtempSync(join(tmpdir(), "image-sizes-"));
  fixtures.push(root);
  mkdirSync(join(root, "generated", "asset-manifest"), { recursive: true });
  mkdirSync(join(root, "siblings"));
  writeFileSync(join(root, "generated", "asset-manifest", `${BANK}.production.json`), JSON.stringify({
    [ID]: { questionAssetPaths: [PATH], markschemeAssetPaths: [], details: { summary: "", accessibleText: "", solution: null, sourceQuestionUrl: null, sourceMarkSchemeUrl: null } },
  }));
  if (committed) {
    mkdirSync(join(root, "src", "data", "image-sizes"), { recursive: true });
    writeFileSync(join(root, "src", "data", "image-sizes", `${BANK}.json`), JSON.stringify(encodeImageSizes(committed)));
  }
  return root;
}

function run(root: string, ...flags: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", "scripts/generate-image-sizes.mts", "--bank", BANK, "--no-bucket", ...flags], {
    cwd: process.cwd(), encoding: "utf8", env: { ...process.env, PPP_REPO_ROOT: root, PPP_INGESTION_ROOT: join(root, "siblings") },
  });
}

const read = (root: string, folder: string) => JSON.parse(readFileSync(join(root, "src", "data", folder, `${BANK}.json`), "utf8"));

afterEach(() => { for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("generate-image-sizes CLI", () => {
  it("keeps a known size when the crop is not available offline, and writes its question shape", () => {
    const root = fixture(new Map([[PATH, [774, 1081] as const]]));
    const result = run(root);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("1 kept from the committed file");
    expect(imageSizeLookup(read(root, "image-sizes"))(PATH)).toEqual([774, 1081]);
    expect(questionShapes(read(root, "image-shapes"), ID)).toEqual([[774, 1081]]);
  }, 30_000);

  it("drops it only with --allow-coverage-loss", () => {
    const root = fixture(new Map([[PATH, [774, 1081] as const]]));
    const result = run(root, "--allow-coverage-loss");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("1 DROPPED");
    expect(imageSizeLookup(read(root, "image-sizes"))(PATH)).toBeNull();
  }, 30_000);

  it("writes nothing when a re-measured size disagrees with the committed one", () => {
    const root = fixture(new Map([[PATH, [774, 1000] as const]]));
    // The crop is on disk this time, with a different size than the committed file says.
    const crop = join(root, "siblings", "cambridge-a-level-mathematics-9709-topic-practice", "assets", "9709-2026-m-12", "questions");
    mkdirSync(crop, { recursive: true });
    const header = Buffer.alloc(30);
    header.write("RIFF", 0); header.write("WEBP", 8); header.write("VP8X", 12);
    header.writeUIntLE(774 - 1, 24, 3); header.writeUIntLE(1081 - 1, 27, 3);
    writeFileSync(join(crop, "q1-3-1.webp"), header);
    const before = readFileSync(join(root, "src", "data", "image-sizes", `${BANK}.json`), "utf8");
    const result = run(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("was 774x1000, now measures 774x1081");
    expect(readFileSync(join(root, "src", "data", "image-sizes", `${BANK}.json`), "utf8")).toBe(before);
    expect(() => read(root, "image-shapes")).toThrow();
    expect(run(root, "--allow-size-changes").status).toBe(0);
    expect(imageSizeLookup(read(root, "image-sizes"))(PATH)).toEqual([774, 1081]);
  }, 30_000);
});
