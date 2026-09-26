import { readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const css = postcss.parse(readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8"));

function declaration(selector: string, property: string, inMedia = false) {
  let value: string | undefined;
  css.walkRules(selector, (rule) => {
    if (Boolean(rule.parent?.type === "atrule") !== inMedia) return;
    rule.walkDecls(property, (decl) => { value = decl.value; });
  });
  return value;
}

describe("account canvas and theme surfaces", () => {
  it("keeps the desktop sidebar inset from the viewport", () => {
    expect(declaration(".account-settings-layout", "width")).toContain("100% - 80px");
  });

  it("uses a legible dark header rather than the light-only hero glaze", () => {
    expect(declaration(':root[data-theme="dark"]', "--paper-warm")).toBeTruthy();
    expect(declaration(':root[data-theme="dark"]', "--header-overlay")).toBeTruthy();
    expect(declaration(".site-header", "background")).toContain("var(--header-overlay)");
  });

  it("keeps public headings, plan actions, and active tabs readable in both themes", () => {
    expect(declaration(':root[data-theme="dark"] .public-editorial', "--public-ink")).toBe("var(--ink)");
    expect(declaration(':root[data-theme="dark"] .pricing-option', "--plan-action")).toBeTruthy();
    expect(declaration('.qualification-tabs-prominent [role="tab"][aria-selected="true"]', "color")).toBe("var(--paper)");
    expect(declaration(':root[data-theme="dark"] .complimentary-plan-included', "color")).toBe("var(--ink-soft)");
  });
});
