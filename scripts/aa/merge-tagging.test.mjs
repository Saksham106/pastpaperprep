import { describe, expect, it } from "vitest";
import { applyTagging, validateTagging } from "./merge-tagging.mjs";
import { derivedItems, withOfficialItems } from "./official-items.mjs";
import { buildChunks } from "./export-tagging-chunks.mjs";
import { deriveOverlay } from "./derive-official-items.mjs";

const items = [
  { item: "1.1", name: "One", level: "SL", bullets: [{ id: "1.1-b1", text: "first" }] },
  { item: "1.2", name: "Two", level: "SL", bullets: [{ id: "1.2-b1", text: "second" }] },
  { item: "1.3", name: "Three", level: "AHL", bullets: [{ id: "1.3-b1", text: "third" }] },
];
const groups = [
  { id: "g.one", studentFacingName: "One", memberOfficialItems: ["1.1"], classificationBoundary: { inclusive: "a", exclusive: "b" } },
  { id: "g.two", studentFacingName: "Two and three", memberOfficialItems: ["1.2", "1.3"], classificationBoundary: { inclusive: "c", exclusive: "d" } },
];
const record = (id, groupIds, extra = {}) => ({ id, level: "SL", groupIds, subtopics: groupIds, status: "accepted", provenance: {}, ...extra });
const data = () => ({
  items,
  groups,
  itemOrder: new Map(items.map((entry, index) => [entry.item, index])),
  groupById: new Map(groups.map((group) => [group.id, group])),
  overlay: { schemaVersion: "x", records: [record("a", ["g.one"]), record("b", ["g.two"]), record("c", ["g.one", "g.two"]), record("d", ["g.one"], { status: "blocked" })] },
});
const chunked = new Map([
  ["b", { candidates: [{ item: "1.2" }, { item: "1.3" }] }],
  ["c", { candidates: [{ item: "1.1" }, { item: "1.2" }, { item: "1.3" }] }],
]);

describe("derive and placement", () => {
  it("derives only single-item accepted records and is idempotent", () => {
    const first = deriveOverlay(data());
    expect(first).toMatchObject({ derived: 1, pending: 2, blocked: 1 });
    expect(first.overlay.records[0].officialItems).toEqual(["1.1"]);
    expect(Object.keys(first.overlay.records[0])).toEqual(["id", "level", "groupIds", "subtopics", "officialItems", "status", "provenance"]);
    expect(first.overlay.records[1]).not.toHaveProperty("officialItems");
    const again = deriveOverlay({ ...data(), overlay: first.overlay });
    expect(JSON.stringify(again.overlay)).toBe(JSON.stringify(first.overlay));
    expect(derivedItems(data().overlay.records[2], data())).toBeNull();
  });
  it("replaces an existing officialItems in place", () => {
    const moved = withOfficialItems(withOfficialItems(record("a", ["g.one"]), ["1.1"]), ["1.2"]);
    expect(Object.keys(moved).filter((key) => key === "officialItems")).toHaveLength(1);
    expect(moved.officialItems).toEqual(["1.2"]);
  });
});

describe("merge validation", () => {
  const ok = [{ file: "a.json", rows: [{ id: "b", officialItems: ["1.3"] }, { id: "c", officialItems: ["1.2", "1.1"] }] }];
  it("accepts candidate items and applies them sorted into the overlay", () => {
    const { errors, tags } = validateTagging(ok, chunked);
    expect(errors).toEqual([]);
    const { overlay, written } = applyTagging(data(), tags);
    expect(written).toBe(2);
    expect(overlay.records.find((row) => row.id === "c").officialItems).toEqual(["1.1", "1.2"]);
    expect(Object.keys(overlay.records[2])).toEqual(["id", "level", "groupIds", "subtopics", "officialItems", "status", "provenance"]);
    expect(applyTagging({ ...data(), overlay }, tags)).toMatchObject({ written: 0, unchanged: 2 });
  });
  it.each([
    ["an unchunked id", [{ id: "a", officialItems: ["1.1"] }], /not a chunked record/],
    ["an item that is not a candidate", [{ id: "b", officialItems: ["1.1"] }], /not among its candidates/],
    ["an empty list", [{ id: "b", officialItems: [] }], /non-empty/],
    ["a missing list", [{ id: "b" }], /non-empty/],
    ["a repeated item", [{ id: "b", officialItems: ["1.2", "1.2"] }], /repeats an item/],
    ["a duplicate id", [{ id: "b", officialItems: ["1.2"] }, { id: "b", officialItems: ["1.3"] }], /duplicate id b/],
    ["a missing id", [{ officialItems: ["1.2"] }], /missing id/],
  ])("refuses %s", (_label, rows, pattern) => {
    const { errors } = validateTagging([{ file: "x.json", rows }], chunked);
    expect(errors.join("\n")).toMatch(pattern);
  });
  it("refuses a duplicate id across files and a non-array file", () => {
    const { errors } = validateTagging([{ file: "a.json", rows: [{ id: "b", officialItems: ["1.2"] }] }, { file: "b.json", rows: [{ id: "b", officialItems: ["1.2"] }] }, { file: "c.json", rows: {} }], chunked);
    expect(errors.join("\n")).toMatch(/duplicate id b \(also in a\.json\[0\]\)/);
    expect(errors.join("\n")).toMatch(/c\.json: expected an array/);
  });
});

describe("chunk export", () => {
  it("chunks only untagged accepted records, with candidates and marked steps", () => {
    const sources = {
      banks: { SL: new Map(["a", "b", "c"].map((id) => [id, { id, paper: "1", year: "2020", session: "May", marks: "5", accessibleText: `text  of ${id}`, solution: "ms" }])), HL: new Map() },
      explanationDirs: { SL: "/nonexistent", HL: "/nonexistent" },
    };
    const base = data();
    base.overlay.records[0] = withOfficialItems(base.overlay.records[0], ["1.1"]);
    const chunks = buildChunks(base, sources, 60);
    expect(chunks).toHaveLength(1);
    // Ordered by group set: "g.one|g.two" sorts before "g.two".
    expect(chunks[0].map((entry) => entry.id)).toEqual(["c", "b"]);
    const entry = chunks[0].find((candidate) => candidate.id === "c");
    expect(entry.candidates.map((candidate) => candidate.item)).toEqual(["1.1", "1.2", "1.3"]);
    expect(entry.candidates[1]).toMatchObject({ name: "Two", level: "SL", bullets: ["second"] });
    expect(entry.candidates[1].groups[0].classificationBoundary).toEqual({ inclusive: "c", exclusive: "d" });
    expect(entry).toMatchObject({ paper: "P1", markedSteps: null, markScheme: { text: "ms" }, question: { text: "text of c" } });
  });
  it("splits into balanced chunks of at most the size", () => {
    const records = Array.from({ length: 7 }, (_v, index) => record(`q${index}`, ["g.two"]));
    const sources = { banks: { SL: new Map(records.map(({ id }) => [id, { id, paper: "2", accessibleText: "t" }])), HL: new Map() }, explanationDirs: { SL: "/x", HL: "/x" } };
    const chunks = buildChunks({ ...data(), overlay: { records } }, sources, 3);
    expect(chunks.map((chunk) => chunk.length)).toEqual([2, 3, 2]);
  });
});
