import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("brand icon", () => {
  it("uses the open-book logo for browser metadata", () => {
    const icon = readFileSync(join(process.cwd(), "src/app/icon.svg"), "utf8");
    expect(icon).toContain("M232,48H160");
    expect(icon).toContain("#15554a");
    expect(icon).not.toMatch(/>B<|>P</);
  });
});