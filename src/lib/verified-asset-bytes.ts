/** Fetch and prove the actual signed WebP bytes before hiding reviewed furniture. */
export async function fetchVerifiedImageBlob(source: string, expectedSha256: string): Promise<Blob> {
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) throw new Error("Invalid reviewed image hash");
  const response = await fetch(source, { mode: "cors", cache: "no-store" });
  if (!response.ok) throw new Error("Could not verify the original image");
  const bytes = await response.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const actual = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (actual !== expectedSha256) throw new Error("Verified image SHA-256 mismatch");
  return new Blob([bytes], { type: "image/webp" });
}
