import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("site-wide discovery metadata", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("describes the full live subject catalog in default and social metadata", () => {
    const source = read("src/app/layout.tsx");

    expect(source).toMatch(/IGCSE/i);
    expect(source).toMatch(/IB/i);
    expect(source).toMatch(/Math(?:s|ematics)/i);
    expect(source).toMatch(/Chemistry/i);
    expect(source).toMatch(/Physics/i);
    expect(source).toMatch(/Biology/i);
    expect(source).toMatch(/Economics/i);
    expect(source).not.toMatch(/Maths & Chemistry Past Papers/);
    expect(source).not.toMatch(/topic-filtered maths and chemistry question workspace/i);
  });

  it.each([
    "src/app/page.tsx",
    "src/app/pricing/page.tsx",
    "src/app/articles/page.tsx",
  ])("includes Economics in high-intent discovery copy: %s", (path) => {
    expect(read(path)).toMatch(/Economics/i);
  });

  it("keeps high-traffic comparison articles aligned with the live catalog", () => {
    const source = read("src/lib/article-clusters/alternatives-comparisons.ts");

    expect(source).toMatch(/live Cambridge IGCSE and IB banks spanning Maths, Biology, Chemistry, Physics, Co-ordinated Sciences and Economics/i);
    expect(source).toMatch(/IB Maths, Chemistry, Physics, Biology and Economics at HL and SL/i);
    expect(source).not.toMatch(/\b19 live banks\b|28,541|1,827/i);
  });
});
