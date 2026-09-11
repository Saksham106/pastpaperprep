import hlManifest from "../../docs/ib-economics-asset-manifests/ib-economics-hl-upload-manifest.json";
import slManifest from "../../docs/ib-economics-asset-manifests/ib-economics-sl-upload-manifest.json";
import type { EconomicsBankSlug } from "@/lib/banks";

type Asset = {
  objectKey: string;
  sourcePath: string;
  kind: "question" | "markscheme";
  byteSize: number;
  sha256: string;
  referencedQuestionIds: string[];
};
export type EconomicsAssetUploadManifest = {
  schemaVersion: string;
  bank: EconomicsBankSlug;
  sourceRepository: string;
  sourceCommit: string;
  sourceRuntimeFile: string;
  upload: false;
  rawPdfIncluded: false;
  assets: Asset[];
};

const manifests: Record<EconomicsBankSlug, EconomicsAssetUploadManifest> = {
  "ib-economics-hl": hlManifest as EconomicsAssetUploadManifest,
  "ib-economics-sl": slManifest as EconomicsAssetUploadManifest,
};

export function buildEconomicsAssetUploadManifest(bank: EconomicsBankSlug): EconomicsAssetUploadManifest {
  const manifest = manifests[bank];
  if (
    manifest.schemaVersion !== "ib-economics-derived-asset-upload-manifest-v1" ||
    manifest.bank !== bank ||
    manifest.upload !== false ||
    manifest.rawPdfIncluded !== false ||
    manifest.assets.some((asset) => !asset.objectKey.startsWith(`${bank}/`) || !asset.objectKey.endsWith(".webp"))
  ) throw new Error("Economics asset manifest is not safe");
  return manifest;
}
