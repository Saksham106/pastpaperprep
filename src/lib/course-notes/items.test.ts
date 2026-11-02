import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import itemsJson from "@/data/aa-official-subtopics/items.json";
import taxonomy from "@/data/aa-official-subtopics/taxonomy.json";
import { glossary } from "@/content/notes/ib-math-aa";
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

  it("pins the file's schemaVersion and edition", () => {
    expect(file.schemaVersion).toBe(1);
    expect(file.edition).toBe("aa-2021");
  });

  it("an item in a group with no SL applicability is AHL", () => {
    for (const group of groups.filter((g) => !g.applicability.includes("SL"))) {
      for (const code of group.memberOfficialItems) {
        expect(file.items.find((i) => i.item === code)?.level, `${group.id} / ${code}`).toBe("AHL");
      }
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

  // Items the booklet covers, directly or as a second use of a formula (SL 1.2 to AHL 5.19).
  const bookletItems = ["1.2", "1.3", "1.4", "1.5", "1.7", "1.8", "1.9", "1.10", "1.12", "1.13", "1.14", "2.1", "2.6", "2.7", "2.9", "2.10", "2.12", "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.8", "3.9", "3.10", "3.12", "3.13", "3.14", "3.16", "3.17", "3.18", "4.1", "4.2", "4.3", "4.5", "4.6", "4.7", "4.8", "4.11", "4.12", "4.13", "4.14", "5.3", "5.4", "5.5", "5.6", "5.9", "5.10", "5.11", "5.12", "5.13", "5.14", "5.15", "5.16", "5.17", "5.18", "5.19"];

  it("booklet ids are unique, labelled, and attached to the items the booklet covers", () => {
    // A formula may list a second item (alsoItems), so an id repeats across items but never within one.
    for (const item of file.items) {
      const ids = item.booklet.map((entry) => entry.id);
      expect(new Set(ids).size, item.item).toBe(ids.length);
      for (const entry of item.booklet) {
        expect(entry.id, item.item).toMatch(/^bk-\d-\d+-[a-z0-9-]+$/);
        expect(entry.label.trim().length, entry.id).toBeGreaterThan(0);
        expect(entry.label, entry.id).not.toMatch(/[\\{}$]/);
      }
    }
    expect(file.items.filter((i) => i.booklet.length > 0).map((i) => i.item)).toEqual(bookletItems);
  });

  it("every glossary entry points at a lesson id that exists in items.json", () => {
    const codes = new Set(file.items.map((i) => i.item));
    for (const entry of glossary as { id: string; lesson: string }[]) {
      expect(codes.has(entry.lesson), `${entry.id} -> ${entry.lesson}`).toBe(true);
    }
  });

  const resolvedPath = (() => {
    for (let dir = process.cwd(), i = 0; i < 6; i++, dir = dirname(dir)) {
      const p = join(dir, "research/aa-course-notes/extract/items.resolved.json");
      if (existsSync(p)) return resolve(p);
    }
    return null;
  })();

  const bookletResolvedPath = resolvedPath && join(dirname(resolvedPath), "booklet.resolved.json");

  it.skipIf(!bookletResolvedPath || !existsSync(bookletResolvedPath))("each booklet id sits on exactly [item, ...alsoItems] from booklet.resolved.json", () => {
    const resolved = JSON.parse(readFileSync(bookletResolvedPath!, "utf8")) as {
      entries: { id: string; item: string | null; alsoItems: string[]; priorLearning: boolean }[];
    };
    const formulas = resolved.entries.filter((e) => !e.priorLearning);
    const placed = new Map<string, string[]>();
    for (const item of file.items) for (const entry of item.booklet) placed.set(entry.id, [...(placed.get(entry.id) ?? []), item.item]);
    expect([...placed.keys()].sort()).toEqual(formulas.map((e) => e.id).sort());
    expect(placed.size).toBe(formulas.length);
    for (const e of formulas) expect(placed.get(e.id)!.sort(), e.id).toEqual([e.item!, ...e.alsoItems].sort());
  });

  it.skipIf(!resolvedPath)("no bullet text shares an 8-word run with items.resolved.json", () => {
    // Prose words only. Apostrophes are removed first so "Pascal's" stays one word instead of splitting into "pascal" and "s".
    // Numbers and symbols become gaps. Single letters are maths variables (x, k, n) and are dropped, except "a", which is
    // also the article and so counts as a word. A run that spans a dropped variable is still a run, which is stricter.
    const words = (s: string) =>
      s.toLowerCase().replace(/['\u2019]/g, "").replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter((w) => w.length >= 2 || w === "a");
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
