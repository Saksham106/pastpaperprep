import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("nested worktree exclusion", () => {
  it("excludes both worktree layouts from Vitest discovery", () => {
    const src = readFileSync("vitest.config.ts", "utf8");
    expect(src).toContain('"**/.worktrees/**"');
    expect(src).toContain('"**/.claude/worktrees/**"');
  });

  it("ignores both worktree layouts in ESLint", () => {
    const src = readFileSync("eslint.config.mjs", "utf8");
    expect(src).toContain('".worktrees/**"');
    expect(src).toContain('".claude/worktrees/**"');
  });
});
