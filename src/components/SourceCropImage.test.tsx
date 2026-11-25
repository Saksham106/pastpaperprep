import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AssetPlaceholder, MarkSchemeImage, SourceCropImage } from "@/components/SourceCropImage";
import approved from "@/data/reviewed-blank-tails-0606.json";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { imageSizeLookup, type EncodedImageSizes } from "@/lib/image-sizes";
import { visiblePlaceholderSize } from "@/lib/reviewed-blank-tails";

/** Checked against the file itself with macOS `sips -g pixelWidth -g pixelHeight`. */
const KNOWN_9709_Q1_SIZE = [774, 1081] as const;

const { verifyBytes } = vi.hoisted(() => ({ verifyBytes: vi.fn() }));
vi.mock("@/lib/verified-asset-bytes", () => ({ fetchVerifiedImageBlob: verifyBytes }));
const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: track }));

const id = "0606-2016-june-13-q11";
const crop = { imageSha256: approved.entries[id].imageSha256,
  fullWidthPx: 1070, fullHeightPx: 4501, visibleHeightPx: 3153 };

describe("SourceCropImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyBytes.mockResolvedValue(new Blob(["verified-image"], { type: "image/webp" }));
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:verified-q11") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  });

  it("clips only after hash verification, preserving source width and cleaning the Blob URL", async () => {
    const { container, unmount } = render(<SourceCropImage bankSlug="igcse-additional" questionId={id} src="/q11.webp" alt="Q11" crop={crop} />);
    expect(screen.queryByRole("img", { name: "Q11" })).toBeNull();
    expect(screen.getByRole("status", { name: "Verifying original image" })).toBeTruthy();
    const image = await screen.findByRole("img", { name: "Q11" });
    const frame = container.querySelector(".source-tail-clipped") as HTMLElement;
    expect(frame.style.aspectRatio).toBe("1070 / 3153");
    expect(image.getAttribute("width")).toBe("1070");
    expect(image.getAttribute("height")).toBe("4501");
    expect(image.getAttribute("src")).toBe("blob:verified-q11");
    expect(verifyBytes).toHaveBeenCalledWith("/q11.webp", crop.imageSha256);
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:verified-q11");
  });

  it("shows the full unchanged image on a hash mismatch instead of hiding possible content", async () => {
    verifyBytes.mockRejectedValueOnce(new Error("Verified image SHA-256 mismatch"));
    const { container } = render(<SourceCropImage bankSlug="igcse-additional" questionId={id} src="/q11.webp" alt="Q11" crop={crop} />);
    const image = await screen.findByRole("img", { name: "Q11" });
    expect(image.getAttribute("src")).toBe("/q11.webp");
    expect(container.querySelector(".source-tail-clipped")).toBeNull();
  });

  it("never applies a signer-provided earlier crop even with the correct image SHA", async () => {
    const { container } = render(<SourceCropImage bankSlug="igcse-additional" questionId={id}
      src="/q11.webp" alt="Q11" crop={{ ...crop, visibleHeightPx: 3000 }} />);
    const image = await screen.findByRole("img", { name: "Q11" });
    expect(image.getAttribute("src")).toBe("/q11.webp");
    expect(container.querySelector(".source-tail-clipped")).toBeNull();
    expect(verifyBytes).not.toHaveBeenCalled();
  });

  it("does not wrap or hide content when no source page is reviewed as furniture", () => {
    const { container } = render(<SourceCropImage bankSlug="igcse" questionId="0580-control" src="/real-question.webp" alt="Real question" />);
    expect(container.querySelector(".source-tail-clipped")).toBeNull();
    expect(screen.getByRole("img", { name: "Real question" })).toBeTruthy();
  });

  it("loads a priority image eagerly with high fetch priority", () => {
    render(<SourceCropImage bankSlug="ib-sl" questionId="q" src="https://assets.example/q.webp" alt="Original question 1" priority />);
    const image = screen.getByAltText("Original question 1");
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("fetchpriority", "high");
  });

  it("keeps other images lazy", () => {
    render(<SourceCropImage bankSlug="ib-sl" questionId="q" src="https://assets.example/q.webp" alt="Original question 2" />);
    expect(screen.getByAltText("Original question 2")).toHaveAttribute("loading", "lazy");
  });

  it("reports the first priority image's load time once per directly loaded page, with only the store's kind", async () => {
    const entries = vi.spyOn(performance, "getEntriesByType").mockReturnValue([{ name: window.location.href } as PerformanceEntry]);
    try {
      const { unmount } = render(<SourceCropImage bankSlug="igcse" questionId="q1" src="https://free.pastpaperprep.com/images/igcse/questions/q1.webp" alt="Q1" priority />);
      fireEvent.load(screen.getByRole("img", { name: "Q1" }));
      await vi.waitFor(() => expect(track).toHaveBeenCalledTimes(1));
      expect(track).toHaveBeenCalledWith("question_image_first_load", { bank: "igcse", host: "free", verifiedCrop: false, ms: expect.any(Number) });
      expect(JSON.stringify(track.mock.calls)).not.toContain("q1.webp");
      unmount();
      render(<SourceCropImage bankSlug="igcse" questionId="q2" src="https://free.pastpaperprep.com/images/igcse/questions/q2.webp" alt="Q2" priority />);
      fireEvent.load(screen.getByRole("img", { name: "Q2" }));
      render(<SourceCropImage bankSlug="igcse" questionId="q3" src="/q3.webp" alt="Q3" />);
      fireEvent.load(screen.getByRole("img", { name: "Q3" }));
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(track).toHaveBeenCalledTimes(1);
    } finally { entries.mockRestore(); }
  });

  it("sends nothing when the bank page was reached by in-app navigation", async () => {
    vi.resetModules();
    const { SourceCropImage: FreshImage } = await import("@/components/SourceCropImage");
    const entries = vi.spyOn(performance, "getEntriesByType").mockReturnValue([{ name: "https://pastpaperprep.com/" } as PerformanceEntry]);
    const original = window.location.href;
    window.history.replaceState(null, "", "/banks/igcse");
    try {
      render(<FreshImage bankSlug="igcse" questionId="q9" src="https://free.pastpaperprep.com/images/igcse/questions/q9.webp" alt="Q9" priority />);
      fireEvent.load(screen.getByRole("img", { name: "Q9" }));
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(track).not.toHaveBeenCalled();
    } finally { entries.mockRestore(); window.history.replaceState(null, "", original); }
  });
});

