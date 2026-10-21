import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import reviewed from "@/data/reviewed-ib-chemistry-extension-labels.json";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { ibChemistryExtensionLabels } from "@/lib/reviewed-ib-chemistry-labels";
import type { IbChemistryLabels } from "@/lib/ib-chemistry-labels.mjs";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";

const banks = reviewed.banks as Record<"ib-chemistry-hl" | "ib-chemistry-sl", Record<string, IbChemistryLabels>>;

describe("reviewed IB Chemistry 2016-2019 labels", () => {
  it("serves every reviewed primary and verified secondary through the question loader", () => {
    let applied = 0, changed = 0;
    for (const bank of ["ib-chemistry-hl", "ib-chemistry-sl"] as const) {
      const byId = new Map(loadBankQuestions(bank).map((q) => [q.id, q]));
      for (const [id, entry] of Object.entries(banks[bank])) {
        const q = byId.get(id)!;
        expect(q.primaryTopic).toBe(entry.primaryTopic);
        expect(q.subtopics).toEqual([entry.primarySubtopic, ...entry.secondarySubtopics]);
        expect(q.secondaryTopics).toEqual(entry.secondaryTopics);
        expect(q.secondaryTopics).not.toContain(q.primaryTopic);
        expect(entry.secondarySubtopics).not.toContain(entry.primarySubtopic);
        applied++;
        if (entry.primarySubtopic !== entry.sourceSubtopic) changed++;
      }
    }
    expect(applied).toBe(reviewed.counts.entries);
    expect(changed).toBe(reviewed.counts.changedPrimaries);
  });

  it("publishes the same labels in the public bank index the bank page filters on", () => {
    for (const bank of ["ib-chemistry-hl", "ib-chemistry-sl"] as const) {
      const index = JSON.parse(readFileSync(`public/bank-index/${PUBLIC_BANK_INDEX_FILES[bank]}`, "utf8")) as { questions: { id: string; primaryTopic: string; subtopics: string[]; secondaryTopics: string[] }[] };
      const published = new Map(index.questions.map((q) => [q.id, q]));
      for (const q of loadBankQuestions(bank)) {
        const row = published.get(q.id)!;
        expect([row.primaryTopic, row.subtopics, row.secondaryTopics]).toEqual([q.primaryTopic, q.subtopics, q.secondaryTopics]);
      }
    }
  });

  it("changes a primary only on a change verdict that cites its reason", () => {
    const audit = JSON.parse(readFileSync("docs/audits/ib-chemistry-extension-primaries-review.json", "utf8")) as { rows: { members: string[]; current: string; final_primary: string; adjudication: { verdict: string; reason: string } | null }[] };
    const changes = audit.rows.filter((row) => row.final_primary !== row.current);
    expect(changes.every((row) => row.adjudication?.verdict === "change" && row.adjudication.reason.length > 0)).toBe(true);
    expect(changes.reduce((n, row) => n + row.members.length, 0)).toBe(reviewed.counts.changedPrimaries);
  });

  it("keeps only secondary links the verification audit kept, each with a mark-earning part", () => {
    const audit = JSON.parse(readFileSync("docs/audits/ib-chemistry-extension-secondaries-verification.json", "utf8"));
    const kept = audit.rows.flatMap((row: { links: { verdict: string; part: string | null; marks: number }[] }) => row.links.filter((l) => l.verdict === "keep"));
    expect(kept.every((l: { part: string | null; marks: number }) => l.part && l.marks > 0)).toBe(true);
  });

  it("fails closed when a row's sealed primary no longer matches", () => {
    const [id, entry] = Object.entries(banks["ib-chemistry-hl"])[0];
    expect(() => ibChemistryExtensionLabels("ib-chemistry-hl", id, entry.sourceTopic, ["Something else"], [])).toThrow(/no longer match/);
    expect(() => ibChemistryExtensionLabels("ib-chemistry-hl", id, "Other topic", [entry.sourceSubtopic], [])).toThrow(/no longer match/);
    expect(ibChemistryExtensionLabels("ib-chemistry-hl", id, entry.sourceTopic, [entry.sourceSubtopic], [])?.subtopics[0]).toBe(entry.primarySubtopic);
    expect(ibChemistryExtensionLabels("ib-physics-hl", id, entry.sourceTopic, [entry.sourceSubtopic], [])).toBeNull();
  });
});
