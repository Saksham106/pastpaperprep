import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("home page corpus summary", () => {
  it("derives the six-bank corpus totals from the bank catalog", () => {
    const markup = renderToStaticMarkup(<Home />);

    expect(markup).toContain("6,479");
    expect(markup).toContain("544");
    expect(markup).toContain(">6</strong><span>focused question banks");
    expect(markup).toContain("Six serious question banks");
    expect(markup).toContain("IGCSE Additional Math 0606");
  });
});