import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { normalizeBankQuestions, getEconomicsRuntimeArtifact, runtimeMode } = vi.hoisted(() => ({
  normalizeBankQuestions: vi.fn(),
  getEconomicsRuntimeArtifact: vi.fn(),
  runtimeMode: { economicsProduction: false },
}));

vi.mock("@/lib/questions", () => ({ normalizeBankQuestions }));
vi.mock("@/lib/economics-runtime", () => ({ getEconomicsRuntimeArtifact }));
vi.mock("@/lib/corpus-json", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/corpus-json")>();
  return {
    readCorpusJson: (path: string) => path.endsWith("src/data/local-preview/ib-economics-sl.json") ? { questions: [{ id: "preview" }] } : actual.readCorpusJson(path),
  };
});
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

  it("rejects, instead of throwing, when the production Economics artifact can't be read", async () => {
    runtimeMode.economicsProduction = true;
    getEconomicsRuntimeArtifact.mockImplementation(() => {
      throw new Error("ENOENT: ib-economics-sl.json");
    });
    const { loadBankQuestions, loadBankRawQuestions } = await import("@/lib/question-loader");

    let raw: Promise<unknown> | undefined;
    let questions: Promise<unknown> | undefined;
    expect(() => { raw = loadBankRawQuestions("ib-economics-sl"); }).not.toThrow();
    expect(() => { questions = loadBankQuestions("ib-economics-sl"); }).not.toThrow();
    await expect(raw).rejects.toThrow("ENOENT");
    // The bank explorer's .catch(() => null) fallback now sees the failure.
    await expect(questions!.catch(() => null)).resolves.toBeNull();

    // A failed read isn't cached: the next call reads again.
    getEconomicsRuntimeArtifact.mockReturnValue({ questions: [{ id: "recovered" }] });
    normalizeBankQuestions.mockImplementation((_slug, rows) => rows);
    await expect(loadBankQuestions("ib-economics-sl")).resolves.toEqual([{ id: "recovered" }]);
  });
});
