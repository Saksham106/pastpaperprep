import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Server HTML formats numbers in en-US. A client component that formats with the
// browser's locale ("4174" in pl-PL, "1,53,412" in en-IN) fails hydration (React #418).
function clientComponents(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return clientComponents(path);
    if (!/\.tsx$/.test(entry.name) || /\.test\.tsx$/.test(entry.name)) return [];
    return /^\s*["']use client["']/.test(readFileSync(path, "utf8")) ? [path] : [];
  });
}

describe("client number formatting", () => {
  it("pins a locale so server and browser render the same text", () => {
    const offenders = clientComponents(join(process.cwd(), "src")).filter((path) => /\.toLocaleString\(\s*\)/.test(readFileSync(path, "utf8")));
    expect(offenders.map((path) => path.slice(process.cwd().length + 1))).toEqual([]);
  });
});
