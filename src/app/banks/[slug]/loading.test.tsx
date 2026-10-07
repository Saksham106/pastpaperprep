import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Loading from "./loading";

describe("bank route loading feedback", () => {
  it("shows a bank-shaped, accessible loading state while the destination resolves", () => {
    const markup = renderToStaticMarkup(<Loading />);
    expect(markup).toContain('aria-label="Loading question bank"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("bank-loading-shell");
    expect(markup).toContain("Loading questions");
    expect(markup).not.toContain("Loading page");
  });
});
