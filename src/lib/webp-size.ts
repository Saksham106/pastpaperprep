/**
 * Width and height of a WebP image from its first 30 bytes (RIFF header + first chunk), without
 * decoding it. Returns null for anything that is not a well-formed VP8, VP8L or VP8X header.
 */
export function webpSize(bytes: Uint8Array): [number, number] | null {
  if (bytes.length < 30) return null;
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WEBP") return null;
  const chunk = ascii(12, 4);
  const u16 = (at: number) => bytes[at] | (bytes[at + 1] << 8);
  const u24 = (at: number) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
  let size: [number, number] | null = null;
  if (chunk === "VP8 ") {
    // Lossy key frame: 3-byte frame tag, start code 9d 01 2a, then 14-bit width and height.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    size = [u16(26) & 0x3fff, u16(28) & 0x3fff];
  } else if (chunk === "VP8L") {
    // Lossless: signature 0x2f, then 14-bit (width - 1) and (height - 1), packed little-endian.
    if (bytes[20] !== 0x2f) return null;
    const bits = (bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)) >>> 0;
    size = [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
  } else if (chunk === "VP8X") {
    // Extended: 24-bit (canvas width - 1) and (canvas height - 1) after 4 flag bytes.
    size = [u24(24) + 1, u24(27) + 1];
  }
  return size && size[0] > 0 && size[1] > 0 ? size : null;
}
