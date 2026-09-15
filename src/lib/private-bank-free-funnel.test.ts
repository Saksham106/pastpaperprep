import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getClaims, from, rpc, createAdminClient, createSignedUrls } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  createAdminClient: vi.fn(),
  createSignedUrls: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { GET as privateBankIndexGET } from "@/app/api/private-bank-index/[bank]/route";
import { POST as assetsSignPOST } from "@/app/api/assets/sign/route";
import { POST as pdfSignPOST } from "@/app/api/pdf/sign/route";
import { bankEntryHref, countFreeQuestions, hasFreeTier, isPreviewQuestion, questionYear } from "@/lib/access";
import { getAvailableBanks, isPrivateBankIndexEnabled } from "@/lib/banks";
import { createPublicBankIndex, publicBankIndexUrl } from "@/lib/question-index";
import { loadBankQuestions } from "@/lib/question-loader";
import coordinatedRuntime from "@/data/production/igcse-coordinated-sciences-0654.json";

type RawRuntime = { questions: Array<{ id: string; year: number; firstQuestion?: string }> };

const RELEASE_ENVIRONMENT: Record<string, string> = {
  NODE_ENV: "production",
  PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true",
  PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true",
  PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION: "true",
  PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED: "true",
};

/** Frozen free-tier census for the private release banks: one documented older exam year each. */
const PRIVATE_FREE = {
  "igcse-biology-0610": { total: 3441, free: 685 },
  "igcse-economics-0455": { total: 1189, free: 229 },
  "igcse-chemistry-0620": { total: 3529, free: 709 },
  "igcse-physics-0625": { total: 3820, free: 766 },
  "ib-economics-hl": { total: 111, free: 26 },
  "ib-economics-sl": { total: 89, free: 20 },
} as const;

const COORDINATED = { total: 4030, free: 799 };

const PROTECTED_INDEX_KEYS = [
  "summary", "accessibleText", "solution", "sourceQuestionUrl", "sourceMarkSchemeUrl",
  "questionImages", "markschemeImages", "questionAssetPaths", "markschemeAssetPaths",
  "officialMarkscheme", "answer", "classificationProvenance", "searchText", "bankSlug",
];

function jsonRequest(body: unknown): Request {
  return new Request("https://pastpaperprep.com/api", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

async function readAssets(response: Response) {
  return await response.json() as { assets: Array<{ questionId: string; urls: Array<string | undefined> }> };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries(RELEASE_ENVIRONMENT)) vi.stubEnv(key, value);
  getClaims.mockResolvedValue({ data: { claims: null } });
  createClient.mockResolvedValue({ auth: { getClaims }, from, rpc });
  rpc.mockResolvedValue({ data: true, error: null });
  createSignedUrls.mockImplementation(async (paths: string[]) => ({
    data: paths.map((path) => ({ path, signedUrl: `https://assets.example/${path}` })),
    error: null,
  }));
  createAdminClient.mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrls })) } });
});

afterEach(() => vi.unstubAllEnvs());

