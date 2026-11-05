#!/usr/bin/env tsx
// Writes src/data/notes-practice/<course>.json for every `bank-subtopics` course: how many questions each practice
// label opens in each level's bank, per topic, and each label's bank topic. Notes pages read this file instead of
// importing the raw banks. A test (src/lib/course-notes/subtopic-counts.test.ts) fails when it is stale.
//
//   npm run generate:notes-practice
// Runs with --conditions=react-server so server-only modules load outside Next.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hasFreeTier } from "@/lib/access";
import type { BankSlug } from "@/lib/banks";
import { COURSES } from "@/lib/course-notes/course";
import { buildSubtopicPractice } from "@/lib/course-notes/subtopic-counts";
import { loadBankQuestions } from "@/lib/question-loader";

const dir = join(process.cwd(), "src/data/notes-practice");
await mkdir(dir, { recursive: true });
for (const course of COURSES.filter((entry) => entry.practice.kind === "bank-subtopics")) {
  const levels = [course.levels.labels.base, course.levels.labels.extension];
  const questions = Object.fromEntries(await Promise.all(levels.map(async (level) => [level, await loadBankQuestions(course.banks[level] as BankSlug)] as const)));
  const file = buildSubtopicPractice(course, course.items, questions, (bank) => hasFreeTier(bank as BankSlug));
  await writeFile(join(dir, `${course.slug}.json`), `${JSON.stringify(file, null, 2)}\n`);
  console.log(`notes practice: ${course.slug}, ${Object.keys(file.subtopics).length} subtopics`);
}
