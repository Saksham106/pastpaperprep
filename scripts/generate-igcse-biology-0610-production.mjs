#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonicalSha256 = (value) => sha256(JSON.stringify(value));

const productionPath = "src/data/production/igcse-biology-0610.json";
const candidatePath = "src/data/local-preview/igcse-biology-0610.json";
const taxonomyPath = "src/data/classification/igcse-biology-0610-official-taxonomy-v2.json";
const production = await readJson(productionPath);
const candidate = await readJson(candidatePath);
const taxonomy = await readJson(taxonomyPath);
const candidateById = new Map(candidate.questions.map((question) => [question.id, question]));

if (candidate.questions.length !== 3441 || production.questions.length !== 4913) throw new Error("Unexpected Biology 0610 candidate or pristine row count");
const questions = production.questions.map((pristine) => {
  const reviewed = candidateById.get(pristine.id);
  if (!reviewed) return pristine;
  const blocked = reviewed.reviewStatus === "blocked";
  return {
    ...pristine,
    courseEra: reviewed.courseEra,
    primaryTopic: blocked ? pristine.primaryTopic : reviewed.primaryTopic,
    primaryTopicId: reviewed.primaryTopicId,
    secondaryTopics: reviewed.secondaryTopics,
    secondaryTopicIds: reviewed.secondaryTopicIds,
    subtopics: reviewed.subtopics,
    detailedSubtopics: reviewed.detailedSubtopics,
    secondarySubtopics: reviewed.secondarySubtopics,
    skills: [],
    classificationReviewStatus: "classified",
    classificationProvenance: reviewed.classificationProvenance,
    reviewStatus: reviewed.reviewStatus,
  };
});

const runtime = {
  ...production,
  taxonomy: { path: taxonomyPath, eras: candidate.taxonomy.eras },
  overlay: candidate.overlay,
  questions,
  knownCoverageGaps: questions.filter((question) => question.reviewStatus === "blocked").map((question) => question.id),
  runtimeArtifact: {
    ...production.runtimeArtifact,
    releaseTaxonomySha256: canonicalSha256(taxonomy),
    runtimeTaxonomySha256: canonicalSha256(taxonomy),
    runtimeSha256: null,
  },
};
runtime.runtimeArtifact.runtimeSha256 = canonicalSha256(runtime);
await writeFile(productionPath, `${JSON.stringify(runtime, null, 2)}\n`);
console.log(JSON.stringify({ status: "PASS", rows: questions.length, candidateRows: candidate.questions.length, patched: candidateById.size, blocked: runtime.knownCoverageGaps.length, runtimeSha256: runtime.runtimeArtifact.runtimeSha256, taxonomySha256: runtime.runtimeArtifact.runtimeTaxonomySha256 }));
