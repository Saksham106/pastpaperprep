import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import reviewed from "@/data/reviewed-ib-chemistry-extension-secondaries.json";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { ibChemistryExtensionSecondaries } from "@/lib/reviewed-ib-chemistry-secondaries";

const banks = reviewed.banks as Record<"ib-chemistry-hl" | "ib-chemistry-sl", Record<string, { primarySubtopic: string; secondarySubtopics: string[]; secondaryTopics: string[] }>>;

describe("reviewed IB Chemistry 2016-2019 secondaries", () => {
  it("serves every verified secondary through the question loader", () => {
    let applied = 0;
    for (const bank of ["ib-chemistry-hl", "ib-chemistry-sl"] as const) {
      const byId = new Map(loadBankQuestions(bank).map((q) => [q.id, q]));
      for (const [id, entry] of Object.entries(banks[bank])) {
        const q = byId.get(id)!;
        expect(q.subtopics).toEqual([entry.primarySubtopic, ...entry.secondarySubtopics]);
        expect(q.secondaryTopics).toEqual(entry.secondaryTopics);
        expect(q.secondaryTopics).not.toContain(q.primaryTopic);
        applied++;
      }
    }
    expect(applied).toBe(reviewed.counts.rows);
  });

  it("keeps only links the verification audit kept, each with a mark-earning part", () => {
    const audit = JSON.parse(readFileSync("docs/audits/ib-chemistry-extension-secondaries-verification.json", "utf8"));
    const kept = audit.rows.flatMap((row: { links: { verdict: string; part: string | null; marks: number }[] }) => row.links.filter((l) => l.verdict === "keep"));
    expect(kept).toHaveLength(reviewed.counts.links);
    expect(kept.every((l: { part: string | null; marks: number }) => l.part && l.marks > 0)).toBe(true);
  });

  it("fails closed when a row's primary no longer matches", () => {
    const [id, entry] = Object.entries(banks["ib-chemistry-hl"])[0];
    expect(() => ibChemistryExtensionSecondaries("ib-chemistry-hl", id, ["Something else"], [])).toThrow(/no longer match/);
    expect(ibChemistryExtensionSecondaries("ib-chemistry-hl", id, [entry.primarySubtopic], [])?.subtopics[0]).toBe(entry.primarySubtopic);
    expect(ibChemistryExtensionSecondaries("ib-physics-hl", id, [entry.primarySubtopic], [])).toBeNull();
  });
});
