import { describe, expect, it } from "vitest";
import { parseExplorerState, serializeExplorerState } from "@/lib/explorer-state";

describe("question explorer URL state", () => {
  it("parses shareable filters, sort, saved-only mode, and pagination", () => {
    expect(parseExplorerState({
      q: "vectors",
      sort: "marks-desc",
      topic: ["Algebra", "Geometry"],
      subtopic: "Vectors",
      year: "2025",
      saved: "1",
      page: "3",
    })).toEqual({
      search: "vectors",
      sort: "marks-desc",
      courseRoute: "all",
      filters: {
        topics: ["Algebra", "Geometry"],
        subtopics: ["Vectors"],
        years: ["2025"],
      },
      freeOnly: false,
      savedOnly: true,
      visible: 72,
    });
  });

  it("round-trips only allowlisted, bounded workspace state", () => {
    const query = serializeExplorerState({
      search: "  calculus  ",
      sort: "topic",
      courseRoute: "core",
      filters: { topics: ["Calculus", "Calculus"], calculator: ["non-calculator"] },
      freeOnly: true,
      savedOnly: false,
      visible: 9_999,
    });

    expect(query.toString()).toBe("q=calculus&sort=topic&route=core&topic=Calculus&calculator=non-calculator&free=1&page=10");
    expect(parseExplorerState(Object.fromEntries(query))).toMatchObject({
      search: "calculus",
      sort: "topic",
      courseRoute: "core",
      freeOnly: true,
      visible: 240,
    });
  });

  it("drops invalid sort, page, and oversized filter values", () => {
    expect(parseExplorerState({ sort: "random", page: "-4", topic: "x".repeat(101) })).toEqual({
      search: "",
      sort: "paper",
      courseRoute: "all",
      filters: {},
      freeOnly: false,
      savedOnly: false,
      visible: 24,
    });
  });

  it("defaults free visitors to preview questions while respecting an explicit full-bank choice", () => {
    expect(parseExplorerState({}, { defaultFreeOnly: true }).freeOnly).toBe(true);
    expect(parseExplorerState({ free: "0" }, { defaultFreeOnly: true }).freeOnly).toBe(false);
    expect(serializeExplorerState({
      search: "",
      sort: "paper",
      courseRoute: "all",
      filters: {},
      freeOnly: false,
      savedOnly: false,
      visible: 24,
    }, { persistFreeChoice: true }).toString()).toBe("free=0");
  });

  it("accepts only the supported same-page course routes", () => {
    expect(parseExplorerState({ route: "extended" }).courseRoute).toBe("extended");
    expect(parseExplorerState({ route: "both" }).courseRoute).toBe("all");
    expect(parseExplorerState({ route: "nonsense" }).courseRoute).toBe("all");
  });
});
