import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import itemsJson from "@/data/aa-official-subtopics/items.json";
import taxonomy from "@/data/aa-official-subtopics/taxonomy.json";
import type { ItemsFile } from "./types";

const file: ItemsFile = itemsJson as ItemsFile;

type Taxonomy = { groups: { id: string; memberOfficialItems: string[]; applicability: string[] }[] };
const groups = (taxonomy as Taxonomy).groups;

describe("aa-official-subtopics items.json", () => {
  it("has exactly 83 items: 51 SL and 32 AHL, matching the registry levels item by item", () => {
    expect(file.items).toHaveLength(83);
    expect(file.items.filter((i) => i.level === "SL")).toHaveLength(51);
    expect(file.items.filter((i) => i.level === "AHL")).toHaveLength(32);
    for (const item of file.items) {
      const owners = groups.filter((g) => g.memberOfficialItems.includes(item.item));
      expect(owners, item.item).toHaveLength(1);
      const slInRegistry = owners[0].applicability.includes("SL");
      // A group's applicability is the union of its members, so only check items that stand alone.
      if (owners[0].memberOfficialItems.length === 1) expect(item.level === "SL", item.item).toBe(slInRegistry);
      expect(item.topic).toBe(Number(item.item.split(".")[0]));
    }
  });

  it("every item belongs to exactly one group in taxonomy.json", () => {
    for (const item of file.items) {
      expect(groups.filter((g) => g.memberOfficialItems.includes(item.item)), item.item).toHaveLength(1);
    }
    const members = groups.flatMap((g) => g.memberOfficialItems);
    expect(new Set(members).size).toBe(members.length);
    expect(new Set(members)).toEqual(new Set(file.items.map((i) => i.item)));
  });

  it("every item has ≥1 bullet and bullet ids are unique", () => {
    const seen = new Set<string>();
    for (const item of file.items) {
      expect(item.bullets.length, item.item).toBeGreaterThanOrEqual(1);
      item.bullets.forEach((b, n) => {
        expect(b.id).toBe(`${item.item}-b${n + 1}`);
        expect(b.text.trim().length, b.id).toBeGreaterThan(0);
        expect(seen.has(b.id), b.id).toBe(false);
        seen.add(b.id);
      });
    }
  });

  const resolvedPath = (() => {
    for (let dir = process.cwd(), i = 0; i < 6; i++, dir = dirname(dir)) {
      const p = join(dir, "research/aa-course-notes/extract/items.resolved.json");
      if (existsSync(p)) return resolve(p);
    }
    return null;
  })();

  it.skipIf(!resolvedPath)("no bullet text shares an 8-word run with items.resolved.json", () => {
    // Prose words only: maths tokens (single letters, numbers, symbols) are kept in bullets on purpose.
    // Dropping them makes runs span maths, which is stricter than counting consecutive raw tokens.
    const words = (s: string) =>
      s.toLowerCase().replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter((w) => w.length >= 2);
    const resolved = JSON.parse(readFileSync(resolvedPath!, "utf8")) as {
      items: { item: string; content: string[]; guidance: string[] }[];
    };
    const N = 8;
    const grams = new Set<string>();
    for (const r of resolved.items) {
      for (const line of [...r.content, ...r.guidance]) {
        const w = words(line);
        for (let i = 0; i + N <= w.length; i++) grams.add(w.slice(i, i + N).join(" "));
      }
    }
    for (const item of file.items) {
      for (const b of item.bullets) {
        const w = words(b.text);
        for (let i = 0; i + N <= w.length; i++) {
          expect(grams.has(w.slice(i, i + N).join(" ")), `${b.id}: "${w.slice(i, i + N).join(" ")}"`).toBe(false);
        }
      }
    }
  });
});
