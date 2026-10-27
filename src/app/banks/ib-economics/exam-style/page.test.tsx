import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getClaims, renderLibrary } = vi.hoisted(() => ({ createClient: vi.fn(), getClaims: vi.fn(), renderLibrary: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/components/ExamStyleWorksheetLibrary", () => ({ ExamStyleWorksheetLibrary: renderLibrary }));

import Page, { metadata } from "./page";
import { EXAM_STYLE_COURSES } from "@/lib/exam-style-worksheets";

describe("IB Economics exam-style collection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({ auth: { getClaims } });
    getClaims.mockResolvedValue({ data: { claims: {} } });
    renderLibrary.mockReturnValue(<section>PDF workspace</section>);
  });

  it("returns anonymous students to the subject-wide collection after sign-in", async () => {
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain(`/login?next=${encodeURIComponent("/banks/ib-economics/exam-style")}`);
    expect(html).toContain("SL and HL");
    expect(html).toContain("HL-only");
    expect(html).toContain("Revision notes, topic slides and activities, and exam-style/data-response practice");
    expect(html).not.toContain("worked solutions");
    expect(html).toContain("Not every booklet includes answers");
    expect(html).not.toContain("PDF workspace");
    expect(renderLibrary).not.toHaveBeenCalled();
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("opens the existing PDF workspace without an intermediate topic landing page", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "student-id" } } });
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("PDF workspace");
    expect(renderLibrary.mock.calls[0][0].worksheets).toBe(EXAM_STYLE_COURSES["ib-economics"].worksheets);
    expect(html).not.toContain("/banks/ib-economics-hl");
    expect(html).not.toContain("/banks/ib-economics-sl");
    expect(html).toContain("Back to IB Diploma");
  });
});
