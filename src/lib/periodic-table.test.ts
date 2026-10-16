import { describe, expect, it } from "vitest";
import table from "@/data/cambridge-periodic-table.json";
import { gridCell, hasPeriodicTable } from "@/lib/periodic-table";

describe("Cambridge Periodic Table layout", () => {
  it("places elements where Cambridge prints them", () => {
    expect(gridCell(1)).toEqual({ row: 1, column: 8 });
    expect(gridCell(2)).toEqual({ row: 1, column: 18 });
    expect(gridCell(3)).toEqual({ row: 2, column: 1 });
    expect(gridCell(5)).toEqual({ row: 2, column: 13 });
    expect(gridCell(10)).toEqual({ row: 2, column: 18 });
    expect(gridCell(21)).toEqual({ row: 4, column: 3 });
    expect(gridCell(30)).toEqual({ row: 4, column: 12 });
    expect(gridCell(56)).toEqual({ row: 6, column: 2 });
    expect(gridCell(72)).toEqual({ row: 6, column: 4 });
    expect(gridCell(86)).toEqual({ row: 6, column: 18 });
    expect(gridCell(57)).toEqual({ row: 9, column: 3 });
    expect(gridCell(71)).toEqual({ row: 9, column: 17 });
    expect(gridCell(89)).toEqual({ row: 10, column: 3 });
    expect(gridCell(104)).toEqual({ row: 7, column: 4 });
    expect(gridCell(118)).toEqual({ row: 7, column: 18 });
  });

  it("gives every element its own cell", () => {
    const cells = table.elements.map((element) => JSON.stringify(gridCell(element.number)));
    expect(new Set(cells).size).toBe(118);
  });

  it("carries Cambridge's printed values", () => {
    const byNumber = new Map(table.elements.map((element) => [element.number, element]));
    expect(byNumber.get(17)).toEqual({ number: 17, symbol: "Cl", name: "chlorine", mass: "35.5" });
    expect(byNumber.get(50)).toEqual({ number: 50, symbol: "Sn", name: "tin", mass: "119" });
    expect(byNumber.get(112)).toEqual({ number: 112, symbol: "Cn", name: "copernicium", mass: null });
    expect(table.source.pagesRead).toBe(375);
  });

  it("is offered only on banks whose papers print it", () => {
    expect(hasPeriodicTable("igcse-chemistry-0620")).toBe(true);
    expect(hasPeriodicTable("igcse-coordinated-sciences-0654")).toBe(true);
    for (const bank of ["igcse", "igcse-additional", "igcse-physics-0625", "igcse-biology-0610", "ib-chemistry-hl", undefined]) {
      expect(hasPeriodicTable(bank)).toBe(false);
    }
  });
});
