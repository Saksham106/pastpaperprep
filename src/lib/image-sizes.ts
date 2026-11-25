/** [width, height] in source pixels. */
export type ImageSize = readonly [number, number];

/**
 * src/data/image-sizes/<bank>.json, written by scripts/generate-image-sizes.mts. Paths are
 * `prefix + dir + name + ".webp"`; each folder holds its usual width once, and a size is the
 * height alone when the crop has that width.
 */
export type EncodedImageSizes = { prefix: string; dirs: Record<string, [number, Record<string, number | [number, number]>]> };

const EXTENSION = ".webp";

export function isImageSize(value: unknown): value is ImageSize {
  return Array.isArray(value) && value.length === 2 && value.every((part) => Number.isSafeInteger(part) && part > 0);
}

function split(path: string): [string, string] {
  const slash = path.lastIndexOf("/") + 1;
  return [path.slice(0, slash), path.slice(slash)];
}

export function encodeImageSizes(sizes: ReadonlyMap<string, ImageSize>): EncodedImageSizes {
  const paths = [...sizes.keys()].filter((path) => path.endsWith(EXTENSION)).sort();
  let prefix = paths.length ? split(paths[0])[0] : "";
  for (const path of paths) while (!path.startsWith(prefix)) prefix = prefix.slice(0, prefix.lastIndexOf("/", prefix.length - 2) + 1);
  const byDir = new Map<string, Array<[string, ImageSize]>>();
  for (const path of paths) {
    const [dir, name] = split(path.slice(prefix.length));
    byDir.set(dir, [...(byDir.get(dir) ?? []), [name.slice(0, -EXTENSION.length), sizes.get(path)!]]);
  }
  const dirs: EncodedImageSizes["dirs"] = {};
  for (const [dir, entries] of byDir) {
    const counts = new Map<number, number>();
    for (const [, [width]] of entries) counts.set(width, (counts.get(width) ?? 0) + 1);
    const width = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    dirs[dir] = [width, Object.fromEntries(entries.map(([name, [w, h]]) => [name, w === width ? h : [w, h]]))];
  }
  return { prefix, dirs };
}

export function imageSizeLookup(encoded: EncodedImageSizes | null | undefined): (path: string) => ImageSize | null {
  if (!encoded) return () => null;
  return (path) => {
    if (!path.startsWith(encoded.prefix) || !path.endsWith(EXTENSION)) return null;
    const [dir, name] = split(path.slice(encoded.prefix.length));
    const folder = encoded.dirs[dir];
    const value = folder?.[1][name.slice(0, -EXTENSION.length)];
    const size = typeof value === "number" ? [folder[0], value] : value;
    return isImageSize(size) ? size : null;
  };
}
