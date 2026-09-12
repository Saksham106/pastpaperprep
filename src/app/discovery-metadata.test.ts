import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("site-wide discovery metadata", () => {
  it("describes the full live subject catalog in default and social metadata", () => {
    const source = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

    expect(source).toMatch(/IGCSE/i);
    expect(source).toMatch(/IB/i);
    expect(source).toMatch(/Math(?:s|ematics)/i);
    expect(source).toMatch(/Chemistry/i);
    expect(source).toMatch(/Physics/i);
    expect(source).toMatch(/Biology/i);
    expect(source).not.toMatch(/Maths & Chemistry Past Papers/);
    expect(source).not.toMatch(/topic-filtered maths and chemistry question workspace/i);
  });
});
