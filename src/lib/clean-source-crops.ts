import cleanSourceCrops from '@/data/reviewed-clean-source-crops.json';
import type { BankSlug } from '@/lib/banks';

type CleanCrop = { oldSha256: string; sha256: string };
const banks = cleanSourceCrops.banks as Partial<Record<BankSlug, Record<string, CleanCrop>>>;

/**
 * Reviewed re-renders of crops whose source PDFs carried a third-party watermark. Each live path,
 * including earlier repair crops, maps to the same geometry rendered from a clean copy.
 */
export function cleanSourceCropPaths(bank: BankSlug, paths: readonly string[]): string[] {
  const entries = banks[bank];
  if (!entries) return [...paths];
  return paths.map((path) => {
    const entry = Object.prototype.hasOwnProperty.call(entries, path) ? entries[path] : undefined;
    if (!entry) return path;
    if (!/^repairs\/clean-source-v1-[a-f0-9]{16}$/.test(cleanSourceCrops.namespace) ||
        ![entry.oldSha256, entry.sha256].every((hash) => /^[a-f0-9]{64}$/.test(hash)) || entry.oldSha256 === entry.sha256) {
      throw new Error(`Reviewed clean source crop disagrees with ${bank}:${path}`);
    }
    return `${cleanSourceCrops.namespace}/${entry.sha256}.webp`;
  });
}
