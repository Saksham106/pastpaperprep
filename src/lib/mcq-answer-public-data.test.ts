import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import { createPublicBankIndex } from "@/lib/question-index";
import { loadBankQuestions } from "@/lib/question-loader";

// The letter is the answer: it must never ride on a question row or the public bank index.
const LETTER_KEYS = /"(?:answer|answers|mcqAnswer|answerProvenance)"\s*:/;

afterEach(() => vi.unstubAllEnvs());

describe("MCQ letters stay out of public question data", () => {
  it("normalized rows, delivered rows and the bank index carry no letter", async () => {
    vi.stubEnv("PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS", "true");
    vi.stubEnv("PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED", "true");
    const questions = await loadBankQuestions("igcse-chemistry-0620");
    const mcq = questions.find((question) => question.id === "0620-2025-m-12-q1");
    expect(mcq).toBeDefined();
    for (const key of ["answer", "mcqAnswer", "answerProvenance"]) expect(mcq).not.toHaveProperty(key);
    const member = [{ productId: "bundle_all" as const, status: "active" as const, startsAt: "2020-01-01T00:00:00.000Z", expiresAt: null }];
    expect(JSON.stringify(prepareQuestionsForDelivery(questions, member))).not.toMatch(LETTER_KEYS);
    expect(JSON.stringify(createPublicBankIndex("igcse-chemistry-0620", questions))).not.toMatch(LETTER_KEYS);
  });

  it("generated public bank-index files carry no letter", () => {
    const directory = join(process.cwd(), "public", "bank-index");
    if (!existsSync(directory)) return;
    const files = readdirSync(directory).filter((name) => name.endsWith(".json"));
    for (const name of files) expect(readFileSync(join(directory, name), "utf8"), name).not.toMatch(LETTER_KEYS);
  });
});
