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

const same = (a: ImageSize, b: ImageSize) => a[0] === b[0] && a[1] === b[1];

/**
 * This run's measurements merged over the committed file, for the paths the bank delivers now.
 * A path not measured this run keeps its committed size unless coverage loss is allowed; a
 * measurement that differs from the committed size is reported as a change.
 */
export function mergeMeasuredSizes(
  paths: readonly string[],
  measured: ReadonlyMap<string, ImageSize>,
  previous: (path: string) => ImageSize | null,
  { allowCoverageLoss = false }: { allowCoverageLoss?: boolean } = {},
): { sizes: Map<string, ImageSize>; retained: string[]; lost: string[]; changed: Array<{ path: string; from: ImageSize; to: ImageSize }> } {
  const sizes = new Map<string, ImageSize>();
  const retained: string[] = [];
  const lost: string[] = [];
  const changed: Array<{ path: string; from: ImageSize; to: ImageSize }> = [];
  for (const path of paths) {
    const now = measured.get(path) ?? null;
    const before = previous(path);
    if (now) {
      if (before && !same(before, now)) changed.push({ path, from: before, to: now });
      sizes.set(path, now);
    } else if (before && !allowCoverageLoss) {
      sizes.set(path, before);
      retained.push(path);
    } else if (before) {
      lost.push(path);
    }
  }
  return { sizes, retained, lost, changed };
}

/**
 * src/data/image-shapes/<bank>.json: each question's images, in delivery order, as the height
 * alone when the image has the bank's usual `width`, [width, height] otherwise, or null when
 * unknown. Questions with no known size are left out.
 */
export type EncodedQuestionShapes = { width: number; questions: Record<string, Array<number | [number, number] | null>> };

export function encodeQuestionShapes(questions: ReadonlyArray<readonly [string, ReadonlyArray<ImageSize | null>]>): EncodedQuestionShapes {
  const counts = new Map<number, number>();
  for (const [, sizes] of questions) for (const size of sizes) if (size) counts.set(size[0], (counts.get(size[0]) ?? 0) + 1);
  const width = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
  const encoded: EncodedQuestionShapes["questions"] = {};
  for (const [id, sizes] of [...questions].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    if (!sizes.some(Boolean)) continue;
    encoded[id] = sizes.map((size) => !size ? null : size[0] === width ? size[1] : [size[0], size[1]]);
  }
  return { width, questions: encoded };
}

/** One question's image sizes, or undefined when none is known. */
export function questionShapes(encoded: EncodedQuestionShapes | null | undefined, id: string): Array<[number, number] | null> | undefined {
  const values = encoded && Object.hasOwn(encoded.questions, id) ? encoded.questions[id] : undefined;
  if (!Array.isArray(values)) return undefined;
  const sizes = values.map((value) => {
    const size = typeof value === "number" ? [encoded!.width, value] : value;
    return isImageSize(size) ? [size[0], size[1]] as [number, number] : null;
  });
  return sizes.some(Boolean) ? sizes : undefined;
}

/**
 * Questions whose recorded shapes no longer describe the question images the asset manifest
 * delivers (a crop was replaced or re-cut without re-running scripts/generate-image-sizes.mts).
 */
export function staleQuestionShapes(
  manifest: Readonly<Record<string, { questionAssetPaths: string[]; questionAssetSizes?: Array<[number, number] | null> }>>,
  shapes: EncodedQuestionShapes | null,
): string[] {
  if (!shapes) return [];
  const stale: string[] = [];
  for (const id of Object.keys(shapes.questions)) {
    const entry = Object.hasOwn(manifest, id) ? manifest[id] : undefined;
    const recorded = questionShapes(shapes, id) ?? [];
    const delivered = entry ? entry.questionAssetPaths.map((_, index) => entry.questionAssetSizes?.[index] ?? null) : [];
    const agrees = recorded.length === delivered.length && recorded.every((size, index) => {
      const actual = delivered[index];
      return size === null ? actual === null : actual !== null && size[0] === actual[0] && size[1] === actual[1];
    });
    if (!agrees) stale.push(id);
  }
  return stale;
}
