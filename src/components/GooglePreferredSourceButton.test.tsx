import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GooglePreferredSourceButton, PREFERRED_SOURCE_SCRIPT } from "./GooglePreferredSourceButton";

type Scope = { PREFERRED_SOURCE?: Array<(api: { init: (options: unknown) => void }) => void> };
const scope = window as unknown as Scope;
let reveal: () => void;

describe("Google preferred source button", () => {
  beforeEach(() => {
    delete scope.PREFERRED_SOURCE;
    document.head.querySelectorAll("script").forEach((script) => script.remove());
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) { reveal = () => callback([{ isIntersecting: true }]); }
      observe() {}
      disconnect() {}
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("loads nothing from Google until the button is near the viewport", () => {
    render(<GooglePreferredSourceButton />);
    expect(document.querySelector(`script[src="${PREFERRED_SOURCE_SCRIPT}"]`)).toBeNull();
    expect(scope.PREFERRED_SOURCE).toBeUndefined();
  });

  it("then loads Google's script once, in manual mode, and asks it to render", () => {
    document.documentElement.dataset.theme = "dark";
    const { container } = render(<GooglePreferredSourceButton />);
    reveal();
    reveal();
    const scripts = document.querySelectorAll(`script[src="${PREFERRED_SOURCE_SCRIPT}"]`);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toHaveAttribute("preferred-sources-control", "manual");
    const init = vi.fn();
    scope.PREFERRED_SOURCE![0]({ init });
    expect(init).toHaveBeenCalledWith({ lang: "en", theme: "dark" });
    expect(container.querySelector("[google-add-preferred-source-btn]")).toBeInTheDocument();
  });
});
