import type { BankSlug } from "@/lib/banks";

const PUBLIC_ASSET_ROOTS: Record<BankSlug, string> = {
  igcse: "https://saksham106.github.io/igcse-0580-topic-practice/",
  "igcse-additional": "https://saksham106.github.io/igcse-additional-mathematics-0606-topic-practice/",
  "ib-hl": "https://saksham106.github.io/ib-maths-aa-hl-topic-practice/",
  "ib-sl": "https://saksham106.github.io/ib-maths-aa-topic-finder/",
  "ib-ai-hl": "https://saksham106.github.io/ib-maths-ai-hl-topic-practice/",
  "ib-ai-sl": "https://saksham106.github.io/ib-maths-ai-sl-topic-practice/",
  "ib-chemistry-hl": "https://saksham106.github.io/ib-chemistry-topic-practice/",
  "ib-chemistry-sl": "https://saksham106.github.io/ib-chemistry-topic-practice/",
};

export const QUESTION_ASSET_BUCKET = "question-assets";

export function storageObjectPath(bankSlug: BankSlug, publicAssetUrl: string): string {
  const expectedRoot = new URL(PUBLIC_ASSET_ROOTS[bankSlug]);
  let assetUrl: URL;

  try {
    assetUrl = new URL(publicAssetUrl);
  } catch {
    throw new Error("Asset URL must be absolute");
  }

  if (assetUrl.protocol !== "https:" || assetUrl.origin !== expectedRoot.origin) {
    throw new Error("Asset host is not allowed");
  }

  if (!assetUrl.pathname.startsWith(expectedRoot.pathname)) {
    throw new Error("Asset does not belong to this bank");
  }

  const relativePath = decodeURIComponent(assetUrl.pathname.slice(expectedRoot.pathname.length));
  const segments = relativePath.split("/");
  if (
    !relativePath.endsWith(".webp") ||
    !relativePath ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Asset path is invalid");
  }

  return `${bankSlug}/${relativePath}`;
}
