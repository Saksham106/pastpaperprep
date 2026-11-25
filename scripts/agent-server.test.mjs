// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { DEFAULTS, nodeOptionsWithHeap, parseFreePercent, positiveInt } from "./agent-server.mjs";

test("adds a heap cap and replaces any existing one", () => {
  expect(nodeOptionsWithHeap(undefined, 4096)).toBe("--max-old-space-size=4096");
  expect(nodeOptionsWithHeap("--inspect --max-old-space-size=12000", 2048)).toBe("--inspect --max-old-space-size=2048");
  expect(nodeOptionsWithHeap("--max_old_space_size=9000", 1024)).toBe("--max-old-space-size=1024");
});

test("reads free memory from macOS memory_pressure output", () => {
  expect(parseFreePercent("Pageouts: 1\n\nSystem-wide memory free percentage: 79%\n")).toBe(79);
  expect(parseFreePercent("unexpected")).toBeNull();
});

test("falls back to defaults for missing or bad numbers", () => {
  expect(positiveInt(undefined, 20)).toBe(20);
  expect(positiveInt("0", 20)).toBe(20);
  expect(positiveInt("abc", 20)).toBe(20);
  expect(positiveInt("5", 20)).toBe(5);
});

test("agent servers are capped well below half of RAM and stop on their own", () => {
  expect(DEFAULTS.dev.heapMb).toBeLessThanOrEqual(6144);
  expect(DEFAULTS.start.heapMb).toBeLessThanOrEqual(DEFAULTS.dev.heapMb);
  expect(DEFAULTS.minutes).toBeLessThanOrEqual(30);
});

test("package scripts go through the guarded wrapper and leave npm run dev alone", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  expect(pkg.scripts["dev:agent"]).toMatch(/node scripts\/agent-server\.mjs dev$/);
  expect(pkg.scripts["preview:agent"]).toBe("node scripts/agent-server.mjs start");
  expect(pkg.scripts.dev).toBe("next dev --webpack");
});
