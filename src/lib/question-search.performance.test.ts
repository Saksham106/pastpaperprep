// @vitest-environment node
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { expect, it } from "vitest";
import { loadBankQuestions } from "@/lib/question-loader";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import { searchQuestionIds } from "@/lib/question-search";
import type { AccessEntitlement } from "@/lib/access";
import type { UnifiedQuestion } from "@/lib/questions";

// Opt-in, bounded microbenchmark of the real modules and a released bank.
// No network or generation, no timing thresholds, no production savings claim.
it.skipIf(!process.env.QUESTION_SEARCH_BENCH_OUTPUT)("measures released-bank ID-only search against delivery projection", async () => {
  const loadedAt = performance.now();
  const questions = await loadBankQuestions("igcse");
  const loadMs = performance.now() - loadedAt;
  const now = new Date("2026-10-24T12:00:00Z");
  const paid: AccessEntitlement[] = [{ productId: "bank_igcse", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }];
  const query = " Algebra ";
  const baseline = (rows: readonly UnifiedQuestion[], grants: readonly AccessEntitlement[]) =>
    prepareQuestionsForDelivery(rows, grants, now)
      .filter(q => q.searchText.includes(query.trim().toLocaleLowerCase())).map(q => q.id);
  const measure = (fn: () => string[]) => {
    const cpu = process.cpuUsage();
    const start = performance.now();
    const ids = fn();
    const wallMs = performance.now() - start;
    const used = process.cpuUsage(cpu);
    return { ids, wallMs, cpuMs: (used.user + used.system) / 1000 };
  };
  const measurements = [];
  for (const [persona, grants] of [["anonymous", []], ["paid", paid]] as const) {
    // Warm V8 paths before recording. Fresh arrays isolate cold preparation.
    baseline(questions, grants);
    searchQuestionIds([...questions], query, grants, now);
    for (let iteration = 0; iteration < 3; iteration++) {
      const corpus = [...questions];
      const before = measure(() => baseline(corpus, grants));
      const cold = measure(() => searchQuestionIds(corpus, query, grants, now));
      const warm = measure(() => searchQuestionIds(corpus, query, grants, now));
      expect(cold.ids).toEqual(before.ids);
      expect(warm.ids).toEqual(before.ids);
      measurements.push({ persona, iteration, matches: before.ids.length,
        before: { wallMs: before.wallMs, cpuMs: before.cpuMs },
        cold: { wallMs: cold.wallMs, cpuMs: cold.cpuMs },
        warm: { wallMs: warm.wallMs, cpuMs: warm.cpuMs } });
    }
  }
  const output = { corpus: "released igcse via real async loader", rows: questions.length,
    loadAndNormalizationMs: loadMs, measurements, memory: process.memoryUsage(),
    limitations: "Local process CPU includes runtime/GC noise; three iterations/persona; excludes auth/database/network and does not measure provider billing. Memory is final process usage, not isolated cache delta." };
  writeFileSync(process.env.QUESTION_SEARCH_BENCH_OUTPUT!, JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output));
});
