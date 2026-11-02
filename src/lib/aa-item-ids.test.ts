import { describe, expect, it } from "vitest";
import items from "@/data/aa-official-subtopics/items.json";
import { AA_ITEM_IDS, isAaItemId } from "./aa-item-ids";

describe("AA item ids", () => {
  it("match items.json exactly", () => expect([...AA_ITEM_IDS]).toEqual(items.items.map((entry) => entry.item)));
  it("accepts real items only", () => {
    expect(isAaItemId("5.16")).toBe(true);
    for (const junk of ["abc", "9.99", "5.", "5.016", "", "__proto__"]) expect(isAaItemId(junk)).toBe(false);
  });
});
