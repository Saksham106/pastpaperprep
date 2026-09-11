import { describe, expect, it } from "vitest";
import { isLocalEconomicsPreviewEnabled, resolveLocalPreviewAsset } from "@/lib/local-preview";

describe("local Economics preview asset boundary", () => {
  it("resolves only derived WebP question and markscheme assets inside the mounted source", () => {
    const root = "/private/ib-economics-topic-practice";
    expect(resolveLocalPreviewAsset(root, "ib-economics-hl/questions/2025-may-tz1-hl-p1-q01/question-01.webp")).toBe(
      `${root}/site/assets/ib-economics/questions/2025-may-tz1-hl-p1-q01/question-01.webp`,
    );
    expect(resolveLocalPreviewAsset(root, "ib-economics-sl/markschemes/2025-may-tz1-sl-p1-q01/markscheme-01.webp")).toContain("/site/assets/ib-economics/markschemes/");
  });

  it("rejects traversal, raw PDFs, unknown banks, and a disabled production process", () => {
    const root = "/private/ib-economics-topic-practice";
    expect(() => resolveLocalPreviewAsset(root, "ib-economics-hl/../raw/paper.pdf")).toThrow("invalid");
    expect(() => resolveLocalPreviewAsset(root, "ib-economics-hl/questions/../../paper.webp")).toThrow("invalid");
    expect(() => resolveLocalPreviewAsset(root, "ib-economics-hl/questions/paper.pdf")).toThrow("invalid");
    expect(() => resolveLocalPreviewAsset(root, "ib-physics-hl/questions/q.webp")).toThrow("invalid");
    expect(isLocalEconomicsPreviewEnabled({ NODE_ENV: "production", PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW: "true" })).toBe(false);
  });
});
