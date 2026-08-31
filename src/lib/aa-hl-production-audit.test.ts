import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getControlledSubtopics } from "@/lib/taxonomy";

type Tuple = { primaryTopic: string; secondaryTopics: string[]; skills: string[] };

const auditRoot = resolve(process.cwd(), "docs/audits/ib-hl-sources/aa-hl-production-target");
const bank = JSON.parse(readFileSync(resolve(process.cwd(), "src/data/raw/ib-hl.json"), "utf8"));
const target = JSON.parse(readFileSync(resolve(auditRoot, "reviewed-production-target-841.json"), "utf8"));
const baseline = JSON.parse(readFileSync(resolve(auditRoot, "production-baseline-overlay.json"), "utf8"));

const TARGET_SHA256 = "a949ef162921455b8150778e8c4861f4e96b496e78d56d88b3171da9a9760731";
const CORRECTIONS_SHA256 = "4a0c3918cd3cefc97812f792fe8447c3f9cd6872d3942c3ceaf283b48b2de92b";
const classificationFields = new Set([
  "primaryTopic", "secondaryTopics", "skills", "subtopics", "detailedSubtopics",
  "classificationEvidence", "classificationConfidence", "classificationReviewStatus",
  "classificationVersion", "p3Applicability", "contextTags", "searchText",
]);

function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortedValue(item)]));
  }
  return value;
}

function sha(value: unknown): string {
  return createHash("sha256").update(`${JSON.stringify(sortedValue(value))}\n`).digest("hex");
}

function fileSha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function tuple(question: Record<string, unknown>): Tuple {
  return {
    primaryTopic: question.primaryTopic as string,
    secondaryTopics: question.secondaryTopics as string[],
    skills: question.skills as string[],
  };
}

describe("AA HL reviewed production target", () => {
  it("covers the exact ordered bank and matches the pinned target", () => {
    expect(fileSha(resolve(auditRoot, "reviewed-production-target-841.json"))).toBe(TARGET_SHA256);
    expect(fileSha(resolve(auditRoot, "latest-final-corrections.json"))).toBe(CORRECTIONS_SHA256);
    expect(target.status).toBe("PASS");
    expect(target.questionCount).toBe(841);
    expect(target.netChangedCount).toBe(214);
    expect(bank.questions).toHaveLength(841);
    expect(target.records).toHaveLength(841);
    expect(baseline.records).toHaveLength(841);

    let changed = 0;
    for (const [index, question] of bank.questions.entries()) {
      const record = target.records[index];
      expect(record.ordinal).toBe(index + 1);
      expect(question.id).toBe(record.id);
      expect(tuple(question)).toEqual({
        primaryTopic: record.targetTuple.primaryTopic,
        secondaryTopics: record.targetTuple.secondaryTopics,
        skills: record.targetTuple.skills,
      });
      const selected = [record.targetTuple.primaryTopic, ...record.targetTuple.secondaryTopics];
      const owned = new Set(selected.flatMap((topic) => getControlledSubtopics("ib-hl", topic)));
      expect(record.targetTuple.skills.every((skill: string) => owned.has(skill))).toBe(true);
      if ("subtopics" in question) expect(question.subtopics).toEqual(question.skills);
      changed += tuple(baseline.records[index].baselineTuple).primaryTopic !== record.targetTuple.primaryTopic
        || JSON.stringify(tuple(baseline.records[index].baselineTuple).secondaryTopics) !== JSON.stringify(record.targetTuple.secondaryTopics)
        || JSON.stringify(tuple(baseline.records[index].baselineTuple).skills) !== JSON.stringify(record.targetTuple.skills)
        ? 1 : 0;
      const preserved = Object.fromEntries(Object.entries(question).filter(([key]) => !classificationFields.has(key)));
      expect(sha(preserved)).toBe(baseline.records[index].nonClassificationSha256);
    }
    expect(changed).toBe(214);
  });
});
