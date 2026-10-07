import { describe, expect, it, vi } from "vitest";
const { readdirSync } = vi.hoisted(() => ({ readdirSync: vi.fn() }));
vi.mock("node:fs", async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, readdirSync, default: { ...actual.default, readdirSync } };
});
import { assertPrivateSourceMaps } from "./verify-private-sourcemaps.mjs";
const file = name => ({ name, isDirectory: () => false });

describe("public source-map deployment gate", () => {
  it("accepts an artifact without source maps", () => {
    readdirSync.mockReturnValue([file("chunk.js"), file("theme.css")]);
    expect(assertPrivateSourceMaps("/fixture/static")).toBe(true);
  });
  it("blocks deployment when JavaScript maps remain", () => {
    readdirSync.mockReturnValue([file("chunk.js.map")]);
    expect(() => assertPrivateSourceMaps("/fixture/static")).toThrow(/Refusing to publish/);
  });
  it("blocks CSS maps too, including files in nested directories", () => {
    readdirSync.mockImplementation(path => path.endsWith("chunks") ? [file("theme.css.map")] : [{ name: "chunks", isDirectory: () => true }]);
    expect(() => assertPrivateSourceMaps("/fixture/static")).toThrow(/Refusing to publish/);
  });
});
