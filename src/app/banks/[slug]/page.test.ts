import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadBankQuestions, notFound, createClient } = vi.hoisted(() => ({
  loadBankQuestions: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("next/headers", () => ({ cookies: () => ({ getAll: () => [] }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/proxy", () => ({ hasSupabaseAuthCookie: () => false }));
vi.mock("@/lib/question-loader", () => ({ loadBankQuestions }));

import BankPage from "./page";

const RELEASE_ENVIRONMENT: Record<string, string> = {
  NODE_ENV: "production",
  PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true",
  PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true",
};

beforeEach(() => {
  for (const [key, value] of Object.entries(RELEASE_ENVIRONMENT)) vi.stubEnv(key, value);
  vi.clearAllMocks();
  createClient.mockResolvedValue({ auth: { getClaims: async () => ({ data: { claims: null } }) } });
});

afterEach(() => vi.unstubAllEnvs());

describe("bank route fail-closed behaviour", () => {
  it("404s a gated bank whose sealed runtime is not promoted, instead of rendering an error boundary", async () => {
    loadBankQuestions.mockRejectedValue(new Error("IGCSE runtime is not backed by verified storage, candidate, runtime, taxonomy, and question-state seals"));

    await expect(BankPage({
      params: Promise.resolve({ slug: "igcse-coordinated-sciences-0654" }),
    })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(loadBankQuestions).toHaveBeenCalledWith("igcse-coordinated-sciences-0654");
    expect(notFound).toHaveBeenCalled();
  });

  it("404s an unknown slug before loading any corpus", async () => {
    await expect(BankPage({
      params: Promise.resolve({ slug: "not-a-bank" }),
    })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(loadBankQuestions).not.toHaveBeenCalled();
  });
});
