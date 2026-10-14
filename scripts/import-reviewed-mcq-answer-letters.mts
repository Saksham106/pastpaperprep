#!/usr/bin/env tsx
// Imports a reviewed MCQ answer-letter file into src/data/reviewed-mcq-answer-letters.json,
// keeping only rows this checkout has. Re-run it with the full file once new papers land:
//   npx tsx scripts/import-reviewed-mcq-answer-letters.mts <path/to/reviewed-mcq-answer-letters.json>
// Rows not yet in the bank and removed questions (`answers: []`) are dropped and listed; anything
// else that fails validation stops the import.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BankSlug } from "@/lib/banks";
import { formatReviewedMcqAnswerLetters, importReviewedMcqAnswerLetters, MCQ_ANSWER_BANKS } from "@/lib/mcq-answer-letters";
import { loadBankRawQuestions } from "@/lib/question-loader";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Usage: import-reviewed-mcq-answer-letters.mts <reviewed-mcq-answer-letters.json>");
const sourceBytes = await readFile(sourcePath);
const rows = new Map<BankSlug, readonly Record<string, unknown>[]>();
for (const bank of MCQ_ANSWER_BANKS) rows.set(bank, await loadBankRawQuestions(bank));

const result = importReviewedMcqAnswerLetters(JSON.parse(sourceBytes.toString("utf8")), (bank) => rows.get(bank) ?? []);
const output = formatReviewedMcqAnswerLetters(result.letters);
const target = join(process.cwd(), "src", "data", "reviewed-mcq-answer-letters.json");
await writeFile(target, output);

const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
for (const [bank, entries] of Object.entries(result.letters.banks)) console.log(`${bank}: ${Object.keys(entries ?? {}).length} letters`);
console.log(`dropped, not in this checkout yet: ${result.unknown.length}`);
console.log(`dropped, removed by the board: ${result.removed.join(", ") || "none"}`);
console.log(`source sha256 ${sha256(sourceBytes)}`);
console.log(`output sha256 ${sha256(output)}`);
