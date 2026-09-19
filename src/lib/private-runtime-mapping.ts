import type { BankSlug } from "@/lib/banks";

/** Canonical private object namespaces. No local-preview fallback is allowed. */
export const PRIVATE_RUNTIME_OBJECT_PREFIXES: Partial<Record<BankSlug, string>> = {
  "ib-economics-hl": "ib-economics-hl/",
  "ib-economics-sl": "ib-economics-sl/",
  "igcse-biology-0610": "igcse-biology-0610/releases/full3441-v2-ms-repair-49ebf7ad184c/",
  "igcse-economics-0455": "igcse-economics-0455/releases/repaired-v6-9fae73bcd2a9/",
  "igcse-chemistry-0620": "igcse-chemistry-0620/releases/candidate-v2-6eeb3fccddb4/",
  "igcse-physics-0625": "igcse-physics-0625/releases/repaired-v2-d95657a79bfc/",
  "igcse-coordinated-sciences-0654": "igcse-coordinated-sciences-0654/releases/full4721-v1-6b161eb9e580/",
};

export function getPrivateBankObjectPrefix(bank: BankSlug): string {
  const prefix = PRIVATE_RUNTIME_OBJECT_PREFIXES[bank];
  if (!prefix) throw new Error(`No private runtime object mapping for ${bank}`);
  return prefix;
}

export function isPrivateRuntimeBank(bank: string): bank is BankSlug {
  return Object.prototype.hasOwnProperty.call(PRIVATE_RUNTIME_OBJECT_PREFIXES, bank);
}

export function privateStorageObjectPath(bank: BankSlug, relativePath: string): string {
  if (!isPrivateRuntimeBank(bank)) throw new Error(`No private runtime object mapping for ${bank}`);
  const normalized = relativePath.replace(/^\/+/, "");
  const parts = normalized.split("/");
  if (!normalized || !normalized.endsWith(".webp") || parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error("Private runtime asset path is invalid");
  }
  return `${getPrivateBankObjectPrefix(bank)}${normalized}`;
}
