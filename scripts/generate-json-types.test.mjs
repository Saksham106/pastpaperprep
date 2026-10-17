// @vitest-environment node
import { expect, test } from "vitest";
import { staleDeclarations, typeFor } from "./generate-json-types.mjs";

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
