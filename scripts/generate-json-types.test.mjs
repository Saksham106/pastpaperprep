// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { jsonSpecifiers, MIN_JSON_BYTES, staleDeclarations, typeFor } from "./generate-json-types.mjs";

test("infers widened types, optional keys for uneven array elements, and Record for id-keyed tables", () => {
  expect(typeFor({ a: 1, b: [], c: null })).toBe("{\n  a: number;\n  b: never[];\n  c: null;\n}");
  expect(typeFor([{ id: "x", marks: 2 }, { id: "y", note: true }, "z"]))
    .toBe("Array<string | {\n  id: string;\n  marks?: number;\n  note?: boolean;\n}>");
  const table = Object.fromEntries(Array.from({ length: 60 }, (_, index) => [`0610-2026-m-32-q${index}`, { sha256: "s" }]));
  expect(typeFor(table)).toBe("Record<string, {\n  sha256: string;\n}>");
});

test("every large imported JSON file has a current .d.json.ts, so tsc never type-infers the data itself", () => {
  expect(staleDeclarations()).toEqual([]);
});

test("finds JSON imports in every form tsc follows, including commented, side-effect and dynamic imports", () => {
  const source = [
    'import a from /* source data */ "./a.json";',
    'const b = import(/* source data */ "./b.json");',
    'import "./c.json";',
    'import d from "@/data/d.json";',
    'const e = require("./e.json");',
    '// import f from "./f.json";',
    'const g = "./g.json";',
  ].join("\n");
  expect(jsonSpecifiers(source)).toEqual(["./a.json", "./b.json", "./c.json", "@/data/d.json", "./e.json"]);
});

test("the freshness check fails when a large JSON is imported without its declaration, whatever the import form", () => {
  for (const importLine of [
    'import data from /* source data */ "./large.json";',
    'const data = import(/* source data */ "./large.json");',
    'import "./large.json";',
  ]) {
    const base = mkdtempSync(join(tmpdir(), "json-types-"));
    try {
      mkdirSync(join(base, "src"));
      writeFileSync(join(base, "src", "large.json"), JSON.stringify({ text: "x".repeat(MIN_JSON_BYTES) }));
      writeFileSync(join(base, "src", "use.ts"), `${importLine}\n`);
      expect(staleDeclarations(base), importLine).toEqual([join("src", "large.d.json.ts")]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  }
});
