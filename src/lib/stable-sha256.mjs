import { createHash } from "node:crypto";

/** Key-order-independent JSON value, keys sorted by code unit. */
export function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

/** SHA-256 of the key-sorted, whitespace-free JSON of a value (Node-only; not for client bundles). */
export function stableSha256(value) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}
