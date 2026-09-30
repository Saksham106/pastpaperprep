import { describe, expect, it } from "vitest";
import { assert0620OtherRetrievalRepair, getIGCSERuntimeArtifact } from "@/lib/igcse-runtime";
import { normalizeBankQuestions } from "@/lib/questions";
import { filterQuestions } from "@/lib/question-filter";
import runtime from "@/data/production/igcse-chemistry-0620.json";
import targets from "../../scripts/data/0620-other-retrieval-targets.json";

const bank = "igcse-chemistry-0620";
const normalized = normalizeBankQuestions(bank, runtime.questions as never);
const byId = new Map(normalized.map((q) => [q.id, q]));

const includes = (id: string, topics: string[], subtopics: string[]) =>
  filterQuestions(normalized, { topics, subtopics }).some((q) => q.id === id);

describe("0620 exact original Other cohort retrieval", () => {
  it("seals 30 and rejects any changed content, not merely a forged runtime checksum", () => {
    expect(getIGCSERuntimeArtifact(bank, { PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" }).questions).toHaveLength(5129);
    expect(() => assert0620OtherRetrievalRepair(runtime as never)).not.toThrow();
    const changed = structuredClone(runtime);
    changed.questions.find((q) => q.id === "0620-2019-s-11-q40")!.summary += " mutation";
    expect(() => assert0620OtherRetrievalRepair(changed as never)).toThrow(/retrieval provenance or finalized content mismatch/);
  });

  it("routes every frozen row by controlled topic and every evidence-backed detail", () => {
    expect(targets.rows).toHaveLength(30);
    for (const row of targets.rows) {
      expect(byId.has(row.id), row.id).toBe(true);
      expect(includes(row.id, [row.primaryTopic], []), row.id).toBe(true);
      for (const detail of row.details) expect(includes(row.id, [row.primaryTopic], [detail]), `${row.id}:${detail}`).toBe(true);
      for (const [topic, details] of Object.entries(row.secondaryTopics)) {
        expect(includes(row.id, [topic], []), `${row.id}:${topic}`).toBe(true);
        for (const detail of details) expect(includes(row.id, [topic], [detail]), `${row.id}:${detail}`).toBe(true);
      }
      expect(runtime.questions.find((q) => q.id === row.id)?.classificationReviewStatus).toBe("unresolved_taxonomy_gap");
    }
  });

  it("does not leak a nearby detail into other original Other questions", () => {
    expect(includes("0620-2026-s-31-q5", ["States of matter"], ["Diffusion"])).toBe(false);
    expect(includes("0620-2026-s-33-q5", ["States of matter"], ["Diffusion"])).toBe(false);
    expect(includes("0620-2026-s-32-q5", ["States of matter"], ["Diffusion"])).toBe(true);
    expect(includes("0620-2026-m-22-q1", ["States of matter"], ["Diffusion"])).toBe(false);
    expect(includes("0620-2026-m-22-q2", ["States of matter"], ["Diffusion"])).toBe(true);
  });
});
