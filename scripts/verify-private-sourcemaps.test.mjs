import { describe, expect, it, vi } from "vitest";
const { readdirSync, unlinkSync } = vi.hoisted(() => ({ readdirSync: vi.fn(), unlinkSync: vi.fn() }));
vi.mock("node:fs", async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, readdirSync, unlinkSync, default: { ...actual.default, readdirSync, unlinkSync } };
});
import { assertPrivateSourceMaps, removePublicSourceMaps } from "./verify-private-sourcemaps.mjs";
const file = name => ({ name, isDirectory: () => false });

describe("public source-map deployment gate", () => {
  it("removes a late-generated public map without deleting the executable asset", () => {
    readdirSync.mockReturnValue([file("runtime.js"), file("runtime.js.map")]);
    unlinkSync.mockImplementation(() => readdirSync.mockReturnValue([file("runtime.js")]));
    expect(removePublicSourceMaps("/fixture/static")).toBe(1);
    expect(unlinkSync).toHaveBeenCalledWith("/fixture/static/runtime.js.map");
    expect(unlinkSync).not.toHaveBeenCalledWith("/fixture/static/runtime.js");
    expect(assertPrivateSourceMaps("/fixture/static")).toBe(true);
  });
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
