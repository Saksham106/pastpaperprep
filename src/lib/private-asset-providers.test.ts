import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isR2OnlyObjectPath, premiumAssetSignOptions, previewAssetSignOptions } from "./private-asset-providers";

describe("bank asset storage provider mapping", () => {
  it.each(["ib-economics-hl", "ib-economics-sl"] as const)("signs %s previews from their verified R2 storage", (bank) => {
    expect(previewAssetSignOptions(bank)).toEqual({ provider: "r2" });
  });

  it.each(["igcse-biology-0610", "igcse-economics-0455", "igcse-chemistry-0620", "igcse-physics-0625", "igcse-coordinated-sciences-0654"] as const)("preserves the existing %s preview provider", (bank) => {
    expect(previewAssetSignOptions(bank)).toEqual({ provider: "r2" });
  });

  it.each(["igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl"] as const)("preserves retained Supabase previews for %s", (bank) => {
    expect(previewAssetSignOptions(bank)).toEqual({ provider: "supabase" });
  });

  it.each(["ib-biology-hl", "ib-biology-sl", "ib-chemistry-hl", "ib-chemistry-sl", "ib-physics-hl", "ib-physics-sl"] as const)("signs %s free years (2016-2020) from R2, which holds every object they serve", (bank) => {
    expect(previewAssetSignOptions(bank)).toEqual({ provider: "r2" });
    expect(premiumAssetSignOptions(bank)).toEqual({});
  });

  it.each(["ib-economics-hl", "ib-economics-sl"] as const)("keeps %s premium assets pinned to R2", (bank) => {
    expect(premiumAssetSignOptions(bank)).toEqual({ provider: "r2" });
  });

  it("does not change configured premium-provider selection for legacy banks", () => {
    expect(premiumAssetSignOptions("ib-sl")).toEqual({});
  });

  it("treats exactly the R2-only shared-stimulus repair crops as R2-only", () => {
    const manifest = JSON.parse(readFileSync("data/storage/ib-shared-stimulus-repairs.manifest.json", "utf8")) as { objects: { objectKey: string }[] };
    expect(manifest.objects.length).toBeGreaterThan(0);
    for (const { objectKey } of manifest.objects) expect(isR2OnlyObjectPath(objectKey)).toBe(true);
    expect(isR2OnlyObjectPath("ib-biology-sl/questions/2020-november-tz0-sl-p1-q1-page-3.webp")).toBe(false);
    expect(isR2OnlyObjectPath("igcse-additional/repairs/ib-shared-stimulus-v1-d53ab265e7e81518/a.webp")).toBe(false);
    expect(isR2OnlyObjectPath("ib-biology-sl/repairs/other-v1/a.webp")).toBe(false);
  });
});
