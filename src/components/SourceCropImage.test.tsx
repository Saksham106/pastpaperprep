import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceCropImage } from "@/components/SourceCropImage";
import approved from "@/data/reviewed-blank-tails-0606.json";

const { verifyBytes } = vi.hoisted(() => ({ verifyBytes: vi.fn() }));
vi.mock("@/lib/verified-asset-bytes", () => ({ fetchVerifiedImageBlob: verifyBytes }));

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
});
