// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ capture: vi.fn(), manifest: vi.fn(), sign: vi.fn(), entitlements: vi.fn(), rpc: vi.fn(), details: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server-error-tracking", () => ({ captureServerException: mocks.capture }));
vi.mock("@/lib/asset-manifest", () => ({ loadBankAssetManifest: mocks.manifest, authorizeManifestAssetRequests: () => [{ questionId: "paid", kind: "question", paths: ["paid.webp"], details: {} }] }));
vi.mock("@/lib/access", () => ({ isPreviewQuestion: (_bank: string, id: string) => id === "free", hasBankAccess: () => true }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements: mocks.entitlements }));
vi.mock("@/lib/private-assets", () => ({ signPrivateAssetUrls: mocks.sign, previewAssetSignOptions: () => ({ provider: "r2" }), premiumAssetSignOptions: () => ({ provider: "r2" }), resolvedAssetSignProvider: (options: { provider: string }) => options.provider }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims: { sub: "private-user" } } }) }, rpc: mocks.rpc }) }));
vi.mock("@/lib/question-delivery", () => ({ richDetailsFor: mocks.details }));
vi.mock("@/lib/reviewed-blank-tails", () => ({ reviewedBlankTailForSignedAsset: () => null }));
import { GET } from "./free/route";
import { POST } from "./sign/route";
const free = () => GET(new NextRequest("https://app.test/api/assets/free?bank=ib-sl&id=free&kind=question&token=secret", { headers: { cookie: "secret" } }));
const paid = () => POST(new Request("https://app.test/api/assets/sign?token=secret", { method: "POST", body: JSON.stringify({ bank: "ib-sl", requests: [], stage: "secret", storage_provider: "secret" }) }));
describe("asset failure diagnostics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.manifest.mockResolvedValue(new Map([["free", { questionAssetPaths: ["free.webp"], markschemeAssetPaths: [], details: {} }]]));
    mocks.sign.mockResolvedValue(new Map());
    mocks.entitlements.mockResolvedValue({ rows: [], error: null });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.details.mockReturnValue({});
  });
  it.each([
    ["free manifest", free, "manifest", "local", "manifest_unavailable"],
    ["free signing", free, "signing", "r2", "signing_failed"],
    ["paid entitlement", paid, "entitlement", "supabase", "entitlement_unavailable"],
    ["paid manifest", paid, "manifest", "local", "manifest_unavailable"],
    ["paid signing", paid, "signing", "r2", "signing_failed"],
    ["paid quota", paid, "quota", "supabase", "quota_unavailable"],
    ["paid quota throw", paid, "quota", "supabase", "quota_unavailable"],
    ["paid response", paid, "response", "unknown", "response_failed"],
  ] as const)("distinguishes %s without leaking inputs or altering the response", async (branch, invoke, stage, provider, code) => {
    const secret = new Error("alice@example.com token=secret");
    if (stage === "manifest") mocks.manifest.mockRejectedValue(secret);
    if (stage === "signing") mocks.sign.mockRejectedValue(secret);
    if (stage === "entitlement") mocks.entitlements.mockResolvedValue({ rows: [], error: secret });
    if (stage === "quota") {
      if (branch.endsWith("throw")) mocks.rpc.mockRejectedValue(secret);
      else mocks.rpc.mockResolvedValue({ data: null, error: secret });
    }
    if (stage === "response") mocks.details.mockImplementation(() => { throw secret; });
    const response = await invoke();
    expect(response.status).toBe(503);
    expect(mocks.capture).toHaveBeenCalledTimes(1);
    expect(mocks.capture.mock.calls[0][1]).toMatchObject({ bank: "ib-sl", stage, storage_provider: provider, error_code: code, http_status: "503" });
    expect(JSON.stringify(mocks.capture.mock.calls)).not.toMatch(/alice|secret|private-user/);
    expect([...response.headers.keys()].some((key) => /correlation|stage|provider/.test(key))).toBe(false);
    expect(await response.json()).not.toHaveProperty("stage");
    if (stage === "manifest" || stage === "signing" || stage === "entitlement") expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
