import { describe, expect, it } from "vitest";
import { parseBuilderState, serializeBuilderState, type BuilderState } from "@/lib/builder-url";

describe("builder URL state", () => {
  it("round-trips every choice", () => {
    const state: BuilderState = {
      bank: "igcse-biology-0610", route: "core", from: 2019, to: 2025,
      selection: ["t:Enzymes", "t:Characteristics, classification", "s:Respiration␟Aerobic respiration"],
      target: { kind: "papers", targets: [{ paper: 2, mode: "questions", amount: 5 }, { paper: 4, mode: "marks", amount: 30 }] }, seed: 123,
    };
    expect(parseBuilderState(new URLSearchParams(serializeBuilderState(state)))).toEqual(state);
    const marks: BuilderState = { route: "all", selection: [], target: { kind: "marks", amount: 50 } };
    expect(parseBuilderState(new URLSearchParams(serializeBuilderState(marks)))).toEqual(marks);
  });
  it("defaults to ten questions from every topic", () => {
    expect(parseBuilderState(new URLSearchParams(""))).toEqual({ route: "all", selection: [], target: { kind: "questions", amount: 10 } });
  });
  it("ignores or clamps junk", () => {
    const state = parseBuilderState(new URLSearchParams("bank=../x&route=nope&from=abc&to=1999.5&size=q999&seed=abc&papers=x,2q0,7m9999,3q4&t="));
    expect(state).toEqual({ route: "all", selection: [], target: { kind: "papers", targets: [{ paper: 3, mode: "questions", amount: 4 }, { paper: 7, mode: "marks", amount: 200 }] } });
    expect(parseBuilderState(new URLSearchParams("size=q999")).target).toEqual({ kind: "questions", amount: 50 });
    expect(parseBuilderState(new URLSearchParams("size=m0")).target).toEqual({ kind: "questions", amount: 10 });
    expect(parseBuilderState(new URLSearchParams("seed=4294967296")).seed).toBeUndefined();
  });
});
