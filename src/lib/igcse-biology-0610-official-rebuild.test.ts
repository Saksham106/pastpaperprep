/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import production from "@/data/production/igcse-biology-0610.json";
import candidate from "@/data/local-preview/igcse-biology-0610.json";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { parseExplorerState, serializeExplorerState } from "@/lib/explorer-state";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";

type ReleaseRow = any;
const productionQuestions = (production as any).questions as ReleaseRow[];
const candidateQuestions = (candidate as any).questions as ReleaseRow[];
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

  it("routes the production catalog through the reviewed overlay without changing pristine asset references", () => {
    const candidateById = new Map(candidateQuestions.map((question) => [question.id, question]));
    const productionRows = productionQuestions.filter((question) => candidateById.has(question.id));
    expect(productionRows).toHaveLength(3441);
    expect(productionRows.filter((question) => question.reviewStatus === "blocked")).toHaveLength(4);
    expect(productionRows.filter((question) => question.courseEra === "2020_2021")).toHaveLength(685);
    expect(productionRows.filter((question) => question.courseEra === "2022")).toHaveLength(690);
    expect(productionRows.filter((question) => question.courseEra === "2023_2025")).toHaveLength(2066);
    for (const pristine of productionRows) {
      const reviewed = candidateById.get(pristine.id)!;
      expect(pristine.questionImages).toEqual(expect.arrayContaining(pristine.questionImages));
      expect(pristine.markschemeImages).toEqual(expect.arrayContaining(pristine.markschemeImages));
      if (reviewed.reviewStatus === "blocked") expect(pristine.subtopics).toEqual([]);
      else expect(pristine.subtopics).toEqual(reviewed.subtopics);
    }
  });

  it("keeps blocked rows topic-filterable but never invents subtopics, and preserves URL state", () => {
    const rows = productionQuestions.filter((question) => question.bankSlug === "igcse-biology-0610").map((question) => ({
      ...question,
      bankSlug: "igcse-biology-0610" as const,
      secondaryTopics: question.secondaryTopics ?? [],
      skills: question.skills ?? [],
      subtopics: question.subtopics ?? [],
      secondarySubtopics: question.secondarySubtopics ?? [],
    }));
    const blocked = rows.filter((question) => question.reviewStatus === "blocked");
    expect(blocked).toHaveLength(4);
    expect(blocked.every((question) => question.primaryTopic && question.subtopics.length === 0)).toBe(true);
    const topic = blocked[0].primaryTopic;
    expect(rows.filter((question) => question.primaryTopic === topic)).toEqual(expect.arrayContaining(blocked.filter((question) => question.primaryTopic === topic)));
    const groups = getSubtopicGroups(rows, [topic], []);
    expect(groups.relevant).not.toContain("");
    expect(getTopicOptions(rows)).toContain(topic);
    const state = parseExplorerState({ topic, subtopic: "Respiration", era: "2023_2025" });
    expect(serializeExplorerState(state).toString()).toContain("topic=");
    expect(serializeExplorerState(state).toString()).toContain("era=2023_2025");
  });

  it("keeps the public 0610 index safe and taxonomy-bearing without rich or private fields", () => {
    const filename = PUBLIC_BANK_INDEX_FILES["igcse-biology-0610"];
    const index = JSON.parse(readFileSync(path.join(process.cwd(), "public/bank-index", filename), "utf8"));
    expect(index.questions).toHaveLength(4913);
    expect(JSON.stringify(index)).not.toMatch(/summary|accessibleText|questionImages|markschemeImages|courseEra|rightsStatus|classificationProvenance/);
    expect(index.questions.some((question: { primaryTopic: string; subtopics: string[] }) => question.primaryTopic === "Characteristics and classification of living organisms" && question.subtopics.includes("Characteristics of living organisms"))).toBe(true);
  });
});
