import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { project0580Sections } from "./igcse-0580-official.mjs";
const rawText = readFileSync("src/data/raw/igcse.json", "utf8");
const raw = JSON.parse(rawText).questions;

describe("0580 calibrated additive model lane", () => {
  it("promotes the bounded model subset without replacing original labels or primary ownership", () => {
    const q = raw.find((q: any) => q.id === "0580-2026-june-23-q5");
    const p = project0580Sections(q);
    expect(p.codeRefs).toContain("model_calibrated_2025:E8.2");
    expect(p.codeRefs).toContain("current_2025:E8.2");
    expect(p.primaryTopic).toBe(q.primaryTopic);
    expect(p.subtopics).toEqual(expect.arrayContaining(q.subtopics));
  });
  it("rejects stale model input rather than silently relabelling changed questions", () => {
    const q = raw.find((q: any) => q.id === "0580-2026-june-23-q5");
    expect(() => project0580Sections({ ...q, accessibleText: q.accessibleText + " input changed" })).toThrow(/model.*drift/i);
    expect(() => project0580Sections({ ...q, component: "13" })).toThrow(/model.*drift/i);
  });
  it("holds the flattened-power notation case rather than trusting a confident model answer", () => {
    const q = raw.find((q: any) => q.id === "0580-2022-november-22-q3");
    expect(project0580Sections(q).needsReview).toBe(true);
  });
  it("pins the exact current bank source for reproducible generation", () => {
    const overlay = JSON.parse(readFileSync("src/data/igcse-0580-calibrated-model-overlay.json", "utf8"));
    expect(overlay.sourceRawSha256).toBe(createHash("sha256").update(rawText).digest("hex"));
    expect(overlay.rows.length).toBeGreaterThan(200);
    expect(overlay.rows.every((r: any) => r.confidence >= 0.95 && /^[CE]\d+\.\d+$/.test(r.primaryCode))).toBe(true);
  });
});
