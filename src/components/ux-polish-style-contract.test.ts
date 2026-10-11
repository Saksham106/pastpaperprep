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

describe("landing subject cards read as coloured, clickable blocks", () => {
  const card = styleFor(homeBlocks, ".subjectCard", "all");
  const head = styleFor(homeBlocks, ".subjectHead", "all");
  const row = styleFor(homeBlocks, ".bankRow", "all");
  const hover = styleFor(homeBlocks, ".bankRow:hover", "all");

  it("paints the tinted body and the pastel header from the shared tokens", () => {
    expect(normalize(card.background)).toContain("--subject-panel-tint");
    expect(normalize(head.background)).toContain("--course-pastel");
  });

  it("draws a box around every bank row with a hover state and a 44px target", () => {
    expect(paintsSomething(row.background)).toBe(true);
    expect(drawsNoEdge(row)).toBe(false);
    expect(paintsSomething(row["border-radius"])).toBe(true);
    expect(paintsSomething(hover["border-color"])).toBe(true);
    expect(Number.parseFloat(row["min-height"] ?? "0")).toBeGreaterThanOrEqual(44);
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

describe("mobile question explorer keeps search, route, and filter rows with a wider Filters control", () => {
  const mobile = "max-width: 640px";
  const toolbar = styleFor(globalBlocks, ".explorer-toolbar", mobile);
  const filterButton = styleFor(globalBlocks, ".explorer-toolbar .mobile-filter-button", mobile);
  const sortField = styleFor(globalBlocks, ".explorer-toolbar .sort-field", mobile);
  const search = styleFor(globalBlocks, ".explorer-toolbar .search-field", mobile);
  const share = styleFor(globalBlocks, ".explorer-toolbar .share-view-button", mobile);
  const save = styleFor(globalBlocks, ".explorer-toolbar .save-pdf-button", mobile);

  // Row 2 holds the Core/Extended route picker on tiered banks (#89).
  it("keeps three rows on the unboxed toolbar with no padded card", () => {
    expect(normalize(toolbar["grid-template-rows"])).toMatch(/^auto auto auto$/);
    expect(paintsNothing(toolbar.padding)).toBe(true);
  });

  it("gives filters the wide column and sort only the icon pair", () => {
    expect(normalize(toolbar["grid-template-columns"])).toBe("minmax(0, 1fr) 44px auto");
    expect(normalize(filterButton["grid-column"])).toBe("1");
    expect(normalize(filterButton["grid-row"])).toBe("3");
    expect(normalize(sortField["grid-column"])).toBe("2 / -1");
    expect(normalize(sortField["grid-row"])).toBe("3");
  });

  it("keeps search, share, and Save PDF on the first row", () => {
    expect(normalize(search["grid-row"])).toBe("1");
    expect(normalize(share["grid-row"])).toBe("1");
    expect(normalize(save["grid-row"])).toBe("1");
    expect(Number.parseFloat(save["min-height"] ?? "0")).toBeGreaterThanOrEqual(44);
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

describe("question cards are calm study cards", () => {
  it("drops the cobalt rail and the boxed exam image", () => {
    expect(styleFor(globalBlocks, ".question-paper::before")).toEqual({});
    const image = styleFor(globalBlocks, ".question-images img", "base");
    expect(paintsNothing(image.border)).toBe(true);
  });

  it("ends wrapped metadata lines with the separator instead of starting them with it", () => {
    expect(styleFor(globalBlocks, ".question-meta span + span::before")).toEqual({});
    expect(styleFor(globalBlocks, ".question-meta span:not(:last-child)::after", "base").content).toBe('"·"');
  });

  it("paints the white exam sheet only once an image has loaded", () => {
    expect(paintsNothing(styleFor(globalBlocks, ".question-images", "base").background)).toBe(true);
    expect(normalize(styleFor(globalBlocks, ".question-images:has(img)", "base").background)).toBe("#fefefe");
  });

  it("draws a clearly visible custom checkbox", () => {
    const box = styleFor(globalBlocks, ".filter-group input[type=\"checkbox\"]", "base");
    expect(normalize(box.appearance)).toBe("none");
    expect(Number.parseFloat(box.width ?? "0")).toBeGreaterThanOrEqual(16);
    const checked = styleFor(globalBlocks, ".filter-group input[type=\"checkbox\"]:checked", "base");
    expect(normalize(checked.background)).toBe("var(--cobalt)");
  });
});

describe("free access note is one slim line", () => {
  it("has no border or button inside", () => {
    const strip = styleFor(globalBlocks, ".free-value-strip", "base");
    expect(drawsNoEdge(strip)).toBe(true);
    expect(styleFor(globalBlocks, ".free-value-strip > .button")).toEqual({});
  });
});

describe("toolbar keeps Save PDF in its own track on every bank", () => {
  const wide = "min-width: 851px";
  const tablet = "min-width: 641px";

  it("pins share and Save PDF to the last two tracks", () => {
    expect(normalize(styleFor(globalBlocks, ".explorer-toolbar .share-view-button", wide)["grid-column"])).toBe("-3 / -2");
    expect(normalize(styleFor(globalBlocks, ".explorer-toolbar .save-pdf-button", wide)["grid-column"])).toBe("-2 / -1");
  });

  it("drops the route column on banks without a course route", () => {
    expect(normalize(styleFor(globalBlocks, ".explorer-toolbar:not(:has(.course-route-picker))", wide)["grid-template-columns"])).toBe("minmax(220px, 1fr) minmax(190px, auto) 48px auto");
  });

  it("gives the Core/Extended picker its own row on tablets", () => {
    const picker = styleFor(globalBlocks, ".explorer-toolbar:has(.course-route-picker) .course-route-picker", tablet);
    expect(normalize(picker["grid-column"])).toBe("1 / -1");
    expect(normalize(picker["grid-row"])).toBe("2");
    expect(normalize(styleFor(globalBlocks, ".explorer-toolbar:has(.course-route-picker) .sort-field", tablet)["grid-row"])).toBe("3");
  });

  it("moves share and Save PDF beside search on tablets", () => {
    expect(normalize(styleFor(globalBlocks, ".explorer-toolbar .save-pdf-button", tablet)["grid-row"])).toBe("1");
    expect(normalize(styleFor(globalBlocks, ".explorer-toolbar .sort-field", tablet)["grid-row"])).toBe("2");
  });
});

describe("upgrade notes keep their whole message on phones", () => {
  it("only hides the second sentence of non-upgrade free notes", () => {
    const mobile = "max-width: 640px";
    expect(styleFor(globalBlocks, ".free-value-strip p span", mobile).display).toBeUndefined();
    expect(styleFor(globalBlocks, ".free-value-strip:not(.is-upgrade) p span", mobile).display).toBe("none");
  });
});

describe("pricing billing toggle stays in the page flow", () => {
  it("is not sticky, so it never floats over the plans, stats or table", () => {
    expect(normalize(styleFor(globalBlocks, ".pricing-page .pricing-toggle-sticky", "base").position)).not.toBe("sticky");
    expect(normalize(styleFor(globalBlocks, ".pricing-page > .pricing-toggle-sticky", "base").position)).not.toBe("sticky");
  });
});

describe("new pricing headings read as headings", () => {
  it("are bold rather than inheriting the page's light h2 weight", () => {
    for (const selector of [".pricing-page .pricing-bank-focus > h2", ".pricing-page .pricing-compare-heading", ".pricing-page .pricing-faq h2"]) {
      expect(Number.parseInt(styleFor(globalBlocks, selector, "base")["font-weight"] ?? "0", 10)).toBeGreaterThanOrEqual(750);
    }
  });
});

describe("pricing refresh styling", () => {
  it("gives public plan cards room for their artwork without the old 610px height", () => {
    for (const media of ["base", "max-width: 720px"] as const) {
      const height = Number.parseFloat(styleFor(globalBlocks, ".pricing-page .pricing-decision-grid:not([data-paid]) .pricing-option", media)["min-height"] ?? "0");
      expect(height).toBeGreaterThanOrEqual(380);
      expect(height).toBeLessThanOrEqual(500);
    }
  });

  it("keeps the popular card's feature list dark on its light background in dark mode", () => {
    expect(normalize(styleFor(globalBlocks, ".pricing-page .pricing-option-popular .plan-feature-list", "base").color)).toBe("#243b53");
  });

  it("makes the focus panel's checkout button a filled primary button", () => {
    expect(normalize(styleFor(globalBlocks, ".pricing-bank-focus-action .billing-actions .button", "base").background)).toBe("var(--cobalt)");
  });

  it("drops the retired dashboard upgrade strip styles", () => {
    expect(styleFor(globalBlocks, ".dashboard-upgrade-strip", "all")).toEqual({});
  });
});

describe("pastel subject palette and serif token", () => {
  const PASTEL: Record<string, string> = { math: "#cfdcff", chemistry: "#ffd6c7", physics: "#e0d5fc", biology: "#c9eed8", economics: "#fde9ad", coordinated: "#c4ecef" };

  it("defines a pastel and a tint for every subject tone", () => {
    for (const [tone, pastel] of Object.entries(PASTEL)) {
      const block = styleFor(globalBlocks, `[data-subject-tone="${tone}"]`, "base");
      expect(normalize(block["--course-pastel"]), tone).toBe(pastel);
      expect(normalize(block["--subject-panel-tint"]), tone).toContain("38%");
      expect(normalize(styleFor(globalBlocks, `.course-tone-${tone}`, "base")["--course-pastel"]), tone).toBe(pastel);
    }
  });

  it("routes serif headings through the Young Serif token", () => {
    expect(normalize(styleFor(globalBlocks, ":root", "base")["--font-serif"])).toContain("--font-young-serif");
    expect(readFileSync(path.join(PROJECT_ROOT, "src/app/globals.css"), "utf8")).not.toMatch(/Georgia/);
  });
});

describe("landing stays legible in dark mode", () => {
  it("lifts section eyebrows off the dark paper", () => {
    const dark = homeBlocks.find((block) => block.selector.includes('[data-theme="dark"]') && /\.eyebrow/.test(block.selector) && !/planBand/.test(block.selector));
    expect(dark?.declarations.color).toBe("var(--burgundy)");
  });
  it("keeps the light hero's native controls light", () => {
    expect(normalize(styleFor(homeBlocks, ".hero", "all")["color-scheme"])).toBe("light");
  });
  it("loads only weight 400 for Young Serif, so serif headings never fake bold", () => {
    for (const block of globalBlocks) {
      if (!block.declarations["font-family"]?.includes("--font-serif")) continue;
      expect(block.declarations["font-weight"] ?? "400", block.selector).toBe("400");
    }
  });
});
