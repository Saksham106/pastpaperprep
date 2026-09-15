import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Style contracts for the local UX polish review.
 *
 * Several of the requested changes are pure-CSS behaviour (a transparent tab tray, a
 * flattened dashboard panel, a two-row mobile toolbar). jsdom cannot compute those, so
 * these tests read the real stylesheets and assert on the cascade winner for each
 * selector. They are the regression guard that stops the tray (or the card-inside-card)
 * from quietly coming back; the visual result itself is verified in a real browser.
 */

type Declaration = Record<string, string>;
type StyleBlock = { selector: string; declarations: Declaration; media: string | null; order: number };

function walk(source: string, media: string | null, blocks: StyleBlock[], order: { value: number }) {
  let index = 0;
  while (index < source.length) {
    const open = source.indexOf("{", index);
    if (open === -1) return;
    const prelude = source.slice(index, open).trim();
    let depth = 1;
    let cursor = open + 1;
    while (cursor < source.length && depth > 0) {
      if (source[cursor] === "{") depth += 1;
      else if (source[cursor] === "}") depth -= 1;
      cursor += 1;
    }
    const body = source.slice(open + 1, cursor - 1);
    if (prelude.startsWith("@")) {
      walk(body, prelude, blocks, order);
    } else if (prelude) {
      const declarations: Declaration = {};
      for (const chunk of body.split(";")) {
        const separator = chunk.indexOf(":");
        if (separator === -1) continue;
        const property = chunk.slice(0, separator).trim().toLowerCase();
        const value = chunk.slice(separator + 1).trim();
        if (property && value) declarations[property] = value;
      }
      blocks.push({ selector: prelude, declarations, media, order: order.value++ });
    }
    index = cursor;
  }
}

function parseStyleSheet(source: string): StyleBlock[] {
  const blocks: StyleBlock[] = [];
  walk(source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@import[^;]+;/g, ""), null, blocks, { value: 0 });
  return blocks.sort((left, right) => left.order - right.order);
}

const PROJECT_ROOT = process.cwd();
const globalBlocks = parseStyleSheet(readFileSync(path.join(PROJECT_ROOT, "src/app/globals.css"), "utf8"));
const homeBlocks = parseStyleSheet(readFileSync(path.join(PROJECT_ROOT, "src/components/MarketingHome.module.css"), "utf8"));

/** Cascade winner for a selector: "all" includes every media query, "base" only top level. */
function styleFor(blocks: StyleBlock[], selector: string, media: "all" | "base" | string = "all"): Declaration {
  const merged: Declaration = {};
  for (const block of blocks) {
    if (!block.selector.split(",").map((part) => part.trim()).includes(selector)) continue;
    if (media === "base" && block.media !== null) continue;
    if (media !== "all" && media !== "base" && !(block.media ?? "").includes(media)) continue;
    Object.assign(merged, block.declarations);
  }
  return merged;
}

function normalize(value?: string): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** True when a property paints nothing at all: absent, none, transparent, or a zero value. */
function paintsNothing(value?: string): boolean {
  if (value === undefined) return true;
  const normalized = normalize(value);
  return normalized === "none"
    || normalized === "transparent"
    || /^0(?:\s|$)/.test(normalized)
    || normalized === "rgba(0, 0, 0, 0)";
}

function paintsSomething(value?: string): boolean {
  return !paintsNothing(value);
}

/** Every border longhand that could draw a line. */
function borders(style: Declaration): string[] {
  return [
    style.border,
    style["border-top"],
    style["border-right"],
    style["border-bottom"],
    style["border-left"],
    style["border-width"],
    style["border-bottom-width"],
  ].filter((value) => value !== undefined);
}

function drawsNoEdge(style: Declaration): boolean {
  const edges = borders(style);
  if (edges.length === 0) return true;
  return edges.every((value) => paintsNothing(value) || /^(0|none|hidden)/.test(normalize(value)));
}

