import { describe, expect, it } from "vitest";
import { parseExplorerState, preserveClearedRoutePreset, serializeExplorerState, stripRoutePreset, withRoutePreset } from "@/lib/explorer-state";

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

  it("matches picked topics by main topic unless partial matches are asked for, or a topic page implies them", () => {
    const base = { search: "", sort: "paper" as const, courseRoute: "all" as const, filters: {}, freeOnly: false, savedOnly: false, visible: 24 };
    expect(parseExplorerState({}).partialTopics).toBeUndefined();
    expect(parseExplorerState({ partial: "1" }).partialTopics).toBe(true);
    expect(parseExplorerState({}, { defaultPartialTopics: true }).partialTopics).toBe(true);
    expect(parseExplorerState({ partial: "0" }, { defaultPartialTopics: true }).partialTopics).toBeUndefined();
    expect(serializeExplorerState({ ...base, partialTopics: true }).toString()).toBe("partial=1");
    expect(serializeExplorerState(base).toString()).toBe("");
    expect(serializeExplorerState({ ...base, partialTopics: true }, { defaultPartialTopics: true }).toString()).toBe("");
    expect(serializeExplorerState(base, { defaultPartialTopics: true }).toString()).toBe("partial=0");
  });

  it("accepts only the supported same-page course routes", () => {
    expect(parseExplorerState({ route: "extended" }).courseRoute).toBe("extended");
    expect(parseExplorerState({ route: "both" }).courseRoute).toBe("all");
    expect(parseExplorerState({ route: "nonsense" }).courseRoute).toBe("all");
  });
});

describe("route presets", () => {
  const preset = { topic: "Algebra and graphs" };

  it("applies the route filter only when the URL names no filters", () => {
    expect(parseExplorerState(withRoutePreset({ free: "1" }, preset)).filters).toEqual({ topics: ["Algebra and graphs"] });
    expect(parseExplorerState(withRoutePreset({ topic: "Number" }, preset)).filters).toEqual({ topics: ["Number"] });
    expect(parseExplorerState(withRoutePreset({ year: "2018" }, preset)).filters).toEqual({ topics: ["Algebra and graphs"], years: ["2018"] });
  });

  it("adds route dimensions when another dimension is explicitly filtered", () => {
    expect(parseExplorerState(withRoutePreset({ year: "2021" }, preset)).filters).toEqual({ topics: ["Algebra and graphs"], years: ["2021"] });
    expect(parseExplorerState(withRoutePreset({ topic: "Number", year: "2021" }, preset)).filters).toEqual({ topics: ["Number"], years: ["2021"] });
  });

  it("preserves Clear filters across a reload without overriding shared or worksheet URLs", () => {
    const cleared = preserveClearedRoutePreset(new URLSearchParams("free=1"), preset);
    expect(cleared.toString()).toBe("free=1&_preset=clear");
    expect(parseExplorerState(withRoutePreset(Object.fromEntries(cleared), preset)).filters).toEqual({});
    expect(parseExplorerState(withRoutePreset({ year: "2021", _preset: "clear" }, preset)).filters).toEqual({ years: ["2021"] });
  });

  it("keeps the clean route URL while the state matches the route", () => {
    const own = serializeExplorerState({ ...parseExplorerState(preset), freeOnly: true });
    expect(stripRoutePreset(own, preset).toString()).toBe("free=1");
    const widened = new URLSearchParams("topic=Algebra+and+graphs&topic=Number&free=1");
    expect(stripRoutePreset(widened, preset).toString()).toBe(widened.toString());
    const narrowed = new URLSearchParams("topic=Algebra+and+graphs&year=2018");
    expect(stripRoutePreset(narrowed, preset).toString()).toBe(narrowed.toString());
    expect(stripRoutePreset(narrowed, {}).toString()).toBe(narrowed.toString());
  });
});
