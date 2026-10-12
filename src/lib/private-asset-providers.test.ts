import { describe, expect, it } from "vitest";
import { premiumAssetSignOptions, previewAssetSignOptions } from "./private-asset-providers";

describe("bank asset storage provider mapping", () => {
  it.each(["ib-economics-hl", "ib-economics-sl"] as const)("signs %s previews from their verified R2 storage", (bank) => {
    expect(previewAssetSignOptions(bank)).toEqual({ provider: "r2" });
  });

  it.each(["igcse-biology-0610", "igcse-economics-0455", "igcse-chemistry-0620", "igcse-physics-0625", "igcse-coordinated-sciences-0654"] as const)("preserves the existing %s preview provider", (bank) => {
    expect(previewAssetSignOptions(bank)).toEqual({ provider: "r2" });
  });

  it.each(["igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl", "ib-biology-hl", "ib-biology-sl", "ib-chemistry-hl", "ib-chemistry-sl", "ib-physics-hl", "ib-physics-sl"] as const)("preserves retained Supabase previews for %s", (bank) => {
    expect(previewAssetSignOptions(bank)).toEqual({ provider: "supabase" });
  });

  it.each(["ib-economics-hl", "ib-economics-sl"] as const)("keeps %s premium assets pinned to R2", (bank) => {
    expect(premiumAssetSignOptions(bank)).toEqual({ provider: "r2" });
  });

  it("does not change configured premium-provider selection for legacy banks", () => {
    expect(premiumAssetSignOptions("ib-sl")).toEqual({});
  });
});