describe("qualification tabs carry no wide tray", () => {
  const tablist = styleFor(globalBlocks, '.qualification-tabs-prominent [role="tablist"]', "all");
  const tab = styleFor(globalBlocks, '.qualification-tabs-prominent [role="tab"]', "all");

  it("never paints a background, edge, shadow, or padding around the tab row", () => {
    expect(paintsNothing(tablist.background)).toBe(true);
    expect(paintsNothing(tablist["background-color"])).toBe(true);
    expect(drawsNoEdge(tablist)).toBe(true);
    expect(paintsNothing(tablist["box-shadow"])).toBe(true);
    expect(paintsNothing(tablist.padding)).toBe(true);
  });

  it("hugs its two buttons instead of stretching a shell-width surface", () => {
    expect(normalize(tablist.width)).toMatch(/^(fit-content|max-content)$/);
  });

  it("keeps each qualification as a clearly boxed button", () => {
    expect(paintsSomething(tab.background)).toBe(true);
    expect(drawsNoEdge(tab)).toBe(false);
    expect(normalize(tab["border-radius"])).not.toBe("");
    expect(paintsNothing(tab["border-radius"])).toBe(false);
    expect(Number.parseFloat(tab["min-height"] ?? "0")).toBeGreaterThanOrEqual(44);
  });

  it("keeps a selected state and a focus ring", () => {
    const selected = styleFor(globalBlocks, '.qualification-tabs-prominent [role="tab"][aria-selected="true"]', "all");
    const focus = styleFor(globalBlocks, '.qualification-tabs-prominent [role="tab"]:focus-visible', "all");
    expect(paintsSomething(selected.background)).toBe(true);
    expect(paintsSomething(focus.outline)).toBe(true);
  });
});

