import { describe, expect, it } from "vitest";
import { defaultRouteSelection, deriveCourseRoute, matchesCourseRoute, parseRouteSelection, readRememberedRoute, rememberRoute, routeConfigFor, routeLabel, routePapers, supportsCourseRoute } from "@/lib/course-route";

describe("course routes", () => {
  it("derives Core, Extended, and shared practical routes", () => {
    expect(deriveCourseRoute("igcse", 1)).toBe("core");
    expect(deriveCourseRoute("igcse", 3)).toBe("core");
    expect(deriveCourseRoute("igcse", 2)).toBe("extended");
    expect(deriveCourseRoute("igcse", 4)).toBe("extended");
    expect(deriveCourseRoute("igcse-chemistry-0620", 5)).toBe("both");
    expect(deriveCourseRoute("igcse-chemistry-0620", 6)).toBe("both");
  });

  it("shows shared practical papers in either selected route", () => {
    expect(matchesCourseRoute("both", "core")).toBe(true);
    expect(matchesCourseRoute("both", "extended")).toBe(true);
    expect(matchesCourseRoute("extended", "core")).toBe(false);
  });

  it("supports exactly the five Core/Extended Cambridge banks", () => {
    expect([
      "igcse",
      "igcse-biology-0610",
      "igcse-chemistry-0620",
      "igcse-physics-0625",
      "igcse-coordinated-sciences-0654",
    ].every((bank) => supportsCourseRoute(bank as Parameters<typeof supportsCourseRoute>[0]))).toBe(true);
    expect(supportsCourseRoute("igcse-additional")).toBe(false);
    expect(supportsCourseRoute("ib-hl")).toBe(false);
    expect(deriveCourseRoute("ib-hl", 1)).toBe("");
  });
});

describe("A Level 9709 paper tabs", () => {
  it("gives each paper its own route and opens on Pure 1", () => {
    expect([1, 2, 3, 4, 5, 6].map((paper) => deriveCourseRoute("a-level-maths-9709", paper))).toEqual(["pure-1", "pure-2", "pure-3", "mechanics", "ps-1", "ps-2"]);
    expect(defaultRouteSelection("a-level-maths-9709")).toBe("pure-1");
    expect(routeConfigFor("a-level-maths-9709")?.options.map((option) => option.label)).toEqual(["Pure 1", "Pure 2", "Pure 3", "Mechanics", "Stats 1", "Stats 2"]);
    expect(routeConfigFor("a-level-maths-9709")).toMatchObject({ allLabel: "All papers", remember: true, scopesTopics: true, hidesPaperFilter: true });
  });

  it("keeps papers apart: a tab matches only its own paper", () => {
    expect(matchesCourseRoute("pure-3", "pure-3")).toBe(true);
    expect(matchesCourseRoute("pure-2", "pure-3")).toBe(false);
    expect(matchesCourseRoute("mechanics", "all")).toBe(true);
  });

  it("accepts only a bank's own route values", () => {
    expect(parseRouteSelection("a-level-maths-9709", "pure-3")).toBe("pure-3");
    expect(parseRouteSelection("a-level-maths-9709", "all")).toBe("all");
    expect(parseRouteSelection("a-level-maths-9709", "core")).toBeUndefined();
    expect(parseRouteSelection("igcse", "pure-1")).toBeUndefined();
    expect(parseRouteSelection("ib-hl", "core")).toBeUndefined();
    expect(routeLabel("a-level-maths-9709", "ps-2")).toBe("Stats 2");
    expect(routePapers("a-level-maths-9709", "mechanics")).toEqual([4]);
    expect(routePapers("a-level-maths-9709", "all")).toBeUndefined();
  });

  it("gives Core/Extended students their tier: no All, Extended by default, remembered, topics unscoped", () => {
    expect(defaultRouteSelection("igcse")).toBe("extended");
    expect(routeConfigFor("igcse")).toMatchObject({ showAll: false, remember: true, sharedMemory: "igcse-tier", scopesTopics: false, hidesPaperFilter: false });
    expect(parseRouteSelection("igcse", "all")).toBeUndefined();
    expect(parseRouteSelection("a-level-maths-9709", "all")).toBe("all");
    expect(routeConfigFor("igcse")?.options.map(({ id, label, detail }) => [id, label, detail])).toEqual([["core", "Core", "Papers 1 & 3"], ["extended", "Extended", "Papers 2 & 4"]]);
    expect(routeLabel("igcse", "both")).toBe("");
  });

  it("remembers the last tab per bank for remembering banks only", () => {
    const store = new Map<string, string>();
    const localStorage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) };
    const previous = globalThis.window;
    Object.defineProperty(globalThis, "window", { value: { localStorage }, configurable: true });
    try {
      expect(readRememberedRoute("a-level-maths-9709")).toBeUndefined();
      rememberRoute("a-level-maths-9709", "ps-1");
      expect(readRememberedRoute("a-level-maths-9709")).toBe("ps-1");
      // IGCSE tiers: a pick on one bank becomes every IGCSE bank's default, and a bank's own pick wins.
      expect(readRememberedRoute("igcse")).toBeUndefined();
      rememberRoute("igcse", "core");
      expect(readRememberedRoute("igcse")).toBe("core");
      expect(readRememberedRoute("igcse-chemistry-0620")).toBe("core");
      rememberRoute("igcse-chemistry-0620", "extended");
      expect(readRememberedRoute("igcse-physics-0625")).toBe("extended");
      expect(readRememberedRoute("igcse")).toBe("core");
      expect(store.has("ppp-route:igcse-tier")).toBe(true);
      store.set("ppp-route:a-level-maths-9709", "nonsense");
      expect(readRememberedRoute("a-level-maths-9709")).toBeUndefined();
    } finally {
      Object.defineProperty(globalThis, "window", { value: previous, configurable: true });
    }
  });
});
