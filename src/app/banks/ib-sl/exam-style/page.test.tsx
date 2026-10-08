import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { renderAASLPage } = vi.hoisted(() => ({ renderAASLPage: vi.fn() }));
vi.mock("@/components/ExamStyleAASLPage", () => ({ ExamStyleAASLPage: renderAASLPage }));

import Page from "./page";

describe("IB Mathematics AA SL exam-style hub", () => {
  it("opens the shared authenticated PDF workspace directly without topic-route navigation", () => {
    renderAASLPage.mockReturnValue(<section aria-label="PDF workspace">Initial PDF and worksheet selector</section>);

    const html = renderToStaticMarkup(Page());

    expect(renderAASLPage).toHaveBeenCalledOnce();
    expect(html).toContain("Initial PDF and worksheet selector");
    expect(html).not.toContain("/banks/ib-sl/exam-style/trigonometry");
    expect(html).not.toContain("/banks/ib-sl/exam-style/probability-distributions");
  });
});
