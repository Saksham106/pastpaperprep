import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getClaims } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/components/ExamStylePracticeSets", () => ({
  ExamStylePracticeSets: () => <div data-testid="practice-workspace">Practice workspace</div>,
}));

import TrigonometryExamStylePage from "./page";

async function markup() {
  return renderToStaticMarkup(await TrigonometryExamStylePage());
}

describe("Trigonometry exam-style page account gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: {} } });
    createClient.mockResolvedValue({ auth: { getClaims } });
  });

  it("shows a sign-in gate instead of the PDF workspace to anonymous visitors", async () => {
    const html = await markup();

    expect(html).toContain("Sign in to view this practice");
    expect(html).toContain(`/login?next=${encodeURIComponent("/banks/ib-sl/exam-style/trigonometry")}`);
    expect(html).not.toContain("Practice workspace");
  });

  it("shows the PDF workspace to authenticated users", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-id" } } });

    const html = await markup();

    expect(html).toContain("Practice workspace");
    expect(html).not.toContain("Sign in to view this practice");
  });
});
