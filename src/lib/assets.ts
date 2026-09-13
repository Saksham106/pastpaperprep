import { isIGCSEReleaseBank, isLocalEconomicsBank, type BankSlug, type EconomicsBankSlug, type LegacyProductionBankSlug } from "@/lib/banks";
import { privateStorageObjectPath } from "@/lib/private-runtime-mapping";

const PUBLIC_ASSET_ROOTS: Record<LegacyProductionBankSlug, string> = {
  igcse: "https://saksham106.github.io/igcse-0580-topic-practice/",
  "igcse-additional": "https://saksham106.github.io/igcse-additional-mathematics-0606-topic-practice/",
  "ib-hl": "https://saksham106.github.io/ib-maths-aa-hl-topic-practice/",
  "ib-sl": "https://saksham106.github.io/ib-maths-aa-topic-finder/",
  "ib-ai-hl": "https://saksham106.github.io/ib-maths-ai-hl-topic-practice/",
  "ib-ai-sl": "https://saksham106.github.io/ib-maths-ai-sl-topic-practice/",
  "ib-chemistry-hl": "https://saksham106.github.io/ib-chemistry-topic-practice/",
  "ib-chemistry-sl": "https://saksham106.github.io/ib-chemistry-topic-practice/",
  "ib-physics-hl": "https://saksham106.github.io/ib-physics-topic-practice/",
  "ib-physics-sl": "https://saksham106.github.io/ib-physics-topic-practice/",
  "ib-biology-hl": "https://saksham106.github.io/ib-biology-topic-practice/",
  "ib-biology-sl": "https://saksham106.github.io/ib-biology-topic-practice/",
};

export const QUESTION_ASSET_BUCKET = "question-assets";

export function storageObjectPath(bankSlug: BankSlug, publicAssetUrl: string): string {
  if (isIGCSEReleaseBank(bankSlug)) {
    return privateStorageObjectPath(bankSlug, publicAssetUrl);
  }
  const expectedRoot = new URL(PUBLIC_ASSET_ROOTS[bankSlug as LegacyProductionBankSlug]);
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

export function economicsStorageObjectPath(bankSlug: EconomicsBankSlug, relativeAssetPath: string): string {
  if (!isLocalEconomicsBank(bankSlug)) throw new Error("Invalid Economics asset path");
  return privateStorageObjectPath(bankSlug, relativeAssetPath);
}