describe("private-bank free funnel", () => {
  it("advertises a free tier for every displayed bank and links each one to ?free=1", () => {
    const displayed = getAvailableBanks();
    expect(displayed.length).toBeGreaterThan(0);
    for (const bank of displayed) {
      expect(hasFreeTier(bank.slug)).toBe(true);
      expect(bankEntryHref(bank.slug)).toBe(`/banks/${bank.slug}?free=1`);
    }
    for (const slug of Object.keys(PRIVATE_FREE)) expect(displayed.map((bank) => bank.slug)).toContain(slug);
    expect(displayed.map((bank) => bank.slug)).toContain("igcse-coordinated-sciences-0654");
  });

  it("resolves the IGCSE free year with a syllabus-prefix-aware parse", () => {
    expect(questionYear("0625-2021-s-11-q1")).toBe(2021);
    expect(questionYear("0654-2021-summer-11-q1")).toBe(2021);
    expect(questionYear("0580-2016-march-22-q1")).toBe(2016);
    expect(questionYear("2021-may-none-hl-p2-q01")).toBe(2021);
    expect(questionYear("not-a-question")).toBeNull();
  });

  it.each(Object.entries(PRIVATE_FREE))("gives %s a non-empty free subset and no more", async (slug, expected) => {
    const questions = await loadBankQuestions(slug as never);
    expect(questions).toHaveLength(expected.total);
    expect(countFreeQuestions(slug as never, questions)).toBe(expected.free);
    const free = questions.filter((question) => isPreviewQuestion(slug as never, question.id));
    expect(free.every((question) => question.year === 2021)).toBe(true);
    expect(free.length).toBe(questions.filter((question) => question.year === 2021).length);
    expect(free.length).toBeGreaterThan(0);
  });

  it("gives the Co-ordinated Sciences candidate the same bounded free year without loading an unfinalized runtime", () => {
    const questions = (coordinatedRuntime as unknown as RawRuntime).questions;
    expect(questions).toHaveLength(COORDINATED.total);
    expect(countFreeQuestions("igcse-coordinated-sciences-0654", questions)).toBe(COORDINATED.free);
  });

  it("serves the anonymous metadata index in full, never a 24-question page", async () => {
    const response = await privateBankIndexGET(new Request("https://pastpaperprep.com/api/private-bank-index/igcse-physics-0625"), {
      params: Promise.resolve({ bank: "igcse-physics-0625" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    const payload = await response.json() as { version: number; bank: string; questions: Array<Record<string, unknown>> };
    expect(payload.version).toBe(1);
    expect(payload.bank).toBe("igcse-physics-0625");
    expect(payload.questions).toHaveLength(PRIVATE_FREE["igcse-physics-0625"].total);
    expect(payload.questions.length).toBeGreaterThan(24);
  });

  it("leaks no signed or private content through the anonymous index", async () => {
    for (const slug of ["igcse-physics-0625", "ib-economics-hl"]) {
      const response = await privateBankIndexGET(new Request(`https://pastpaperprep.com/api/private-bank-index/${slug}`), {
        params: Promise.resolve({ bank: slug }),
      });
      expect(response.status).toBe(200);
      const serialized = JSON.stringify(await response.json());
      for (const key of PROTECTED_INDEX_KEYS) expect(serialized).not.toContain(`"${key}"`);
      expect(serialized).not.toContain("https://");
      expect(serialized).not.toContain(".webp");
    }
  });

  it("projects the Co-ordinated Sciences candidate index without leaking any protected field", () => {
    const index = createPublicBankIndex("igcse-coordinated-sciences-0654", (coordinatedRuntime as unknown as { questions: never[] }).questions);
    const serialized = JSON.stringify(index);
    expect(index.questions).toHaveLength(COORDINATED.total);
    for (const key of PROTECTED_INDEX_KEYS) expect(serialized).not.toContain(`"${key}"`);
    expect(serialized).not.toContain(".webp");
  });

  it("404s the private index for a bank whose release gate is off and only serves private banks", async () => {
    vi.stubEnv("PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS", "false");
    const gated = await privateBankIndexGET(new Request("https://pastpaperprep.com/api/private-bank-index/igcse-physics-0625"), {
      params: Promise.resolve({ bank: "igcse-physics-0625" }),
    });
    expect(gated.status).toBe(404);
    vi.stubEnv("PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS", "true");
    const publicBank = await privateBankIndexGET(new Request("https://pastpaperprep.com/api/private-bank-index/igcse"), {
      params: Promise.resolve({ bank: "igcse" }),
    });
    expect(publicBank.status).toBe(404);
    expect(isPrivateBankIndexEnabled("igcse")).toBe(false);
    expect(isPrivateBankIndexEnabled("igcse-physics-0625")).toBe(true);
    expect(publicBankIndexUrl("igcse")).toMatch(/^\/bank-index\//);
  });

  it("signs a preview question's asset from the private bank's R2 provider, not Supabase", async () => {
    vi.stubEnv("R2_ACCOUNT_ID", "92278648535014b5231edfe207b9391d");
    vi.stubEnv("R2_ACCESS_KEY_ID", "a".repeat(32));
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "b".repeat(64));
    vi.stubEnv("R2_BUCKET_NAME", "pastpaperprep-assets");

    const response = await assetsSignPOST(jsonRequest({
      bank: "igcse-physics-0625",
      requests: [{ questionId: "0625-2021-s-11-q1", kind: "question" }],
    }));

    expect(response.status).toBe(200);
    expect(createSignedUrls).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    const payload = await readAssets(response);
    expect(payload.assets).toHaveLength(1);
    expect(payload.assets[0].urls.length).toBeGreaterThan(0);
    expect(new URL(payload.assets[0].urls[0] as string).hostname).toBe("92278648535014b5231edfe207b9391d.r2.cloudflarestorage.com");
  });

  it("denies non-preview assets, non-preview answers, the wrong bank, and private PDF for an anonymous visitor", async () => {
    vi.stubEnv("ASSET_STORAGE_PROVIDER", "r2");
    vi.stubEnv("R2_ACCOUNT_ID", "92278648535014b5231edfe207b9391d");
    vi.stubEnv("R2_ACCESS_KEY_ID", "a".repeat(32));
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "b".repeat(64));
    vi.stubEnv("R2_BUCKET_NAME", "pastpaperprep-assets");

    const nonPreviewAsset = await assetsSignPOST(jsonRequest({
      bank: "igcse-physics-0625",
      requests: [{ questionId: "0625-2025-m-12-q1", kind: "question" }],
    }));
    expect(nonPreviewAsset.status).toBe(403);

    const nonPreviewAnswer = await assetsSignPOST(jsonRequest({
      bank: "igcse-physics-0625",
      requests: [{ questionId: "0625-2025-m-12-q1", kind: "answer" }],
    }));
    expect(nonPreviewAnswer.status).toBe(403);

    const wrongBank = await assetsSignPOST(jsonRequest({
      bank: "igcse-chemistry-0620",
      requests: [{ questionId: "0625-2021-s-11-q1", kind: "question" }],
    }));
    expect(wrongBank.status).toBe(400);

    const pdf = await pdfSignPOST(jsonRequest({
      bank: "igcse-physics-0625",
      questionIds: ["0625-2021-s-11-q1"],
      content: "both",
    }));
    expect(pdf.status).toBe(401);
  });

  it("honours the documented preview contract: a preview question's answer is allowed, a premium one is not", async () => {
    vi.stubEnv("ASSET_STORAGE_PROVIDER", "r2");
    vi.stubEnv("R2_ACCOUNT_ID", "92278648535014b5231edfe207b9391d");
    vi.stubEnv("R2_ACCESS_KEY_ID", "a".repeat(32));
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "b".repeat(64));
    vi.stubEnv("R2_BUCKET_NAME", "pastpaperprep-assets");

    const previewAnswer = await assetsSignPOST(jsonRequest({
      bank: "igcse-physics-0625",
      requests: [{ questionId: "0625-2021-s-11-q1", kind: "answer" }],
    }));
    expect(previewAnswer.status).toBe(200);
  });
});
