// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { HEAP_MB, heapOption } from "./next-build.mjs";

test("keeps the worker-visible heap flag wherever the runtime accepts it", () => {
  expect(heapOption(() => true)).toBe(`--max-heap-size=${HEAP_MB}`);
});

test("falls back to a heap flag stock Node accepts in NODE_OPTIONS", () => {
  expect(heapOption(() => false)).toBe(`--max-old-space-size=${HEAP_MB}`);
});

test("the build script goes through the heap-aware wrapper", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  expect(pkg.scripts.build).toBe("node scripts/next-build.mjs");
});
