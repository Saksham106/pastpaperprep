import { test, expect } from "vitest";
import closure from "./data/original-other-closure-20260927.json";
import chemistry from "./data/0620-other-retrieval-targets.json";
import practical from "./data/0625-practical-retrieval-targets.json";
import physicsMcq from "./data/0625-2026-mcq-retrieval-targets.json";
import coordinated from "../src/data/production/igcse-coordinated-sciences-0654.json";

// This ledger is the frozen targeted queue, never a whole-bank assurance claim.
test("all original Other and 0654 parent-error IDs have exclusive, nonempty dispositions", () => {
  expect(closure.scope).toEqual({ otherRows: 194, transportParentRows: 39 });
  expect(closure.rows).toHaveLength(233);
  const ids = new Set(closure.rows.map((r) => r.id));
  expect(ids.size).toBe(233);
  expect(Object.values(closure.dispositionCounts).reduce((a, b) => a + b, 0)).toBe(233);
  expect(closure.dispositionCounts.released_broad_practical_retrieval_historical_gap_retained).toBe(144);
  expect(closure.dispositionCounts.released_mcq_retrieval_historical_gap_retained).toBe(14);
  expect(closure.dispositionCounts.chemistry_retrieval_in_this_change_historical_gap_retained).toBe(30);
  expect(closure.dispositionCounts.released_parent_correction).toBe(39);
  expect(closure.dispositionCounts.reviewed_unresolved_no_single_detail).toBe(2);
  expect(closure.dispositionCounts.reviewed_unresolved_era_gap).toBe(4);
  expect(practical.ids.every((id) => ids.has(id))).toBe(true);
  expect(physicsMcq.rows.every(([id]) => ids.has(id))).toBe(true);
  expect(chemistry.rows.every((r) => ids.has(r.id))).toBe(true);
  for (const row of closure.rows) {
    expect(row.reason.length, row.id).toBeGreaterThan(25);
    if (row.originalQueue.endsWith("/other")) {
      expect(row.questionPaperSha256, row.id).toMatch(/^[a-f0-9]{64}$/);
      expect(row.markSchemeSha256, row.id).toMatch(/^[a-f0-9]{64}$/);
    }
  }
  const parents = closure.rows.filter((r) => r.disposition === "released_parent_correction");
  for (const row of parents) {
    const q = coordinated.questions.find((item) => item.id === row.id);
    expect(q?.primaryTopic, row.id).toBe("Transport in animals");
    expect(q?.subtopics, row.id).toContain("Transport in mammals");
  }
});
