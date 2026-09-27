import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import path from "node:path";

describe("Pietro Meloni article link", () => {
  it("uses a distinct accessible article-link color with hover and keyboard focus states", () => {
    const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/\.article-section\s+a\s*\{[^}]*color:\s*var\(--cobalt-strong\)/);
    expect(css).toMatch(/\.article-section\s+a:hover/);
    expect(css).toMatch(/\.article-section\s+a:focus-visible[^}]*outline/);
  });
});
