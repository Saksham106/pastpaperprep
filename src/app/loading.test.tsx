import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Loading from "@/app/loading";

describe("route loading shell", () => {
  it("reserves the page shape with accessible skeleton feedback", () => {
    const markup = renderToStaticMarkup(<Loading />);
    expect(markup).toContain("Loading page");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("page-skeleton");
    expect(markup).toContain("skeleton-card");
    expect(markup).not.toContain("<main");
  });
});