/** Both boxes are width: 100% (max 900px) with height from the shape, so equal shapes mean equal boxes. */
function shapeOf(element: Element): string {
  const style = (element as HTMLElement).style.aspectRatio;
  return style || `${element.getAttribute("width")} / ${element.getAttribute("height")}`;
}

describe("question image boxes", () => {
  // A known crop: 9709 March 2026 Paper 12 Q1, as read from its WebP header by scripts/generate-image-sizes.mts.
  const path = "a-level-maths-9709/releases/full2118-v1-191db74b1cb4/questions/9709-2026-m-12/q1-3-1.webp";
  const size = imageSizeLookup(JSON.parse(readFileSync(join(process.cwd(), "src/data/image-sizes/a-level-maths-9709.json"), "utf8")) as EncodedImageSizes)(path);

  it("reserves the crop's real size, and its placeholder has exactly that shape", () => {
    expect(size).toEqual(KNOWN_9709_Q1_SIZE);
    const { container } = render(<><AssetPlaceholder size={size} label="Loading original question" />
      <SourceCropImage bankSlug="a-level-maths-9709" questionId="9709-2026-m-12-q1" src="/q1.webp" alt="Q1" size={size} /></>);
    const image = screen.getByRole("img", { name: "Q1" });
    expect(image).toHaveAttribute("width", String(KNOWN_9709_Q1_SIZE[0]));
    expect(image).toHaveAttribute("height", String(KNOWN_9709_Q1_SIZE[1]));
    expect(shapeOf(container.querySelector(".asset-placeholder")!)).toBe(shapeOf(image));
  });

  it("gives a reviewed clipped 0606 crop a placeholder of its clipped shape", async () => {
    verifyBytes.mockResolvedValue(new Blob(["verified-image"], { type: "image/webp" }));
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:verified-q11") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const placeholder = visiblePlaceholderSize("igcse-additional", id, [crop.fullWidthPx, crop.fullHeightPx]);
    expect(placeholder).toEqual([1070, 3153]);
    expect(visiblePlaceholderSize("igcse-additional", id, [1070, 4000])).toEqual([1070, 4000]);
    const { container } = render(<><AssetPlaceholder size={placeholder} />
      <SourceCropImage bankSlug="igcse-additional" questionId={id} src="/q11.webp" alt="Q11" crop={crop} size={[crop.fullWidthPx, crop.fullHeightPx]} /></>);
    const [loading, verifying] = container.querySelectorAll(".asset-placeholder, .source-tail-clipped");
    expect(shapeOf(loading)).toBe(shapeOf(verifying));
    await screen.findByRole("img", { name: "Q11" });
    expect(shapeOf(container.querySelector(".source-tail-clipped")!)).toBe(shapeOf(loading));
  });

  it("keeps placeholder and image the same shape when the size is unknown", () => {
    const { container } = render(<><AssetPlaceholder />
      <SourceCropImage bankSlug="igcse" questionId="q" src="/q.webp" alt="Unsized" /></>);
    expect(shapeOf(container.querySelector(".asset-placeholder")!)).toBe(shapeOf(screen.getByRole("img", { name: "Unsized" })));
  });

  it("sets a mark-scheme crop's natural width and shape before it loads", () => {
    render(<MarkSchemeImage src="/ms.webp" alt="MS" size={[1098, 185]} />);
    const image = screen.getByRole("img", { name: "MS" });
    expect(image.style.width).toBe("1098px");
    expect(image.style.height).toBe("auto");
    expect(shapeOf(image)).toBe("1098 / 185");
  });
});
