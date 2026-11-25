import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { loadBankAssetManifest } from "@/lib/asset-manifest";
import { loadBankExplorer } from "@/lib/bank-explorer";
import { freeAssetIndexPath } from "@/lib/free-asset-index";
import { buildFreeAssetIndex } from "@/lib/free-public-assets";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

/** Placeholder and image are both full card width with height from this shape, so equal shapes mean equal heights. */
function shapes(card: Element): string[] {
  return [...card.querySelectorAll(".question-images .asset-placeholder, .question-images img")].map((element) =>
    (element as HTMLElement).style.aspectRatio || `${element.getAttribute("width")} / ${element.getAttribute("height")}`);
}

it("renders each card's loading placeholder in its image's real shape, so the image lands without moving the card", async () => {
  // The real server data path: the bank page's first cards and the free index the browser fetches.
  const explorer = (await loadBankExplorer("igcse"))!;
  const first = explorer.initialQuestions[0];
  expect(first.imageSizes?.length).toBe(first.questionImageCount);
  const index = buildFreeAssetIndex("igcse", await loadBankAssetManifest("igcse"), (_id, details) => details);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) !== freeAssetIndexPath("igcse")) return Response.json({});
    await held;
    return Response.json(index);
  }));

  const { container } = render(<QuestionExplorer questions={explorer.initialQuestions} bankSlug="igcse"
    access={{ authenticated: false, bankAccess: false, canExportPdf: false }} initialState={explorer.initialState} />);
  const card = container.querySelector("article.question-card")!;
  // Before any image link exists, the placeholders already have the crops' real shapes.
  const before = shapes(card);
  expect(before).toEqual(first.imageSizes!.map((size) => `${size![0]} / ${size![1]}`));
  expect(before).not.toContain("1400 / 1000");

  release();
  await waitFor(() => expect(card.querySelectorAll(".question-images img")).toHaveLength(first.questionImageCount));
  expect(card.querySelector(".question-images .asset-placeholder")).toBeNull();
  expect(shapes(card)).toEqual(before);
});
