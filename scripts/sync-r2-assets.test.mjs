import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { referencedWebpFiles, SOURCES } from "./sync-r2-assets.mjs";

describe("R2 asset source configuration", () => {
  it("requires runtime JSON references for every bank and has no source-root fallback", () => {
    const banks = [
      "igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl",
      "ib-chemistry-hl", "ib-chemistry-sl", "ib-physics-hl", "ib-physics-sl",
    ];
    expect(SOURCES).toHaveLength(10);
    expect(SOURCES.map((source) => source.bank)).toEqual(banks);
    expect(SOURCES.map((source) => source.raw)).toEqual(banks.map((bank) => `${process.cwd()}/src/data/raw/${bank}.json`));
    expect(SOURCES.every((source) => source.raw && source.imageFields?.length)).toBe(true);
    expect(SOURCES.filter((source) => source.imageFields.includes("markschemeImages"))).toHaveLength(2);
    expect(SOURCES.filter((source) => source.officialMarkschemeImages)).toHaveLength(8);
  });

  it("selects only referenced WebPs across direct and official markscheme schemas", async () => {
    const root = await mkdtemp(join(tmpdir(), "r2-assets-"));
    try {
      await mkdir(join(root, "questions"));
      await mkdir(join(root, "markschemes"));
      for (const path of [
        "questions/referenced.webp", "questions/unreferenced.webp", "markschemes/referenced.webp",
      ]) await writeFile(join(root, path), "fixture");

      const directRaw = join(root, "direct.json");
      await writeFile(directRaw, JSON.stringify({ questions: [{
        id: "direct-q1",
        questionImages: ["questions/referenced.webp"],
        markschemeImages: ["markschemes/referenced.webp"],
      }] }));
      const direct = await referencedWebpFiles({
        bank: "igcse", root, raw: directRaw, imageFields: ["questionImages", "markschemeImages"],
      });
      expect(direct.map((file) => file.relative)).toEqual([
        "markschemes/referenced.webp", "questions/referenced.webp",
      ]);

      const officialRaw = join(root, "official.json");
      await writeFile(officialRaw, JSON.stringify({ questions: [{
        id: "official-q1",
        questionImages: ["questions/referenced.webp"],
        officialMarkscheme: { images: ["markschemes/referenced.webp"] },
      }] }));
      const official = await referencedWebpFiles({
        bank: "ib-hl", root, raw: officialRaw, imageFields: ["questionImages"], officialMarkschemeImages: true,
      });
      expect(official.map((file) => file.relative)).toEqual([
        "markschemes/referenced.webp", "questions/referenced.webp",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed on missing, malformed, and escaping references", async () => {
    const root = await mkdtemp(join(tmpdir(), "r2-assets-"));
    try {
      await mkdir(join(root, "questions"));
      const raw = join(root, "raw.json");
      const source = { bank: "igcse", root, raw, imageFields: ["questionImages", "markschemeImages"] };
      await writeFile(raw, JSON.stringify({ questions: [{ id: "q1", questionImages: ["../outside.webp"], markschemeImages: [] }] }));
      await expect(referencedWebpFiles(source)).rejects.toThrow(/escapes source root/);
      await writeFile(raw, JSON.stringify({ questions: [{ id: "q1", questionImages: ["questions/missing.webp"], markschemeImages: [] }] }));
      await expect(referencedWebpFiles(source)).rejects.toThrow(/Missing referenced/);
      await writeFile(raw, JSON.stringify({ questions: [{ id: "q1", questionImages: ["questions/not-an-image.png"], markschemeImages: [] }] }));
      await expect(referencedWebpFiles(source)).rejects.toThrow(/Invalid referenced/);
      await expect(referencedWebpFiles({ bank: "igcse", root, imageFields: ["questionImages"] })).rejects.toThrow(/Missing runtime JSON path/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
