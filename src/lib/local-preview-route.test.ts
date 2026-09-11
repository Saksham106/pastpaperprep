import { describe, expect, it, afterAll } from "vitest";
import { POST as signLocalAssets } from "@/app/api/local-preview-assets/sign/route";
import { POST as signLocalPdf } from "@/app/api/local-preview-assets/pdf/route";
import { GET as getLocalAsset } from "@/app/api/local-preview-assets/[...path]/route";
import { loadBankQuestions } from "@/lib/question-loader";

const SOURCE_ROOT = "/Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice";
const env = { ...process.env };
afterAll(() => { process.env = { ...env }; });

describe("local Economics preview routes", () => {
  it("deny asset signing when the explicit local preview gate is absent", async () => {
    process.env = { ...env, NODE_ENV: "development", PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW: "false" };
    const response = await signLocalAssets(new Request("http://localhost/api/local-preview-assets/sign", {
      method: "POST",
      body: JSON.stringify({ bank: "ib-economics-hl", requests: [{ questionId: "2025-may-tz1-hl-p1-q01", kind: "question" }] }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(404);
  });

  it("returns all question and official-mark-scheme image URLs through the dev-only path", async () => {
    process.env = { ...env, NODE_ENV: "development", PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW: "true", PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT: SOURCE_ROOT };
    const response = await signLocalAssets(new Request("http://localhost/api/local-preview-assets/sign", {
      method: "POST",
      body: JSON.stringify({ bank: "ib-economics-hl", requests: [
        { questionId: "2025-may-tz1-hl-p1-q01", kind: "question" },
        { questionId: "2025-may-tz1-hl-p1-q01", kind: "answer" },
      ] }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.assets).toHaveLength(2);
    expect(payload.assets[0].urls.every((url: string) => url.startsWith("/api/local-preview-assets/"))).toBe(true);
    expect(payload.assets[1].urls).toHaveLength(3);
    expect(payload.assets[1].urls.every((url: string) => url.includes("markschemes"))).toBe(true);
  });

  it("keeps PDF selection bounded while preserving every image for shared stimuli", async () => {
    process.env = { ...env, NODE_ENV: "development", PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW: "true", PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT: SOURCE_ROOT };
    const response = await signLocalPdf(new Request("http://localhost/api/local-preview-assets/pdf", {
      method: "POST",
      body: JSON.stringify({ bank: "ib-economics-hl", questionIds: ["2025-may-tz1-hl-p1-q01"], content: "both" }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.assets[0].urls.length).toBeGreaterThan(0);
    expect(payload.assets[1].urls.length).toBeGreaterThan(0);
  });

  it("serves a mounted question image only through the private resolver", async () => {
    process.env = { ...env, NODE_ENV: "development", PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW: "true", PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT: SOURCE_ROOT };
    const question = (await loadBankQuestions("ib-economics-hl")).find((item) => item.id === "2025-may-tz1-hl-p1-q01")!;
    const assetPath = question.questionImages[0].replace("/api/local-preview-assets/", "").split("/");
    const response = await getLocalAsset(new Request("http://localhost/api/local-preview-assets/" + assetPath.join("/")), {
      params: Promise.resolve({ path: assetPath }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("rejects traversal before reading outside the mounted asset root", async () => {
    process.env = { ...env, NODE_ENV: "development", PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW: "true", PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT: SOURCE_ROOT };
    const response = await getLocalAsset(new Request("http://localhost/api/local-preview-assets/ib-economics-hl/questions/../secret.webp"), {
      params: Promise.resolve({ path: ["ib-economics-hl", "questions", "..", "secret.webp"] }),
    });
    expect(response.status).toBe(404);
  });

  it("does not let spoofed forwarded headers change the development gate", async () => {
    process.env = { ...env, NODE_ENV: "development", PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW: "true", PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT: SOURCE_ROOT };
    const question = (await loadBankQuestions("ib-economics-hl")).find((item) => item.id === "2025-may-tz1-hl-p1-q01")!;
    const assetPath = question.questionImages[0].replace("/api/local-preview-assets/", "").split("/");
    const response = await getLocalAsset(new Request("http://evil.example/api/local-preview-assets/" + assetPath.join("/"), {
      headers: { host: "evil.example", "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" },
    }), {
      params: Promise.resolve({ path: assetPath }),
    });
    expect(response.status).toBe(200);
  });
});
