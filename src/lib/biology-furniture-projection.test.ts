import { readFileSync } from "node:fs";
import path from "node:path";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";
import { describe, expect, it } from "vitest";
import runtime from "@/data/production/igcse-biology-0610.json";
import receipt from "../../data/storage/igcse-biology-0610.receipt.json";
import { normalizeBankQuestions } from "@/lib/questions";

const ids = ["0610-2026-m-42-q1", "0610-2026-m-42-q2", "0610-2026-m-42-q6"];

describe("source-confirmed Biology furniture projection", () => {
  it("publishes image counts matching the active viewer and signer", () => {
    const filename = PUBLIC_BANK_INDEX_FILES["igcse-biology-0610"];
    const index = JSON.parse(readFileSync(path.join(process.cwd(), "public", "bank-index", filename), "utf8"));
    const q2 = index.questions.find((q: { id: string }) => q.id === "0610-2026-m-42-q2");
    const q6 = index.questions.find((q: { id: string }) => q.id === "0610-2026-m-42-q6");
    expect(q2.questionImageCount).toBe(3);
    expect(q6.questionImageCount).toBe(2);
  });
  it("hides exactly four reviewed question crops from viewer and signing while keeping page 17", () => {
    const raw = runtime.questions.filter((q) => ids.includes(q.id));
    const before = new Map(raw.map((q) => [q.id, q.questionImages]));
    const rows = normalizeBankQuestions("igcse-biology-0610", raw as Array<Record<string, unknown>>, { applyReviewedBlankPages: true });
    expect(normalizeBankQuestions("igcse-biology-0610", raw as Array<Record<string, unknown>>)
      .find((q) => q.id === ids[1])?.questionImages).toHaveLength(4);
    const q1 = rows.find((q) => q.id === ids[0])!;
    const q2 = rows.find((q) => q.id === ids[1])!;
    const q6 = rows.find((q) => q.id === ids[2])!;
    expect(q1.questionImages).toHaveLength(4);
    expect(q2.questionImages).toHaveLength(3);
    expect(q6.questionImages).toHaveLength(2);
    expect(q6.questionAssetPaths.some((p) => p.includes("/q6-17-2.webp"))).toBe(true);
    expect([...q2.questionAssetPaths, ...q6.questionAssetPaths].some((p) => /q2-9-4|q6-(18-3|19-4|20-5)/.test(p))).toBe(false);
    expect(q2.questionImageCount).toBe(3);
    expect(q6.questionImageCount).toBe(2);
    expect(before.get(ids[1])).toHaveLength(4);
    expect(before.get(ids[2])).toHaveLength(5);
    expect(receipt.completed).toHaveLength(13953);
  });
});
