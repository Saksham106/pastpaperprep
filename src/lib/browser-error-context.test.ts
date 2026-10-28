import { afterEach, describe, expect, it, vi } from "vitest";
import { browserErrorContext, reactMismatchKind } from "./browser-error-context";

function resetDocument() {
  const html = document.documentElement;
  for (const name of html.getAttributeNames()) html.removeAttribute(name);
  for (const name of document.body.getAttributeNames()) document.body.removeAttribute(name);
  document.body.innerHTML = "";
  html.lang = "en";
}

describe("browser error context: page", () => {
  afterEach(resetDocument);

  it("reports a clean page, ignoring the attributes and elements our own code adds", () => {
    resetDocument();
    const html = document.documentElement;
    html.className = "geist mono young-serif";
    html.dataset.theme = "dark";
    html.dataset.session = "1";
    html.style.colorScheme = "dark";
    document.body.dataset.buildRevision = "abc123";
    document.body.style.overflow = "hidden";
    document.body.innerHTML = "<main><p>Question 1</p></main><next-route-announcer></next-route-announcer>";
    expect(browserErrorContext(document, window)).toMatchObject({ page_translated: false, page_lang: "en", foreign_elements: 0, foreign_root_attributes: 0 });
  });

  it("flags a page Chrome or Edge translated", () => {
    resetDocument();
    document.documentElement.classList.add("translated-ltr");
    document.documentElement.lang = "es";
    expect(browserErrorContext(document, window)).toMatchObject({ page_translated: true, page_lang: "es" });
  });

  it("flags a page whose language was changed even without the translate class", () => {
    resetDocument();
    document.documentElement.lang = "zh-CN";
    expect(browserErrorContext(document, window)).toMatchObject({ page_translated: true, page_lang: "zh" });
  });

  it("counts extension elements and root attributes without naming them", () => {
    resetDocument();
    document.documentElement.setAttribute("data-darkreader-mode", "dynamic");
    document.body.setAttribute("data-gr-ext-installed", "");
    document.body.setAttribute("cz-shortcut-listen", "true");
    document.body.innerHTML = "<main>x</main><grammarly-desktop-integration></grammarly-desktop-integration>";
    const context = browserErrorContext(document, window);
    expect(context).toMatchObject({ foreign_elements: 1, foreign_root_attributes: 3 });
    expect(JSON.stringify(context)).not.toMatch(/grammarly|darkreader|gr-ext|cz-shortcut/);
  });

  it("keeps only a short language code and caps counts", () => {
    resetDocument();
    document.documentElement.lang = "Alice Smith";
    document.body.innerHTML = Array.from({ length: 80 }, (_, i) => `<ext-node-${i}></ext-node-${i}>`).join("");
    expect(browserErrorContext(document, window)).toMatchObject({ page_lang: "other", page_translated: true, foreign_elements: 50 });
    document.documentElement.removeAttribute("lang");
    expect(browserErrorContext(document, window)).toMatchObject({ page_lang: "none", page_translated: false });
  });
});

describe("browser error context: environment", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("adds page age, visibility, connection and release as fixed values", () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_REVISION", "99e8cb22e0de1d7b4154fef0252fa881802db971");
    vi.spyOn(performance, "now").mockReturnValue(12_600);
    const fakeWindow = { navigator: { onLine: false, connection: { effectiveType: "3g", saveData: true } }, performance } as unknown as Window;
    expect(browserErrorContext(document, fakeWindow)).toMatchObject({
      page_age_s: 13, visibility: "visible", ready_state: "complete", online: false, connection: "3g", save_data: true, release: "99e8cb22e0de",
    });
  });

  it("drops values outside the known vocabulary", () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_REVISION", "my-branch/alice");
    vi.spyOn(performance, "now").mockReturnValue(1e12);
    const fakeWindow = { navigator: { onLine: true, connection: { effectiveType: "<script>", saveData: "yes" } }, performance } as unknown as Window;
    const context = browserErrorContext(document, fakeWindow);
    expect(context.page_age_s).toBe(86_400);
    expect(context).not.toHaveProperty("connection");
    expect(context).not.toHaveProperty("save_data");
    expect(context).not.toHaveProperty("release");
  });
});

describe("React hydration mismatch kind", () => {
  it("reads only the fixed text/HTML argument of error #418", () => {
    expect(reactMismatchKind("Minified React error #418; visit https://react.dev/errors/418?args[]=text&args[]= for the full message")).toBe("text");
    expect(reactMismatchKind("Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]=Alice")).toBe("html");
    expect(reactMismatchKind("Minified React error #418; visit https://react.dev/errors/418?args%5B%5D=text")).toBe("text");
    expect(reactMismatchKind("Minified React error #418; visit https://react.dev/errors/418?args[]=Alice")).toBeUndefined();
    expect(reactMismatchKind("Minified React error #423; visit https://react.dev/errors/423?args[]=text")).toBeUndefined();
    expect(reactMismatchKind("Cannot read properties of undefined")).toBeUndefined();
  });
});