describe("landing bank tiles look and behave like links", () => {
  const card = styleFor(homeBlocks, ".bankCard", "all");
  const hover = styleFor(homeBlocks, ".bankCard:hover", "all");

  it("draws a real box around every bank so the hit area is visible", () => {
    expect(paintsSomething(card.background)).toBe(true);
    expect(drawsNoEdge(card)).toBe(false);
    expect(paintsSomething(card["border-radius"])).toBe(true);
  });

  it("responds to hover and keyboard focus with a state change", () => {
    expect(Object.keys(hover).length).toBeGreaterThan(0);
    expect(paintsSomething(hover["border-color"])).toBe(true);
  });

  it("gives the mathematics group room for two separate, full-width bank tiles", () => {
    const two = styleFor(homeBlocks, ".bankCards.bankCardsTwo", "all");
    expect(normalize(two["grid-template-columns"])).toMatch(/auto-fit|minmax\(2\d\dpx/);
  });
});

describe("dashboard study panels are flattened onto the landing subject tones", () => {
  const card = styleFor(globalBlocks, ".dashboard-bank-card", "all");
  const included = styleFor(globalBlocks, ".dashboard-bank-card.is-included", "all");
  const family = styleFor(globalBlocks, ".dashboard-bank-family[data-subject-tone]", "all");

  it("stops drawing a card inside the subject panel", () => {
    expect(paintsNothing(card.background)).toBe(true);
    expect(drawsNoEdge(card)).toBe(true);
    expect(paintsNothing(card["box-shadow"])).toBe(true);
    expect(paintsNothing(included.background)).toBe(true);
  });

  it("keeps a hover affordance on each full-tile bank link", () => {
    const hover = styleFor(globalBlocks, ".dashboard-bank-card:hover", "all");
    expect(paintsSomething(hover.background)).toBe(true);
  });

  it("paints the panel with the shared subject-tone token", () => {
    expect(normalize(family.background)).toContain("--subject-panel-tint");
    for (const tone of ["math", "chemistry", "physics", "biology", "economics", "coordinated"]) {
      expect(styleFor(globalBlocks, `[data-subject-tone="${tone}"]`, "all")["--subject-panel-tint"]).toBeTruthy();
    }
    expect(styleFor(globalBlocks, ':root[data-theme="dark"] [data-subject-tone]', "all")["--subject-panel-tint"]).toBeTruthy();
  });
});

describe("question explorer toolbar is unboxed while its controls stay boxed", () => {
  const toolbar = styleFor(globalBlocks, ".explorer-toolbar", "base");

  it("draws no tray around the toolbar controls", () => {
    expect(paintsNothing(toolbar.background)).toBe(true);
    expect(paintsNothing(toolbar["background-color"])).toBe(true);
    expect(drawsNoEdge(toolbar)).toBe(true);
    expect(paintsNothing(toolbar["box-shadow"])).toBe(true);
    expect(paintsNothing(toolbar.padding)).toBe(true);
  });

  it("keeps every individual control in its own rectangle", () => {
    for (const selector of [".search-field", ".sort-select-trigger", ".toolbar-icon-button", ".mobile-filter-button"]) {
      expect(drawsNoEdge(styleFor(globalBlocks, selector, "base")), `${selector} should keep its own edge`).toBe(false);
    }
  });
});

describe("mobile question explorer keeps two rows with a wider Filters control", () => {
  const mobile = "max-width: 640px";
  const toolbar = styleFor(globalBlocks, ".explorer-toolbar", mobile);
  const filterButton = styleFor(globalBlocks, ".explorer-toolbar .mobile-filter-button", mobile);
  const sortField = styleFor(globalBlocks, ".explorer-toolbar .sort-field", mobile);
  const search = styleFor(globalBlocks, ".explorer-toolbar .search-field", mobile);
  const share = styleFor(globalBlocks, ".explorer-toolbar .share-view-button", mobile);
  const download = styleFor(globalBlocks, ".explorer-toolbar .download-button", mobile);

  it("keeps two rows on the unboxed toolbar with no padded card", () => {
    expect(normalize(toolbar["grid-template-rows"])).toMatch(/^auto auto$/);
    expect(paintsNothing(toolbar.padding)).toBe(true);
  });

  it("gives filters the wide column and sort only the icon pair", () => {
    expect(normalize(toolbar["grid-template-columns"])).toBe("minmax(0, 1fr) 44px 44px");
    expect(normalize(filterButton["grid-column"])).toBe("1");
    expect(normalize(filterButton["grid-row"])).toBe("2");
    expect(normalize(sortField["grid-column"])).toBe("2 / -1");
    expect(normalize(sortField["grid-row"])).toBe("2");
  });

  it("keeps search, share, and download on the first row", () => {
    expect(normalize(search["grid-row"])).toBe("1");
    expect(normalize(share["grid-row"])).toBe("1");
    expect(normalize(download["grid-row"])).toBe("1");
  });

  it("keeps every control at a 44px touch target", () => {
    expect(Number.parseFloat(filterButton["min-height"] ?? "0")).toBeGreaterThanOrEqual(44);
    expect(Number.parseFloat(styleFor(globalBlocks, ".explorer-toolbar .sort-select-trigger", mobile)["min-height"] ?? "0")).toBeGreaterThanOrEqual(44);
  });
});

describe("off-white public background is painted by a full-width surface", () => {
  const surface = styleFor(globalBlocks, ".public-surface", "all");

  it("gives the surface the warm off-white paint and no width cap", () => {
    expect(normalize(surface.background)).toContain("paper-warm");
    expect(surface["max-width"]).toBeUndefined();
    expect(surface.width).toBeUndefined();
    expect(surface["margin-inline"]).toBeUndefined();
  });

  it("stops painting the page band on shell-width containers", () => {
    for (const selector of [".pricing-page", ".articles-page", ".auth-page"]) {
      const page = styleFor(globalBlocks, selector, "all");
      expect(paintsNothing(page.background)).toBe(true);
      expect(paintsNothing(page["background-color"])).toBe(true);
    }
  });
});
