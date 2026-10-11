#!/usr/bin/env node
// Builds the landing hero layers from the owner-supplied engraving:
//   public/artwork/landing-gothic.webp        full scene (background)
//   public/artwork/landing-gothic-front.webp  same scene with the sky removed (foreground)
// The sky is found by flood-filling light pixels from the top edge on a smoothed
// luminance map, then feathered so the cut edge stays soft.
// Usage: node scripts/landing-artwork.mjs "<source.png>" [threshold=205]
import path from "node:path";
import sharp from "sharp";

const [source, thresholdArg] = process.argv.slice(2);
if (!source) {
  console.error("Usage: node scripts/landing-artwork.mjs <source.png> [threshold]");
  process.exit(1);
}
const threshold = Number(thresholdArg ?? 205);
const outDir = path.join(process.cwd(), "public/artwork");

const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;

const lum = new Float32Array(w * h);
for (let i = 0; i < w * h; i++) lum[i] = 0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2];

const box = (input, radius) => {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let sum = 0;
    let count = 0;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const yy = y + dy;
      const xx = x + dx;
      if (yy >= 0 && yy < h && xx >= 0 && xx < w) { sum += input[yy * w + xx]; count++; }
    }
    out[y * w + x] = sum / count;
  }
  return out;
};

// Smooth so faint hatching in the sky does not stop the fill.
const smooth = box(lum, 2);
const sky = new Float32Array(w * h);
const queue = [];
for (let x = 0; x < w; x++) if (smooth[x] > threshold) { sky[x] = 1; queue.push(x); }
while (queue.length) {
  const point = queue.pop();
  const x = point % w;
  const y = (point / w) | 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const xx = x + dx;
    const yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
    const key = yy * w + xx;
    if (!sky[key] && smooth[key] > threshold) { sky[key] = 1; queue.push(key); }
  }
}

const feathered = box(sky, 2);
const front = Buffer.from(data);
for (let i = 0; i < w * h; i++) front[i * 4 + 3] = Math.round(255 * (1 - feathered[i]));

await sharp(source).webp({ quality: 82 }).toFile(path.join(outDir, "landing-gothic.webp"));
await sharp(front, { raw: { width: w, height: h, channels: 4 } })
  .webp({ quality: 80, alphaQuality: 90 })
  .toFile(path.join(outDir, "landing-gothic-front.webp"));

const skyFraction = sky.reduce((total, value) => total + value, 0) / (w * h);
console.log(`${w}x${h}, sky fraction ${skyFraction.toFixed(2)}`);
