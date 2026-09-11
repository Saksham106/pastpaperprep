import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { isLocalEconomicsBank, isLocalEconomicsPreviewEnabled } from "@/lib/banks";

export { isLocalEconomicsPreviewEnabled };

const ASSET_ROOT = ["site", "assets", "ib-economics"] as const;

function decodeSegments(value: string): string[] {
  try {
    return value.split("/").map((segment) => decodeURIComponent(segment));
  } catch {
    throw new Error("Local preview asset path is invalid");
  }
}

/** Resolve a derived image from the explicitly mounted source checkout. */
export function resolveLocalPreviewAsset(sourceRoot: string, routePath: string): string {
  const segments = decodeSegments(routePath);
  const [bank, kind, ...asset] = segments;
  if (
    !isLocalEconomicsBank(bank ?? "") ||
    (kind !== "questions" && kind !== "markschemes") ||
    !asset.length ||
    !asset[asset.length - 1].endsWith(".webp") ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Local preview asset path is invalid");
  }

  const root = resolve(sourceRoot);
  const assetBase = resolve(root, ...ASSET_ROOT, kind === "questions" ? "questions" : "markschemes");
  const candidate = resolve(assetBase, ...asset);
  const relativeCandidate = relative(assetBase, candidate);
  if (relativeCandidate === ".." || relativeCandidate.startsWith(`..${sep}`) || relativeCandidate.includes(`${sep}..${sep}`)) {
    throw new Error("Local preview asset path is invalid");
  }
  return candidate;
}

type AssetReader = (path: string) => Promise<Buffer>;

function isContainedPath(root: string, target: string): boolean {
  const relativeTarget = relative(root, target);
  return relativeTarget !== ".."
    && !relativeTarget.startsWith(`..${sep}`)
    && !isAbsolute(relativeTarget);
}

/** Canonicalize the mount and candidate before allowing any target read. */
export async function readContainedLocalPreviewAsset(
  sourceRoot: string,
  routePath: string,
  reader: AssetReader = (path) => readFile(path),
): Promise<Buffer> {
  const mountedRoot = await realpath(resolve(sourceRoot));
  const mountedAssetRoot = await realpath(resolve(mountedRoot, ...ASSET_ROOT));
  if (!isContainedPath(mountedRoot, mountedAssetRoot)) {
    throw new Error("Local preview asset root is outside mounted root");
  }
  const candidate = resolveLocalPreviewAsset(mountedRoot, routePath);
  const canonicalTarget = await realpath(candidate);
  if (!isContainedPath(mountedRoot, canonicalTarget) || !isContainedPath(mountedAssetRoot, canonicalTarget)) {
    throw new Error("Local preview asset target is outside mounted root");
  }
  return reader(canonicalTarget);
}

export function localPreviewSourceRoot(environment: Record<string, string | undefined> = process.env): string | null {
  const root = environment.PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT?.trim();
  return root || null;
}
