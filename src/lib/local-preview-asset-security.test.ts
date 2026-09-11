import { describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readContainedLocalPreviewAsset } from "@/lib/local-preview";

describe("local Economics preview asset reads", () => {
  it("rejects an asset-root symlink before invoking the reader", async () => {
    const root = await mkdtemp(join(tmpdir(), "pastpaperprep-preview-root-"));
    const outside = await mkdtemp(join(tmpdir(), "pastpaperprep-preview-outside-"));
    const assetParent = join(root, "site", "assets");
    const outsideAssetRoot = join(outside, "ib-economics");
    const outsideFile = join(outsideAssetRoot, "questions", "q", "question-01.webp");

    try {
      await mkdir(join(outsideAssetRoot, "questions", "q"), { recursive: true });
      await writeFile(outsideFile, "outside-secret");
      await mkdir(assetParent, { recursive: true });
      await symlink(outsideAssetRoot, join(assetParent, "ib-economics"));
      const readAsset = vi.fn(async () => Buffer.from("should-not-be-read"));

      await expect(readContainedLocalPreviewAsset(
        root,
        "ib-economics-hl/questions/q/question-01.webp",
        readAsset,
      )).rejects.toThrow("outside mounted root");
      expect(readAsset).not.toHaveBeenCalled();
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });
});