import { describe, expect, it } from "vitest";
import itemsJson from "@/data/aa-official-subtopics/items.json";
import type { ItemsFile } from "@/lib/course-notes/types";
import { buildAll, findResearchDir, JUDGED_PREREQUISITES, loadSources, QUESTIONS_PER_LEVEL } from "./build-source-pack.mjs";

const items = (itemsJson as ItemsFile).items;
const levelOf = new Map(items.map((entry) => [entry.item, entry.level]));

describe("judged prerequisites", () => {
  it("cover every item, name real items, keep SL lessons free of AHL prerequisites and form no cycle", () => {
    expect(Object.keys(JUDGED_PREREQUISITES).sort()).toEqual(items.map((entry) => entry.item).sort());
    for (const [item, prerequisites] of Object.entries(JUDGED_PREREQUISITES) as [string, string[]][]) {
      for (const prerequisite of prerequisites) {
        expect(levelOf.has(prerequisite), `${item} -> ${prerequisite}`).toBe(true);
        if (levelOf.get(item) === "SL") expect(levelOf.get(prerequisite), `${item} -> ${prerequisite}`).toBe("SL");
      }
    }
    const state = new Map<string, "visiting" | "done">();
    const visit = (item: string, trail: string[]) => {
      if (state.get(item) === "done") return;
      expect(state.get(item), `cycle: ${[...trail, item].join(" -> ")}`).not.toBe("visiting");
      state.set(item, "visiting");
      for (const next of (JUDGED_PREREQUISITES as Record<string, string[]>)[item]) visit(next, [...trail, item]);
      state.set(item, "done");
    };
    for (const entry of items) visit(entry.item, []);
  });
});

// The packs read private sources in ../research; skip where that folder is absent (CI, other machines).
const researchDir = findResearchDir();

describe.skipIf(!researchDir)("build-source-pack", () => {
  const packs = researchDir ? buildAll(loadSources(researchDir)) : [];

  it("emits 83 packs, each with its item's bullets and verbatim guide text", () => {
    expect(packs).toHaveLength(83);
    for (const { code, pack } of packs) {
      const entry = items.find((candidate) => candidate.item === code)!;
      expect(pack.item.bullets, code).toEqual(entry.bullets);
      expect(pack.item.bullets.length, code).toBeGreaterThan(0);
      expect(pack.guide.label).toBe("reference only — never copy");
      expect(pack.guide.content.length, code).toBeGreaterThan(0);
      expect(pack.questions.label).toMatch(/^do not copy/);
    }
  });

  it("lists the item's own booklet ids, picks at most 12 questions per level and keeps SL questions out of AHL packs", () => {
    for (const { code, pack } of packs) {
      const entry = items.find((candidate) => candidate.item === code)!;
      const own = pack.booklet.entries.filter((bk: { item: string }) => bk.item === code).map((bk: { id: string }) => bk.id);
      expect(own, code).toEqual(entry.booklet.map((bk) => bk.id));
      for (const level of ["SL", "HL"] as const) expect(pack.questions[level]?.questions.length ?? 0, code).toBeLessThanOrEqual(QUESTIONS_PER_LEVEL);
      if (entry.level === "AHL") expect(pack.questions.SL, code).toBeUndefined();
    }
  });

  it("never offers an AHL item as a prerequisite to an SL lesson", () => {
    for (const { pack } of packs) {
      if (pack.item.level !== "SL") continue;
      for (const candidate of pack.prerequisites) if (candidate.level === "AHL") expect(candidate.use, `${pack.item.item} -> ${candidate.item}`).toBe("hlNote-only");
    }
  });
});
