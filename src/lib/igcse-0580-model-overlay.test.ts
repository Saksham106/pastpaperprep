import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { project0580Sections } from "./igcse-0580-official.mjs";
import { ADDED_0580_QUESTION_IDS, reconstruct0580BaseText } from "./igcse-0580-additions.mjs";
const rawText = readFileSync("src/data/raw/igcse.json", "utf8");
type SourceRow = { id: string; year: number; component: string; primaryTopic: string; secondaryTopics: string[]; subtopics: string[]; accessibleText: string };
const raw = JSON.parse(rawText).questions as SourceRow[];

describe("0580 calibrated additive model lane", () => {
  it("promotes the bounded model subset without replacing original labels or primary ownership", () => {
    const q = raw.find(q => q.id === "0580-2026-june-23-q5")!;
    const p = project0580Sections(q);
    expect(p.codeRefs).toContain("model_calibrated_2025:E8.2");
    expect(p.codeRefs).toContain("current_2025:E8.2");
    expect(p.primaryTopic).toBe(q.primaryTopic);
    expect(p.subtopics).toEqual(expect.arrayContaining(q.subtopics));
  });
  it("rejects stale model input rather than silently relabelling changed questions", () => {
    const q = raw.find(q => q.id === "0580-2026-june-23-q5")!;
    expect(() => project0580Sections({ ...q, accessibleText: q.accessibleText + " input changed" })).toThrow(/model.*drift/i);
    expect(() => project0580Sections({ ...q, component: "13" })).toThrow(/model.*drift/i);
  });
  it("holds the flattened-power notation case rather than trusting a confident model answer", () => {
    const q = raw.find(q => q.id === "0580-2022-november-22-q3")!;
    expect(project0580Sections(q).needsReview).toBe(true);
  });
  it("pins the exact current bank source for reproducible generation", () => {
    const overlay = JSON.parse(readFileSync("src/data/igcse-0580-calibrated-model-overlay.json", "utf8")) as { sourceRawSha256: string; rows: { id: string; confidence: number; primaryCode: string }[] };
    // The overlay was generated from the 3,967-row historical bank; the reviewed Core 2026 rows are
    // a separate, receipt-pinned addition the model lane never saw.
    expect(overlay.sourceRawSha256).toBe(createHash("sha256").update(reconstruct0580BaseText(rawText)).digest("hex"));
    expect(overlay.rows.filter(r => ADDED_0580_QUESTION_IDS.includes(r.id))).toEqual([]);
    expect(overlay.rows.length).toBeGreaterThan(200);
    expect(overlay.rows.every(r => r.confidence >= 0.95 && /^[CE]\d+\.\d+$/.test(r.primaryCode))).toBe(true);
  });
});
