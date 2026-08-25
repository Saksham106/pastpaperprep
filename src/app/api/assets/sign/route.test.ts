import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST } from "@/app/api/assets/sign/route";

describe("POST /api/assets/sign", () => {
  it("rejects invalid JSON before touching authentication", async () => {
    const response = await POST(new Request("https://pastpaperprep.com/api/assets/sign", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON" });
  });

  it("rejects JSON null instead of throwing", async () => {
    const response = await POST(new Request("https://pastpaperprep.com/api/assets/sign", {
      method: "POST",
      body: "null",
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid asset request" });
  });

  it("rejects unknown banks and malformed batches", async () => {
    const unknownBank = await POST(new Request("https://pastpaperprep.com/api/assets/sign", {
      method: "POST",
      body: JSON.stringify({ bank: "other", requests: [] }),
      headers: { "content-type": "application/json" },
    }));
    const malformedBatch = await POST(new Request("https://pastpaperprep.com/api/assets/sign", {
      method: "POST",
      body: JSON.stringify({ bank: "ib-sl", requests: "all" }),
      headers: { "content-type": "application/json" },
    }));

    expect(unknownBank.status).toBe(400);
    expect(malformedBatch.status).toBe(400);
  });
});
