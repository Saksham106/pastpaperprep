import type { BankSlug } from "@/lib/banks";

/** Canonical private object namespaces. No local-preview fallback is allowed. */
export const PRIVATE_RUNTIME_OBJECT_PREFIXES: Partial<Record<BankSlug, string>> = {
  "ib-economics-hl": "ib-economics-hl/",
  "ib-economics-sl": "ib-economics-sl/",
  "igcse-biology-0610": "igcse-biology-0610/",
  "igcse-economics-0455": "igcse-economics-0455/",
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
