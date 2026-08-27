import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadBankQuestions } from "@/lib/questions";
import { getControlledSubtopics } from "@/lib/taxonomy";

type AuditManifest = {
  reviewedQuestionCount: number;
  corrections: Record<string, { sourceTextSha256: string }>;
};

describe("new-bank classification quality", () => {
  it.each(["ib-ai-hl", "ib-ai-sl"] as const)("keeps every %s subtopic non-empty and owned by its primary topic", (bankSlug) => {
    const questions = loadBankQuestions(bankSlug);

    expect(questions.length).toBeGreaterThan(300);
    for (const question of questions) {
      const controlled = new Set(getControlledSubtopics(bankSlug, question.primaryTopic));
      expect(question.subtopics, question.id).not.toHaveLength(0);
      expect(question.subtopics.filter((subtopic) => !controlled.has(subtopic)), question.id).toEqual([]);
      expect(question.skills, question.id).toEqual(question.subtopics);
    }
  });

  it("keeps every 0606 question in the controlled two-level syllabus taxonomy", () => {
    const questions = loadBankQuestions("igcse-additional");

    expect(questions).toHaveLength(1633);
    for (const question of questions) {
      const controlled = new Set(
        [question.primaryTopic, ...question.secondaryTopics].flatMap((topic) =>
          getControlledSubtopics("igcse-additional", topic),
        ),
      );
      expect(question.subtopics, question.id).not.toHaveLength(0);
      expect(question.subtopics.filter((subtopic) => !controlled.has(subtopic)), question.id).toEqual([]);
    }
  });

  it("preserves independently reviewed corrections for representative 0606 methods", () => {
    const questions = loadBankQuestions("igcse-additional");
    const byId = new Map(questions.map((question) => [question.id, question]));

    expect(byId.get("0606-2016-june-11-q3")).toMatchObject({
      primaryTopic: "Calculus",
      subtopics: ["Calculus"],
    });
    expect(byId.get("0606-2026-june-12-q2")).toMatchObject({
      primaryTopic: "Coordinate geometry",
      subtopics: ["Straight-line graphs"],
    });
    expect(byId.get("0606-2021-june-13-q6")).toMatchObject({
      primaryTopic: "Geometry and trigonometry",
      subtopics: ["Circular measure"],
    });
    expect(byId.get("0606-2026-june-11-q4")).toMatchObject({
      primaryTopic: "Calculus",
      subtopics: ["Calculus"],
    });
  });

  it.each([
    ["igcse-additional", 1633],
    ["ib-ai-hl", 409],
    ["ib-ai-sl", 334],
  ] as const)("keeps a complete source-hashed review manifest for %s", (bankSlug, expectedCount) => {
    const questions = loadBankQuestions(bankSlug);
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "docs", "audits", `${bankSlug}-classification-2026-08.json`), "utf8"),
    ) as AuditManifest;

    expect(manifest.reviewedQuestionCount).toBe(expectedCount);
    expect(Object.keys(manifest.corrections)).toHaveLength(expectedCount);
    expect(new Set(Object.keys(manifest.corrections))).toEqual(new Set(questions.map((question) => question.id)));
    for (const question of questions) {
      expect(manifest.corrections[question.id]?.sourceTextSha256, question.id).toBe(
        createHash("sha256").update(question.accessibleText).digest("hex"),
      );
    }
  });
});