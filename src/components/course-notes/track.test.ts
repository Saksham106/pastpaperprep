import { beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: track }));

import * as t from "./track";

const ctx = { lesson: "5.16", level: "HL" as const };

beforeEach(() => track.mockClear());

describe("notes tracking helpers", () => {
  it("sends the exact event names and props", () => {
    t.trackLessonView(ctx);
    t.trackExampleStep(ctx, "ex-1", 2);
    t.trackExampleStep(ctx, "ex-1", "all");
    t.trackCheckAnswer(ctx, "chk-1", false);
    t.trackGlossaryOpen(ctx, "derivative");
    t.trackPracticeClick(ctx, "ib-hl", "integration-by-parts");
    t.trackUnderstood(ctx);
    t.trackLevelSwitch({ lesson: "5.16", level: "SL" });
    t.trackSearch({ level: "SL" }, true);
    t.trackReport(ctx, "typo");
    t.trackCheatsheetPrint({ level: "SL" }, "calculus");
    expect(track.mock.calls).toEqual([
      ["notes_lesson_view", { lesson: "5.16", level: "HL" }],
      ["notes_example_step", { lesson: "5.16", level: "HL", example: "ex-1", step: 2 }],
      ["notes_example_step", { lesson: "5.16", level: "HL", example: "ex-1", step: "all" }],
      ["notes_check_answer", { lesson: "5.16", level: "HL", check: "chk-1", correct: false }],
      ["notes_glossary_open", { lesson: "5.16", level: "HL", term: "derivative" }],
      ["notes_practice_click", { lesson: "5.16", level: "HL", bank: "ib-hl", group: "integration-by-parts" }],
      ["notes_understood", { lesson: "5.16", level: "HL" }],
      ["notes_level_switch", { lesson: "5.16", level: "SL" }],
      ["notes_search", { level: "SL", found: true }],
      ["notes_report", { lesson: "5.16", level: "HL", issue: "typo" }],
      ["notes_cheatsheet_print", { topic: "calculus", level: "SL" }],
    ]);
  });

  it("search carries only a boolean, never query text", () => {
    t.trackSearch({ level: "HL" }, false);
    const props = track.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(props).sort()).toEqual(["found", "level"]);
    expect(typeof props.found).toBe("boolean");
  });

  it("omits lesson on pages without one", () => {
    t.trackLevelSwitch({ level: "HL" });
    expect(track).toHaveBeenCalledWith("notes_level_switch", { level: "HL" });
  });
});
