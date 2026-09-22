import { describe, expect, it } from "vitest";
import {
  BIOLOGY_0610_COUNTS,
  BIOLOGY_0610_ERAS,
  buildBiology0610Runtime,
  validateBiology0610Overlay,
} from "@/lib/igcse-biology-0610-official-rebuild";

describe("IGCSE Biology 0610 official rebuild", () => {
  it("pins the reviewed overlay and fail-closed coverage", async () => {
    const result = await buildBiology0610Runtime();
    expect(result.rows).toHaveLength(3441);
    expect(result.counts).toEqual(BIOLOGY_0610_COUNTS);
    expect(result.eras).toEqual(BIOLOGY_0610_ERAS);
    expect(validateBiology0610Overlay(result.overlay)).toEqual({
      rows: 3441,
      accepted: 3382,
      corrected: 55,
      blocked: 4,
      held: 0,
    });
    expect(result.overlaySha256).toBe("7846ece73f808fcebcc66f31d8c10a47ddb54963604c1ffd02f67d35e7d2bc9d");
    expect(result.rows.filter((row) => row.reviewStatus === "blocked")).toHaveLength(4);
    expect(result.rows.filter((row) => row.primaryTopicId === null)).toHaveLength(4);
  });

  it("exposes ordered official labels while preserving source provenance", async () => {
    const result = await buildBiology0610Runtime();
    expect(result.taxonomy.eras.every((era: { topics: Array<{ id: string }> }) => era.topics.map((topic) => topic.id) .join(",") === "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21")).toBe(true);
    const sample = result.rows.find((row) => row.id === "0610-2022-w-42-q4");
    expect(sample?.classificationProvenance.sourceEvidence.questionPaper.path).toContain("0610-2022-w-42-question.pdf");
    expect(sample?.classificationProvenance.overlaySha256).toBe(result.overlaySha256);
    expect(sample?.reviewStatus).toBe("blocked");
  });

  it("keeps primary and secondary roles distinct for normal filters", async () => {
    const result = await buildBiology0610Runtime();
    const row = result.rows.find((candidate) => candidate.id === "0610-2025-s-12-q35");
    expect(row?.primaryTopicId).toBe("topic_19_organisms_and_environment.19.3");
    expect(row?.secondaryTopicIds).toEqual(["topic_12_respiration.12.1"]);
    expect(row?.subtopics).toEqual(expect.arrayContaining(["Respiration"]));
  });
});
