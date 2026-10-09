import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CALCULATOR_FILTER_BANKS, CALCULATOR_POLICY_BANKS, calculatorAllowed, calculatorBadgeText } from "@/lib/calculator-policy.mjs";

type RawQuestion = { id: string; paper: number; year: number; calculator: boolean };
const raw = (file: string) => (JSON.parse(readFileSync(join(process.cwd(), "src/data/raw", file), "utf8")) as { questions: RawQuestion[] }).questions;

describe("calculator policy", () => {
  it("applies each exam board's paper rule", () => {
    expect(calculatorAllowed("igcse", { paper: 1, year: 2025 })).toBe(false);
    expect(calculatorAllowed("igcse", { paper: 2, year: 2026 })).toBe(false);
    expect(calculatorAllowed("igcse", { paper: 4, year: 2025 })).toBe(true);
    expect(calculatorAllowed("igcse", { paper: 2, year: 2024 })).toBe(true);
    expect(calculatorAllowed("igcse-additional", { paper: 1, year: 2025 })).toBe(false);
    expect(calculatorAllowed("igcse-additional", { paper: 1, year: 2024 })).toBe(true);
    expect(calculatorAllowed("igcse-additional", { paper: 2, year: 2025 })).toBe(true);
    expect(calculatorAllowed("ib-hl", { paper: 1, year: 2018 })).toBe(false);
    expect(calculatorAllowed("ib-hl", { paper: 3, year: 2024 })).toBe(true);
    expect(calculatorAllowed("ib-sl", { paper: 1, year: 2025 })).toBe(false);
    expect(calculatorAllowed("ib-sl", { paper: 2, year: 2025 })).toBe(true);
    expect(calculatorAllowed("ib-ai-hl", { paper: 1, year: 2023 })).toBe(true);
    expect(calculatorAllowed("ib-ai-sl", { paper: 1, year: 2023 })).toBe(true);
    expect(calculatorAllowed("igcse-chemistry-0620", { paper: 1, year: 2024 })).toBeNull();
    expect(calculatorAllowed("ib-economics-hl", { paper: 1, year: 2024 })).toBeNull();
  });

  it("agrees with every reviewed 0580 calculator value", () => {
    const questions = raw("igcse.json");
    expect(questions).toHaveLength(3967);
    expect(questions.filter((question) => calculatorAllowed("igcse", question) !== question.calculator)).toEqual([]);
  });

  it("corrects exactly the pre-2025 0606 Paper 1 questions the raw data marks non-calculator", () => {
    const changed = raw("igcse-additional.json").filter((question) => calculatorAllowed("igcse-additional", question) !== question.calculator);
    expect(changed).toHaveLength(691);
    expect(changed.every((question) => question.year < 2025 && question.paper === 1 && question.calculator === false)).toBe(true);
  });

  it("labels badges for printing and leaves unknown banks untagged", () => {
    expect(calculatorBadgeText(true)).toBe("CALCULATOR");
    expect(calculatorBadgeText(false)).toBe("NO CALCULATOR");
    expect(calculatorBadgeText(null)).toBeNull();
    expect(calculatorBadgeText(undefined)).toBeNull();
  });

  it("only offers a filter where both values occur", () => {
    expect(CALCULATOR_FILTER_BANKS).toEqual(["igcse", "igcse-additional", "ib-hl", "ib-sl"]);
    expect(CALCULATOR_POLICY_BANKS).toEqual(["igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl"]);
  });
});
