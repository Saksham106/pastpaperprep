import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getClaims, from, savedUpsert, attemptUpsert, deleteEq } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
  from: vi.fn(),
  savedUpsert: vi.fn(),
  attemptUpsert: vi.fn(),
  deleteEq: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { POST } from "@/app/api/study-state/route";

const request = (body: unknown) => new Request("https://pastpaperprep.com/api/study-state", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("POST /api/study-state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-id" } } });
    savedUpsert.mockResolvedValue({ error: null });
    attemptUpsert.mockResolvedValue({ error: null });
    deleteEq.mockResolvedValue({ error: null });
    from.mockImplementation((table: string) => {
      if (table === "saved_questions") {
        const deletion = { eq: vi.fn(() => deletion) };
        deletion.eq.mockImplementationOnce(() => deletion).mockImplementationOnce(() => deletion).mockImplementationOnce(deleteEq);
        return { upsert: savedUpsert, delete: vi.fn(() => deletion) };
      }
      if (table === "attempts") return { upsert: attemptUpsert };
      throw new Error(`Unexpected table ${table}`);
    });
    createClient.mockResolvedValue({ auth: { getClaims }, from });
  });

  it("rejects unauthenticated and non-canonical question mutations", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: {} } });
    const unauthenticated = await POST(request({ bank: "ib-sl", questionId: "m26-math-aasl-p1-tza-q1", action: "save" }));
    const invalid = await POST(request({ bank: "ib-sl", questionId: "made-up", action: "save" }));

    expect(unauthenticated.status).toBe(401);
    expect(invalid.status).toBe(400);
    expect(savedUpsert).not.toHaveBeenCalled();
  });

  it("saves a trusted question for the authenticated user", async () => {
    const response = await POST(request({ bank: "ib-sl", questionId: "m26-math-aasl-p1-tza-q1", action: "save" }));

    expect(response.status).toBe(200);
    expect(savedUpsert).toHaveBeenCalledWith({
      user_id: "user-id",
      bank_slug: "ib-sl",
      question_id: "m26-math-aasl-p1-tza-q1",
    }, { onConflict: "user_id,bank_slug,question_id", ignoreDuplicates: true });
    await expect(response.json()).resolves.toEqual({ saved: true, attempted: false });
  });

  it("records at most one lightweight attempt per question", async () => {
    const response = await POST(request({ bank: "ib-sl", questionId: "m26-math-aasl-p1-tza-q1", action: "attempt" }));

    expect(response.status).toBe(200);
    expect(attemptUpsert).toHaveBeenCalledWith({
      user_id: "user-id",
      bank_slug: "ib-sl",
      question_id: "m26-math-aasl-p1-tza-q1",
    }, { onConflict: "user_id,bank_slug,question_id", ignoreDuplicates: true });
    await expect(response.json()).resolves.toEqual({ saved: false, attempted: true });
  });
});
