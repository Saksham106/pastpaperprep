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

/**
 * Specificity of a compound selector as [ids, classes/attributes/pseudo-classes, elements].
 * Enough for the simple compound selectors in these sheets.
 */
function specificity(compound: string): [number, number, number] {
  const clean = compound.replace(/::[\w-]+/g, "");
  const ids = clean.match(/#[\w-]+/g)?.length ?? 0;
  const classes = (clean.match(/\.[\w-]+/g)?.length ?? 0)
    + (clean.match(/\[[^\]]*\]/g)?.length ?? 0)
    + (clean.match(/:(?!:)[\w-]+/g)?.length ?? 0);
  const elements = /^[a-zA-Z]/.test(clean) ? 1 : 0;
  return [ids, classes, elements];
}

function compareSpecificity(left: [number, number, number], right: [number, number, number]): number {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

/**
 * Cascade winner for ONE element that matches every compound in `compounds`.
 *
 * `styleFor` merges by literal selector text, which hides the real bug class these layout
 * rules are prone to: a lower-specificity rule that is declared later still loses. This
 * resolves the cascade the way a browser does — highest specificity first, then source order.
 */
function cascadeFor(
  blocks: StyleBlock[],
  compounds: string[],
  applies: (media: string | null) => boolean = (media) => media === null,
): Declaration {
  const candidates = blocks.flatMap((block) => {
    if (!applies(block.media)) return [];
    return block.selector
      .split(",")
      .map((part) => part.trim())
      .map((selector) => ({ selector, compound: selector.split(/[\s>+~]+/).filter(Boolean).pop() ?? "" }))
      .filter(({ compound }) => compounds.includes(compound))
      .map(({ compound }) => ({ block, weight: specificity(compound) }));
  });
  candidates.sort((left, right) => compareSpecificity(left.weight, right.weight) || left.block.order - right.block.order);
  const merged: Declaration = {};
  for (const candidate of candidates) Object.assign(merged, candidate.block.declarations);
  return merged;
}

/** Effective horizontal padding after resolving shorthand -> logical -> longhand. */
function horizontalPadding(style: Declaration): { left: number; right: number } | null {
  const parse = (value?: string) => (value === undefined ? null : Number.parseFloat(value));
  let left: number | null = null;
  let right: number | null = null;

  const padding = style.padding;
  if (padding !== undefined) {
    const parts = padding.split(/\s+/);
    const horizontal = parts[1] !== undefined ? parse(parts[1]) : parse(parts[0]);
    left = horizontal;
    right = horizontal;
  }
  const inline = style["padding-inline"];
  if (inline !== undefined) {
    const parts = inline.split(/\s+/).filter(Boolean);
    left = parse(parts[0]);
    right = parts[1] !== undefined ? parse(parts[1]) : parse(parts[0]);
  }
  const leftLonghand = parse(style["padding-left"]);
  if (leftLonghand !== null) left = leftLonghand;
  const rightLonghand = parse(style["padding-right"]);
  if (rightLonghand !== null) right = rightLonghand;

  return left === null || right === null ? null : { left, right };
}

/** Media contexts a browser would apply at a given viewport width, in source order. */
const VIEWPORTS: Array<[string, number]> = [["desktop 1440", 1440], ["tablet 900", 900], ["mobile 620", 620], ["small mobile 360", 360]];

function mediaAppliesAt(width: number, media: string | null): boolean {
  if (media === null) return true;
  const max = media.match(/max-width:\s*(\d+)px/);
  const min = media.match(/min-width:\s*(\d+)px/);
  if (max && !min) return width <= Number(max[1]);
  if (min && !max) return width >= Number(min[1]);
  if (min && max) return width >= Number(min[1]) && width <= Number(max[1]);
  return false;
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

describe("landing subject panels keep a centered, symmetric frame", () => {
  /**
   * The two-bank Mathematics group is the grid's first child and used to hug the panel's left
   * border: a legacy `.subjectGroup:first-child { padding-left: 0 }` out-specified the panel
   * padding (0,2,0 beats 0,1,0), so the shared content column — heading and both tiles — sat
   * 22px off-centre. The last group lost its right padding the same way.
   */
  const POSITIONS: Array<[string, string[]]> = [
    ["first group (Mathematics)", [".subjectGroup", ".subjectGroup:first-child"]],
    ["middle group (Chemistry)", [".subjectGroup"]],
    ["last group (Co-ordinated Sciences)", [".subjectGroup", ".subjectGroup:last-child"]],
    ["last group when it is also odd (5-group IB panel)", [".subjectGroup", ".subjectGroup:last-child", ".subjectGroup:last-child:nth-child(odd)"]],
  ];

  for (const [viewport, width] of VIEWPORTS) {
    for (const [position, compounds] of POSITIONS) {
      it(`centers the ${position} at ${viewport}`, () => {
        const padding = horizontalPadding(cascadeFor(homeBlocks, compounds, (media) => mediaAppliesAt(width, media)));
        expect(padding, `${position} @ ${viewport} should resolve a horizontal padding`).not.toBeNull();
        expect(padding!.left, `${position} @ ${viewport} left padding`).toBeGreaterThan(0);
        expect(padding!.right, `${position} @ ${viewport} right padding`).toBeGreaterThan(0);
        expect(padding!.left, `${position} @ ${viewport} must be symmetric (hint: a ":" position rule that zeroes one side out-specifies the panel padding)`)
          .toBeCloseTo(padding!.right, 2);
      });
    }
  }

  it("never zeroes one side of the panel frame for a positional variant", () => {
    for (const block of homeBlocks) {
      if (!/\.subjectGroup/.test(block.selector)) continue;
      const positional = block.selector.split(",").map((part) => part.trim())
        .filter((selector) => /:first-child|:last-child|:nth-child/.test(selector) && /^\.subjectGroup(\s*$|:|\.)/.test(selector));
      if (positional.length === 0) continue;
      const padding = horizontalPadding(block.declarations);
      if (!padding) continue;
      expect(padding.left, `${block.selector} zeroes the left edge of a positional subject panel`).toBeGreaterThan(0);
      expect(padding.right, `${block.selector} zeroes the right edge of a positional subject panel`).toBeGreaterThan(0);
    }
  });

  it("centers and caps the two-tile Mathematics stack at the subject column measure", () => {
    const two = cascadeFor(
      homeBlocks,
      [".bankCards", ".bankCardsTwo", ".bankCards.bankCardsTwo"],
      (media) => mediaAppliesAt(1440, media),
    );
    expect(normalize(two.width), "the two-tile grid keeps an explicit centred measure").toMatch(/^min\(100%/);
    expect(normalize(two["margin-inline"])).toBe("auto");

    const wide = cascadeFor(homeBlocks, [".bankCards", ".bankCardsTwo"], (media) => mediaAppliesAt(620, media));
    expect(normalize(wide.width)).toMatch(/^min\(100%/);
    expect(normalize(wide["margin-inline"])).toBe("auto");
  });

  it("keeps both tiles distinct, equal, and full-column inside that measure", () => {
    const two = styleFor(homeBlocks, ".bankCards.bankCardsTwo", "all");
    expect(normalize(two["grid-template-columns"])).toMatch(/auto-fit|minmax/);
    // A long label ("Additional Mathematics 0606") wraps at the shared column measure; equalizing
    // the rows keeps the pair reading as two balanced links instead of one tall and one short tile.
    expect(normalize(two["grid-auto-rows"])).toBe("1fr");
    expect(normalize(styleFor(homeBlocks, ".bankCard", "all").width)).toBe("100%");
    expect(paintsSomething(styleFor(homeBlocks, ".bankCard", "all").background)).toBe(true);
  });
});
