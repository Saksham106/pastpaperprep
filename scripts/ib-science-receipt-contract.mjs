import { createHash } from "node:crypto";

export const EXPECTED_RECEIPT_SHA256 = Object.freeze({
  chemistry: "8c7bd64eff664b90ed4287b138c8a9d2ea88e7eafecef91ae850ab8107b72dd9",
  biology: "399d07f38afa5818ca9d176747a3a6b9369e615de162f9c7a755b9402ba2599f",
  physics: "057bbec9a7392dd2a1ccacec9d69efbe909bc9149c1d9ae48f9bb3fbad0656f7",
});

export function receiptSha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertPinnedReceipt(key, bytes) {
  const actual = receiptSha256(bytes);
  const expected = EXPECTED_RECEIPT_SHA256[key];
  if (!expected) throw new Error(`${key}: missing immutable receipt pin`);
  if (actual !== expected) throw new Error(`${key}: receipt hash mismatch ${actual} != ${expected}`);
  return actual;
}
