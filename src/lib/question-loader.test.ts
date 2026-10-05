import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { normalizeBankQuestions, getEconomicsRuntimeArtifact, runtimeMode } = vi.hoisted(() => ({
  normalizeBankQuestions: vi.fn(),
  getEconomicsRuntimeArtifact: vi.fn(),
  runtimeMode: { economicsProduction: false },
}));

vi.mock("@/lib/questions", () => ({ normalizeBankQuestions }));
vi.mock("@/lib/economics-runtime", () => ({ getEconomicsRuntimeArtifact }));
vi.mock("@/data/local-preview/ib-economics-sl.json", () => ({ default: { questions: [{ id: "preview" }] } }));
vi.mock("@/lib/banks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/banks")>();
  return {
    ...actual,
    isLocalEconomicsBank: (slug: string) => slug === "ib-economics-sl" || slug === "ib-economics-hl",
    isEconomicsProductionEnabled: () => runtimeMode.economicsProduction,
    isIGCSEReleaseBank: () => false,
    isIGCSEReleaseEnabled: () => false,
  };
});

beforeEach(() => {
  vi.resetModules();
  normalizeBankQuestions.mockReset();
  getEconomicsRuntimeArtifact.mockReset();
  runtimeMode.economicsProduction = false;
});

afterEach(() => vi.clearAllMocks());

describe("bank question lookup cache", () => {
  it("returns the same cached index for repeated reads", async () => {
    normalizeBankQuestions.mockReturnValue([{ id: "q1" }]);
    const { loadBankQuestionMap } = await import("@/lib/question-loader");
    const first = await loadBankQuestionMap("ib-sl");
    const second = await loadBankQuestionMap("ib-sl");

    expect(second).toBe(first);
    expect(first.size).toBe(1);
  });

  it("retries normalization after a rejected load instead of retaining the rejection", async () => {
    normalizeBankQuestions.mockImplementationOnce(() => {
      throw new Error("temporary normalization failure");
    }).mockReturnValue([{ id: "recovered" }]);
    const { loadBankQuestions } = await import("@/lib/question-loader");

    await expect(loadBankQuestions("ib-sl")).rejects.toThrow("temporary normalization failure");
    await expect(loadBankQuestions("ib-sl")).resolves.toEqual([{ id: "recovered" }]);
    expect(normalizeBankQuestions).toHaveBeenCalledTimes(2);
  });

  it("keeps preview and production runtime cache entries separate", async () => {
    const preview = { questions: [{ id: "preview" }] };
    const production = { questions: [{ id: "production" }] };
    getEconomicsRuntimeArtifact.mockReturnValue(production);
    normalizeBankQuestions.mockImplementation((_slug, questions) => questions);
    const { loadBankQuestions } = await import("@/lib/question-loader");

    const previewResult = await loadBankQuestions("ib-economics-sl");
    runtimeMode.economicsProduction = true;
    const productionResult = await loadBankQuestions("ib-economics-sl");
    runtimeMode.economicsProduction = false;
    const cachedPreview = await loadBankQuestions("ib-economics-sl");

    expect(previewResult).toEqual(preview.questions);
    expect(productionResult).toEqual(production.questions);
    expect(cachedPreview).toBe(previewResult);
    expect(productionResult).not.toBe(previewResult);
    expect(getEconomicsRuntimeArtifact).toHaveBeenCalledWith("ib-economics-sl");
  });
});
