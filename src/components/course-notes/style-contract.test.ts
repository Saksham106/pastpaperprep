import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * jsdom cannot compute colours, so this reads the real stylesheets: every custom property the notes CSS uses
 * is defined, and the text/background pairs the notes use meet WCAG AA in both themes.
 */
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");
const globals = read("src", "app", "globals.css");
const notes = read("src", "components", "course-notes", "course-notes.module.css");
const sheet = read("src", "components", "course-notes", "cheatsheet.module.css");

const declarations = (block: string) => Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const blockAfter = (css: string, head: string) => {
  const start = css.indexOf(head);
  if (start === -1) throw new Error(`missing block: ${head}`);
  return declarations(css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start)));
};

const light = {
  ...blockAfter(globals, ':root,\n:root[data-theme="light"]'),
  ...blockAfter(notes, ".block, .home, .topicPage, .lessonPage"),
};
const dark = {
  ...light,
  ...blockAfter(globals, ':root[data-theme="dark"] {'),
  ...blockAfter(notes, ':global(:root[data-theme="dark"]) .block'),
};

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};
const luminance = ([r, g, b]: number[]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const ratio = (fg: number[], bg: number[]) => {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (fg: number[], bg: number[], alpha: number) => fg.map((v, i) => Math.round(alpha * v + (1 - alpha) * bg[i]));

type Tokens = Record<string, string>;
const pairs = (t: Tokens, theme: "light" | "dark"): [string, number[], number[], number][] => {
  const c = (name: string) => {
    const value = t[`--${name}`];
    if (!value?.startsWith("#")) throw new Error(`--${name} is not a hex colour: ${value}`);
    return rgb(value);
  };
  const rows: [string, number[], number[], number][] = [
    ["muted on paper", c("muted"), c("paper"), 4.5],
    ["muted on surface", c("muted"), c("surface"), 4.5],
    ["muted on surface-raised", c("muted"), c("surface-raised"), 4.5],
    ["ink-soft on surface", c("ink-soft"), c("surface"), 4.5],
    ["ink-soft on cobalt-faint", c("ink-soft"), c("cobalt-faint"), 4.5],
    ["cobalt link on paper", c("cobalt"), c("paper"), 4.5],
    ["cobalt link on surface-raised", c("cobalt"), c("surface-raised"), 4.5],
    ["cobalt link on cobalt-faint", c("cobalt"), c("cobalt-faint"), 4.5],
    ["SL badge / BOOKLET chip", c("cobalt-strong"), c("cobalt-faint"), 4.5],
    ["cobalt-strong on surface", c("cobalt-strong"), c("surface"), 4.5],
    ["AHL badge", c("burgundy"), c("burgundy-soft"), 4.5],
    ["burgundy on paper", c("burgundy"), c("paper"), 4.5],
    ["burgundy on surface-raised", c("burgundy"), c("surface-raised"), 4.5],
    ["LEARN chip", c("t4-ink"), c("t4"), 4.5],
    ["success on surface-raised", c("success"), c("surface-raised"), 4.5],
    ["paper on ink (pressed buttons)", c("paper"), c("ink"), 4.5],
    ["ink-soft on tone (count in topic head)", c("ink-soft"), c("t1"), 4.5],
  ];
  for (const n of [1, 2, 3, 4, 5]) {
    rows.push([`t${n}-ink on t${n}`, c(`t${n}-ink`), c(`t${n}`), 4.5], [`t${n}-ink on paper`, c(`t${n}-ink`), c("paper"), 4.5]);
  }
  const cobalt = c("cobalt");
  const buttonInk = theme === "light" ? rgb("#ffffff") : rgb("#0d1430");
  rows.push(["primary button text", buttonInk, cobalt, 4.5], ["Continue small text at .92", over(buttonInk, cobalt, 0.92), cobalt, 4.5]);
  return rows;
};

describe("custom properties", () => {
  it("every var(--x) without a fallback in the notes CSS is defined somewhere", () => {
    const inline = new Set(["--tone", "--tone-ink", "--p", "--blocks", "--entries"]);
    const defined = new Set([...[globals, notes, sheet].flatMap((css) => [...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])), ...inline]);
    const used = [notes, sheet].flatMap((css) => [...css.matchAll(/var\((--[\w-]+)\s*([,)])/g)].filter((m) => m[2] === ")").map((m) => m[1]));
    expect([...new Set(used)].filter((name) => !defined.has(name))).toEqual([]);
  });

  it("--burgundy-soft is defined for the lesson, topic and home scopes in both themes", () => {
    expect(light["--burgundy-soft"]).toMatch(/^#/);
    expect(dark["--burgundy-soft"]).toMatch(/^#/);
    expect(dark["--burgundy-soft"]).not.toBe(light["--burgundy-soft"]);
    expect(notes).toMatch(/\.block, \.home, \.topicPage, \.lessonPage \{[^}]*--burgundy-soft/);
  });
});

describe("WCAG AA contrast of the notes colours", () => {
  for (const [theme, tokens] of [["light", light], ["dark", dark]] as const) {
    it(`${theme} theme: text pairs reach 4.5:1`, () => {
      const failing = pairs(tokens, theme).filter(([, fg, bg, need]) => ratio(fg, bg) < need).map(([name, fg, bg]) => `${name} ${ratio(fg, bg).toFixed(2)}`);
      expect(failing).toEqual([]);
    });
  }

  it("the cheat sheet's fixed paper palette reaches 4.5:1", () => {
    const sheetTokens = blockAfter(sheet, ".sheet {");
    const muted = rgb(sheetTokens["--muted"]);
    for (const bg of ["#ffffff", "#fafaf7"]) expect(ratio(muted, rgb(bg))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(rgb(sheetTokens["--burgundy"]), rgb("#fafaf7"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(rgb(sheetTokens["--cobalt-strong"]), rgb(sheetTokens["--cobalt-faint"]))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(rgb(sheetTokens["--t4-ink"]), rgb(sheetTokens["--t4"]))).toBeGreaterThanOrEqual(4.5);
  });

  it("no text in the notes CSS is faded below full strength with opacity", () => {
    const opacities = [...notes.matchAll(/opacity:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    expect(opacities.filter((o) => o < 0.9)).toEqual([]);
  });

  it("the cheat-sheet Save button is dark on the lighter dark-theme cobalt", () => {
    expect(sheet).toMatch(/data-theme="dark"\]\) \.save \{ color: #0d1430/);
  });
});
