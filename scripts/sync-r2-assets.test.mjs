import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { storageObjectPath } from "@/lib/assets";
import { localManifest, publicUrlRelativeKey, referencedWebpFiles, selectSources, SOURCES } from "./sync-r2-assets.mjs";

const IB_SCIENCE_BANKS = ["ib-chemistry-hl", "ib-chemistry-sl", "ib-physics-hl", "ib-physics-sl", "ib-biology-hl", "ib-biology-sl"];

describe("R2 asset source configuration", () => {
  it("requires runtime JSON references for every bank and has no source-root fallback", () => {
    const banks = [
      "igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl",
      "ib-chemistry-hl", "ib-chemistry-sl", "ib-physics-hl", "ib-physics-sl", "ib-biology-hl", "ib-biology-sl",
    ];
    expect(SOURCES).toHaveLength(12);
    expect(SOURCES.map((source) => source.bank)).toEqual(banks);
    expect(SOURCES.map((source) => source.raw)).toEqual(banks.map((bank) => `${process.cwd()}/src/data/raw/${bank}.json`));
    expect(SOURCES.every((source) => source.raw && source.imageFields?.length)).toBe(true);
    expect(SOURCES.filter((source) => source.imageFields.includes("markschemeImages"))).toHaveLength(2);
    expect(SOURCES.filter((source) => source.officialMarkschemeImages)).toHaveLength(10);
  });

  it("supports an explicit bank-only sync without accepting unknown banks", () => {
    expect(selectSources("igcse").map((source) => source.bank)).toEqual(["igcse"]);
    expect(selectSources("igcse,ib-hl").map((source) => source.bank)).toEqual(["igcse", "ib-hl"]);
    expect(() => selectSources("unknown-bank")).toThrow(/Unknown R2_SYNC_BANKS/);
    expect(() => selectSources(",")).toThrow(/at least one bank/);
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

  it("maps public asset URLs to the same R2 keys as production delivery", async () => {
    const chemistry = SOURCES.find((source) => source.bank === "ib-chemistry-hl");
    const root = "https://saksham106.github.io/ib-chemistry-topic-practice/";
    expect(publicUrlRelativeKey(chemistry, `${root}questions/2016-may-tz1-hl-p1-q1-page-2.webp`)).toBe("questions/2016-may-tz1-hl-p1-q1-page-2.webp");
    expect(publicUrlRelativeKey(chemistry, `${root}markschemes/a%20b.webp`)).toBe("markschemes/a b.webp");
    expect(() => publicUrlRelativeKey(chemistry, "http://saksham106.github.io/ib-chemistry-topic-practice/questions/a.webp")).toThrow(/host is not allowed/);
    expect(() => publicUrlRelativeKey(chemistry, "https://example.com/ib-chemistry-topic-practice/questions/a.webp")).toThrow(/host is not allowed/);
    expect(() => publicUrlRelativeKey(chemistry, `${root}questions/a.webp?v=1`)).toThrow(/host is not allowed/);
    expect(() => publicUrlRelativeKey(chemistry, "https://saksham106.github.io/ib-physics-topic-practice/questions/a.webp")).toThrow(/does not belong/);
    expect(() => publicUrlRelativeKey(chemistry, `${root}questions/..%2F..%2Fsecret.webp`)).toThrow(/escapes source root/);
    expect(() => publicUrlRelativeKey(chemistry, `${root}questions/a.png`)).toThrow(/Invalid referenced/);
    expect(() => publicUrlRelativeKey(SOURCES.find((source) => source.bank === "ib-hl"), `${root}questions/a.webp`)).toThrow(/no public root/);

    for (const bank of IB_SCIENCE_BANKS) {
      const source = SOURCES.find((candidate) => candidate.bank === bank);
      const raw = JSON.parse(await readFile(source.raw, "utf8"));
      const urls = raw.questions.flatMap((question) => [...question.questionImages, ...(question.officialMarkscheme?.images ?? [])])
        .filter((reference) => reference.startsWith("https://"));
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) expect(`${bank}/${publicUrlRelativeKey(source, url)}`).toBe(storageObjectPath(bank, url));
    }
  });

  it("resolves URL references through the committed upload manifest and checks source bytes", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "r2-assets-"));
    try {
      const repository = join(workspace, "ib-chemistry-topic-practice");
      await mkdir(join(repository, "site/questions"), { recursive: true });
      await mkdir(join(repository, "site-extension/questions"), { recursive: true });
      await writeFile(join(repository, "site/questions/base.webp"), "base");
      await writeFile(join(repository, "site-extension/questions/2016-q1.webp"), "extension");
      // A same-named file under site/ must not be picked up for an extension key.
      await writeFile(join(repository, "site/questions/2016-q1.webp"), "stale");

      const manifest = join(workspace, "manifest.json");
      const asset = (bytes) => ({
        objectKey: "questions/2016-q1.webp",
        sourcePath: "site-extension/questions/2016-q1.webp",
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
      const writeManifest = (assets, overrides = {}) => writeFile(manifest, JSON.stringify({
        schemaVersion: "ib-science-pending-upload-manifest.v1", bank: "ib-chemistry-hl", prefix: "ib-chemistry-hl/", assets, ...overrides,
      }));
      const raw = join(workspace, "raw.json");
      const publicRoot = "https://saksham106.github.io/ib-chemistry-topic-practice/";
      await writeFile(raw, JSON.stringify({ questions: [
        { id: "base", questionImages: ["questions/base.webp"], officialMarkscheme: null },
        { id: "extension", questionImages: [`${publicRoot}questions/2016-q1.webp`], officialMarkscheme: { images: [] } },
      ] }));
      const source = {
        bank: "ib-chemistry-hl", root: join(repository, "site"), raw, imageFields: ["questionImages"], officialMarkschemeImages: true,
        publicRoot, extension: { repositoryRoot: repository, manifest },
      };

      await writeManifest([asset("extension")]);
      const files = await referencedWebpFiles(source);
      expect(files.map((file) => [file.relative, file.path.endsWith("site-extension/questions/2016-q1.webp") || file.path.endsWith("site/questions/base.webp")]))
        .toEqual([["questions/2016-q1.webp", true], ["questions/base.webp", true]]);
      const entries = await localManifest([source], 2);
      expect(entries.map((entry) => [entry.key, entry.size])).toEqual([
        ["ib-chemistry-hl/questions/2016-q1.webp", "extension".length],
        ["ib-chemistry-hl/questions/base.webp", "base".length],
      ]);

      await writeManifest([asset("different bytes")]);
      await expect(localManifest([source], 2)).rejects.toThrow(/do not match the upload manifest sha256/);
      await writeManifest([]);
      await expect(referencedWebpFiles(source)).rejects.toThrow(/no upload manifest entry/);
      await writeManifest([asset("extension")], { bank: "ib-chemistry-sl" });
      await expect(referencedWebpFiles(source)).rejects.toThrow(/Invalid ib-chemistry-hl extension upload manifest/);
      await writeManifest([{ ...asset("extension"), sourcePath: "../outside.webp" }]);
      await expect(referencedWebpFiles(source)).rejects.toThrow(/escapes source root/);

      await writeManifest([{ ...asset("extension"), objectKey: "questions/base.webp" }]);
      await writeFile(raw, JSON.stringify({ questions: [
        { id: "base", questionImages: ["questions/base.webp"], officialMarkscheme: null },
        { id: "extension", questionImages: [`${publicRoot}questions/base.webp`], officialMarkscheme: null },
      ] }));
      await expect(referencedWebpFiles(source)).rejects.toThrow(/resolves to two source files/);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("points every IB science bank at its committed extension upload manifest", () => {
    for (const bank of IB_SCIENCE_BANKS) {
      const source = SOURCES.find((candidate) => candidate.bank === bank);
      expect(source.extension.manifest).toBe(`${process.cwd()}/docs/ib-science-storage/${bank}.pending-upload-manifest.json`);
      expect(source.publicRoot).toMatch(/^https:\/\/saksham106\.github\.io\/ib-(chemistry|physics|biology)-topic-practice\/$/);
    }
  });
});
