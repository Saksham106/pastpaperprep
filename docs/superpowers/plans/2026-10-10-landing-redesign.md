# Landing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/` with the gothic layered hero, a compact picker bar, pastel colour-block subject cards, a free-vs-plan band, and Young Serif headings site-wide.

**Architecture:**
- `MarketingHome` stays a server component, rendered statically.
- A small client `HeroPicker` handles the IGCSE/IB toggle and subject select. The catalog reuses `QualificationTabs`.
- Subject colour tokens (`--course-pastel`, `--course-accent` and `--subject-panel-tint`) live in `globals.css`, so the bank, dashboard and pricing pages pick them up.

**Tech Stack:** Next.js 16 App Router, React 19, CSS modules plus globals.css, `next/font/google` (Young_Serif), Phosphor icons, Vitest and Testing Library, `sharp` for asset generation.

**Spec:** `docs/superpowers/specs/2026-10-10-landing-redesign-design.md`

## Global Constraints

- Static page: no new route handlers and no request-time data on `/`.
- Copy stays minimal: no eyebrow or paragraph in the hero, and no heading on the catalog.
- Headline: "Past papers," / "by topic." The second line is italic burgundy.
- Display font: Young Serif, weight 400. Body text stays Geist.
- Pastel palette, as pastel / ink pairs:
  - math `#cfdcff`/`#2447b8`
  - chemistry `#ffd6c7`/`#b4482a`
  - physics `#e0d5fc`/`#5b3fae`
  - biology `#c9eed8`/`#1d7546`
  - economics `#fde9ad`/`#8f6400`
  - coordinated `#c4ecef`/`#167279`
- `--subject-panel-tint` is `color-mix(in srgb, <pastel> 38%, #fff)`.
- The catalog section keeps `id="question-banks"`.
- Every bank links to `bankEntryHref(slug)`. Proof numbers and prices come from data.
- Touch targets are at least 44px. Decorative art uses `alt=""`. Motion is disabled under `prefers-reduced-motion`.

## Review Focus

1. **Release-gated banks** (environment `{}`): gated banks must not appear in the picker, the cards or the proof numbers. This is pinned by a Task 3 test.
2. **Picker switching to IB** must reset the subject to the first IB bank, not keep a stale IGCSE slug. This is pinned by a Task 2 test.
3. **A qualification with no enabled banks** must not render its toggle option or tab. This is pinned by a Task 2 test.
4. **Dark mode:** the hero stays light, and the cards keep readable contrast. Verified visually in Task 5.
5. **390px mobile:** the hero crops to 4:5, the picker stacks and the cards go to one column, with no horizontal scroll. Verified visually in Task 5.

---

### Task 1: Tokens and display font

**Files:**
- Modify: `src/app/layout.tsx` (add `Young_Serif` with `variable: "--font-young-serif"`)
- Modify: `src/app/globals.css`:
  - add `--font-serif` on `:root`
  - pastel tokens at lines ~171–188
  - replace every `Georgia, "Times New Roman", serif` and `Georgia, serif` with `var(--font-serif)` at weight 400
- Test: `src/components/ux-polish-style-contract.test.ts`

**Interfaces:**
- Produces:
  - CSS custom properties `--font-serif`, plus `--course-pastel`, `--course-accent` and `--subject-panel-tint` per tone, set on both `.course-tone-<tone>` and `[data-subject-tone="<tone>"]`
  - `.course-tone-<tone>` classes and `data-subject-tone` attributes, unchanged

- [ ] **Step 1: Write the failing tests.** Add them to `ux-polish-style-contract.test.ts`:

```ts
describe("pastel subject palette and serif token", () => {
  const PASTEL: Record<string, string> = { math: "#cfdcff", chemistry: "#ffd6c7", physics: "#e0d5fc", biology: "#c9eed8", economics: "#fde9ad", coordinated: "#c4ecef" };
  it("defines a pastel and a tint for every subject tone", () => {
    for (const [tone, pastel] of Object.entries(PASTEL)) {
      const block = styleFor(globalBlocks, `[data-subject-tone="${tone}"]`, "base");
      expect(normalize(block["--course-pastel"])).toBe(pastel);
      expect(normalize(block["--subject-panel-tint"])).toContain("38%");
    }
  });
  it("routes serif headings through the Young Serif token", () => {
    const root = styleFor(globalBlocks, ":root", "base");
    expect(normalize(root["--font-serif"])).toContain("--font-young-serif");
    expect(readFileSync(path.join(PROJECT_ROOT, "src/app/globals.css"), "utf8")).not.toMatch(/Georgia/);
  });
});
```

- [ ] **Step 2: Run and confirm it fails.** Run `npx vitest run src/components/ux-polish-style-contract.test.ts`. Expected: FAIL, because `--course-pastel` is undefined and Georgia is still present.

- [ ] **Step 3: Implement.**
  - In `layout.tsx`, add `const youngSerif = Young_Serif({ variable: "--font-young-serif", subsets: ["latin"], weight: "400" });` and append `youngSerif.variable` to the `<html>` className next to `geist.variable`.
  - In `globals.css`, add `--font-serif: var(--font-young-serif), Georgia, "Times New Roman", serif;` to `:root`. This is the one allowed Georgia fallback. If the test's `not.toMatch(/Georgia/)` would trip on it, define the fallback stack as `"Young Serif", "Times New Roman", serif` instead.
  - Replace the tone block with:

```css
.course-tone-math, [data-subject-tone="math"] { --course-pastel: #cfdcff; --course-accent: #2447b8; --subject-panel-tint: color-mix(in srgb, #cfdcff 38%, #fff); }
.course-tone-chemistry, [data-subject-tone="chemistry"] { --course-pastel: #ffd6c7; --course-accent: #b4482a; --subject-panel-tint: color-mix(in srgb, #ffd6c7 38%, #fff); }
.course-tone-physics, [data-subject-tone="physics"] { --course-pastel: #e0d5fc; --course-accent: #5b3fae; --subject-panel-tint: color-mix(in srgb, #e0d5fc 38%, #fff); }
.course-tone-biology, [data-subject-tone="biology"] { --course-pastel: #c9eed8; --course-accent: #1d7546; --subject-panel-tint: color-mix(in srgb, #c9eed8 38%, #fff); }
.course-tone-economics, [data-subject-tone="economics"] { --course-pastel: #fde9ad; --course-accent: #8f6400; --subject-panel-tint: color-mix(in srgb, #fde9ad 38%, #fff); }
.course-tone-coordinated, [data-subject-tone="coordinated"] { --course-pastel: #c4ecef; --course-accent: #167279; --subject-panel-tint: color-mix(in srgb, #c4ecef 38%, #fff); }
```

  - Keep the existing dark-mode `--course-accent` overrides. Add `:root[data-theme="dark"] [data-subject-tone], :root[data-theme="dark"] [class*="course-tone-"] { --course-pastel: color-mix(in srgb, var(--course-accent) 30%, var(--surface-raised)); }`, and keep the existing dark `--subject-panel-tint` rule.
  - Replace the 15 Georgia `font:` declarations with `var(--font-serif)` and set their weight to `400`. Young Serif ships one weight, so this avoids faux bold.
  - The existing contract `[data-subject-tone="<tone>"]` expects `--subject-panel-tint`, so keep that selector in each rule.

- [ ] **Step 4: Run and confirm it passes.** Run `npx vitest run src/components/ux-polish-style-contract.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -am "Young Serif display token and pastel subject palette"`

### Task 2: HeroPicker client component

**Files:**
- Create: `src/components/HeroPicker.tsx`
- Test: `src/components/HeroPicker.test.tsx`

**Interfaces:**
- Produces:
  - `export type PickerBank = { slug: string; label: string; href: string }`
  - `export type PickerGroup = { id: string; label: string; banks: PickerBank[] }`
  - `export function HeroPicker({ groups }: { groups: readonly PickerGroup[] })`. Groups with zero banks are ignored.
- CSS classes come from `MarketingHome.module.css` (Task 3): `picker`, `pickerToggle`, `pickerField`, `pickerGo`.

- [ ] **Step 1: Write the failing tests.**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroPicker } from "@/components/HeroPicker";

const groups = [
  { id: "igcse", label: "IGCSE", banks: [{ slug: "igcse", label: "Mathematics 0580", href: "/banks/igcse?free=1" }, { slug: "igcse-additional", label: "Additional Mathematics 0606", href: "/banks/igcse-additional?free=1" }] },
  { id: "ib", label: "IB", banks: [{ slug: "ib-hl", label: "IB Math AA HL", href: "/banks/ib-hl?free=1" }] },
];

describe("HeroPicker", () => {
  it("starts on the first qualification and bank", () => {
    render(<HeroPicker groups={groups} />);
    expect(screen.getByRole("button", { name: "IGCSE" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: /start free/i })).toHaveAttribute("href", "/banks/igcse?free=1");
  });
  it("follows the chosen subject", () => {
    render(<HeroPicker groups={groups} />);
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "igcse-additional" } });
    expect(screen.getByRole("link", { name: /start free/i })).toHaveAttribute("href", "/banks/igcse-additional?free=1");
  });
  it("resets to the first bank when switching qualification", () => {
    render(<HeroPicker groups={groups} />);
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "igcse-additional" } });
    fireEvent.click(screen.getByRole("button", { name: "IB" }));
    expect(screen.getByRole("button", { name: "IB" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Subject")).toHaveValue("ib-hl");
    expect(screen.getByRole("link", { name: /start free/i })).toHaveAttribute("href", "/banks/ib-hl?free=1");
  });
  it("hides qualifications without banks and renders nothing when empty", () => {
    const { rerender, container } = render(<HeroPicker groups={[groups[0], { id: "ib", label: "IB", banks: [] }]} />);
    expect(screen.queryByRole("button", { name: "IB" })).toBeNull();
    rerender(<HeroPicker groups={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run and confirm it fails.** Run `npx vitest run src/components/HeroPicker.test.tsx`. Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement.**

```tsx
"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import styles from "./MarketingHome.module.css";

export type PickerBank = { slug: string; label: string; href: string };
export type PickerGroup = { id: string; label: string; banks: PickerBank[] };

/** Hero quick start: qualification, subject, go. "Start free" is a plain link, so the default works without JS. */
export function HeroPicker({ groups }: { groups: readonly PickerGroup[] }) {
  const available = groups.filter((group) => group.banks.length > 0);
  const [groupId, setGroupId] = useState(available[0]?.id);
  const [slug, setSlug] = useState(available[0]?.banks[0]?.slug);
  const selectId = useId();
  const group = available.find((item) => item.id === groupId) ?? available[0];
  if (!group) return null;
  const bank = group.banks.find((item) => item.slug === slug) ?? group.banks[0];
  return <div className={styles.picker}>
    {available.length > 1 && <div className={styles.pickerToggle} aria-label="Qualification" role="group">
      {available.map((item) => <button key={item.id} type="button" aria-pressed={item.id === group.id} onClick={() => { setGroupId(item.id); setSlug(item.banks[0]?.slug); }}>{item.label}</button>)}
    </div>}
    <div className={styles.pickerField}>
      <label htmlFor={selectId}>Subject</label>
      <select id={selectId} value={bank.slug} onChange={(event) => setSlug(event.target.value)}>
        {group.banks.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}
      </select>
    </div>
    <Link className={styles.pickerGo} href={bank.href}>Start free <ArrowRight aria-hidden="true" weight="bold" /></Link>
  </div>;
}
```

- [ ] **Step 4: Run and confirm it passes.** Run `npx vitest run src/components/HeroPicker.test.tsx`. Expected: 4 passed.

- [ ] **Step 5: Commit.** `git add src/components/HeroPicker* && git commit -m "Hero picker: qualification, subject, start free"`

### Task 3: Artwork, sample assets and the MarketingHome rebuild

**Files:**
- Create: `scripts/landing-artwork.mjs`. It takes the source PNG path and writes the two WebPs using the sky flood-fill cut-out.
- Create:
  - `public/artwork/landing-gothic.webp` (1859×846, q82)
  - `public/artwork/landing-gothic-front.webp` (alpha)
  - `public/artwork/landing-gothic-source.md`
- Create: `public/landing/sample-question.webp` and `public/landing/sample-markscheme.webp`. These are a free-year (2016–2018) 0580 question and its official mark-scheme crop, downloaded from the public free tier as rendered on `/banks/igcse?free=1`.
- Rewrite: `src/components/MarketingHome.tsx` and `src/components/MarketingHome.module.css`
- Rewrite: `src/app/page.test.tsx`
- Modify: `src/components/ux-polish-style-contract.test.ts`. Replace the "landing bank tiles…" and "landing subject panels keep a centered, symmetric frame" blocks.

**Interfaces:**
- Consumes:
  - `HeroPicker`, `PickerGroup`
  - `bankEntryHref`, `hasFreeTier`, `getCatalogRuntimeBanks`
  - `bankYearFacts` from `@/lib/upgrade-copy`
  - `PRICING_MODEL`, `priceForBankCount` and `formatPrice` from `@/lib/pricing-model`
  - `CourseIcon`, `QualificationTabs`, `FAQS`
- Produces: `MarketingHome({ environment })` with the same signature. Markup hooks:
  - `[data-subject-tone]` on each subject card
  - `a[data-bank-slug]` on each bank row
  - `section#question-banks`
  - `[data-year-paid]` on paid years
  - `[data-plan]` on plan prices
  - `details[data-home-faq]`

- [ ] **Step 1: Generate the artwork.** Run `node scripts/landing-artwork.mjs "$HOME/Downloads/Engraved Gothic Collegiate Panorama.png"`. Expected: it writes both WebPs and prints the sky fraction (about 0.43). Write the source note: user-supplied file, original 1859×846, creator and licence not supplied, do not claim public-domain status.

- [ ] **Step 2: Capture the sample.**
  - Open `/banks/igcse?free=1` in production, signed out.
  - Pick a short free-year question without a large diagram.
  - Read the question and mark-scheme image URLs from the DOM, download them, convert each to WebP at a width of 900 or less, and save them under `public/landing/`.
  - Record the question's paper, year and topic for the caption.
  - If no image can be fetched, fall back to a text-only card. The spec allows this.

- [ ] **Step 3: Write the failing page tests.** Rewrite `src/app/page.test.tsx`, keeping `liveBankEnvironment`:

```tsx
describe("home page", () => {
  it("leads with the layered headline, the picker and data-driven proof", () => {
    const markup = renderToStaticMarkup(<MarketingHome environment={{}} />);
    expect(markup).toContain("Past papers,");
    expect(markup).toContain("by topic.");
    expect(markup).toContain("17,694");
    expect(markup).toContain("1,121");
    expect(markup).toContain('href="/banks/igcse?free=1"');
    expect(markup).not.toContain("Practice the");
    expect(markup).not.toContain("Choose where to begin.");
    expect(markup).not.toContain("Backed by learning science");
    expect(markup).not.toContain("From topic to finished practice set.");
  });

  it("shows every enabled bank as one full-row link inside its subject card", () => {
    const { container } = render(<MarketingHome environment={liveBankEnvironment} />);
    const rows = [...container.querySelectorAll<HTMLAnchorElement>("#question-banks a[data-bank-slug]")];
    expect(rows).toHaveLength(19);
    expect(container.querySelectorAll("a a")).toHaveLength(0);
    for (const row of rows) expect(row.getAttribute("href")).toMatch(/^\/banks\/[a-z0-9-]+(\?free=1)?$/);
    expect(rows.find((row) => row.dataset.bankSlug === "igcse-economics-0455")?.closest("[data-subject-tone]")?.getAttribute("data-subject-tone")).toBe("economics");
    const cards = container.querySelectorAll("#question-banks [data-subject-tone]");
    expect(container.querySelectorAll("#question-banks [data-course-icon]")).toHaveLength(cards.length);
  });

  it("switches catalog qualification with the tablist keyboard contract", () => {
    const { getAllByRole } = render(<MarketingHome environment={liveBankEnvironment} />);
    const tabs = getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs[1], { key: "Home" });
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("prices the plans from the pricing model and marks the paid exam years", () => {
    const { container } = render(<MarketingHome environment={liveBankEnvironment} />);
    expect([...container.querySelectorAll("[data-plan]")].map((plan) => plan.textContent)).toEqual([
      expect.stringContaining("$6"), expect.stringContaining("$10"), expect.stringContaining("$25"),
    ]);
    expect(container.querySelectorAll("[data-year-paid]").length).toBeGreaterThan(0);
    expect(container.querySelector('a[href="/pricing"]')).not.toBeNull();
  });

  it("keeps the compact FAQ preview", () => { /* same body as the current FAQ test */ });
  it("describes Economics in homepage search metadata", () => { /* unchanged */ });
  it("does not advertise gated banks before their release flags are enabled", () => { /* unchanged */ });
});
```

For the FAQ test, keep the existing assertions: four `details[data-home-faq]`, the `/faq` link and the mailto link. Copy them verbatim from the current file.

- [ ] **Step 4: Run and confirm it fails.** Run `npx vitest run src/app/page.test.tsx`. Expected: FAIL, because the old copy is still rendered.

- [ ] **Step 5: Implement `MarketingHome.tsx`.**
  - Keep `SUBJECTS`, `groupSubjects` and `HOME_FAQS`.
  - Replace the render with these sections, in this order:
    1. **Hero:**
       - the `.stage` div with an aspect ratio of 1859/846 (4/5 under 700px)
       - `<Image src="/artwork/landing-gothic.webp" priority fill sizes="100vw" alt="" />`
       - `<h1 className={styles.headline}><span>Past papers,</span> <em>by topic.</em></h1>`
       - `<Image src="/artwork/landing-gothic-front.webp" fill sizes="100vw" alt="" />` with the `front` class
       - the fade, then `.lede` containing `<HeroPicker groups={pickerGroups} />`, `.heroLinks` (`<a href="#question-banks">All {banks.length} banks</a> · <Link href="/pricing">Plans</Link>`) and `.proof` with three spans showing questions, papers and banks
    2. **Try one now:** two columns. The left has the eyebrow "Try one now", an `h2` "A real question. *The real mark scheme.*" and a `<Link className="button primary" href="/banks/igcse?free=1">Try free questions</Link>`. The right has a `.sample` figure with two `<Image>`s (question card and overlapping mark-scheme card) and a mono caption.
    3. **Catalog:** `<section id="question-banks" className={styles.banks} aria-label="Question banks"><QualificationTabs items={...} /></section>`. Each tab panel is `<div className={styles.subjectGrid}>{groups.map(SubjectCard)}</div>`, where `SubjectCard` is:
       ```tsx
       <section className={`${styles.subjectCard} course-tone-${group.tone}`} data-subject-tone={group.tone} key={group.name}>
         <header className={styles.subjectHead}><h3>{group.name}</h3><span className={styles.subjectMark}><CourseIcon tone={group.tone} /></span></header>
         <div className={styles.bankRows}>{group.banks.map((bank) => <Link className={styles.bankRow} href={bankEntryHref(bank.slug)} data-bank-slug={bank.slug} data-has-free-tier={hasFreeTier(bank.slug) ? "true" : undefined} key={bank.slug}><strong>{bank.shortName}</strong><span>{bank.questionCount.toLocaleString()} questions</span><ArrowRight aria-hidden="true" weight="bold" /></Link>)}</div>
       </section>
       ```
    4. **Free vs plan:** a `.plan` band. It has `facts = bankYearFacts("igcse")`, a years strip of `<span data-year-paid={paid || undefined}>`, and three `[data-plan]` cards: `formatPrice(priceForBankCount("monthly", 1))`, `formatPrice(priceForBankCount("monthly", 2))` (labelled "2–5 banks", shown as "from") and `formatPrice(PRICING_MODEL.allAccess.monthlyCents)`, each with "/mo". Then `<Link className="button primary" href="/pricing">See plans</Link>`.
    5. **FAQ:** the existing markup, unchanged.
    6. **CTA:** `<h2>Start with one topic.</h2>` and `<Link className="button primary" href="#question-banks">Choose your course</Link>`.
  - Build `pickerGroups` as `[{ id: "igcse", label: "IGCSE", banks: cambridgeBanks.map(toPickerBank) }, { id: "ib", label: "IB", banks: ibBanks.map(toPickerBank) }]`, where `toPickerBank = (bank) => ({ slug: bank.slug, label: bank.shortName, href: bankEntryHref(bank.slug) })`.

- [ ] **Step 6: Implement `MarketingHome.module.css`.** Rewrite it, porting the mockup CSS from the session scratchpad (`hero.html`, `cards.html`):
  - `.home` keeps `margin-top: -68px`, so the header overlays the hero.
  - The hero is light in both themes and uses hard-coded paper colours (`#efe9dd`).
  - `.headline` uses `font: 400 clamp(3.4rem, 9.6vw, 9.6rem)/.86 var(--font-serif); letter-spacing: -.045em; color: #18233b;` and `em { color: #7f293a; font-style: italic; }`. Young Serif has no italic, so the browser slants it; that's acceptable and the same as in the mockup.
  - `.front` sits at `z-index: 3` above `.headline` (`z-index: 2`).
  - Parallax:
    ```css
    @supports (animation-timeline: scroll()) {
      @media (prefers-reduced-motion: no-preference) {
        .headline { animation: drift linear both; animation-timeline: scroll(root); animation-range: 0 600px; }
        @keyframes drift { to { transform: translate3d(0, 120px, 0); } }
      }
    }
    ```
  - `.picker` is a grid `auto 1fr auto` on `var(--surface)` with a 1px `var(--line)` border, 16px radius and a soft shadow. The toggle buttons have `aria-pressed="true"` and look like `.billing-toggle` (ink background, surface text, 40px min-height). The select is 44px or taller with no native border, and the label is mono and uppercase. `.pickerGo` is a cobalt button. Under 700px, everything goes to one column.
  - `.subjectGrid` has 3 columns (2 under 980px, 1 under 640px) and a 16px gap.
  - `.subjectCard` uses `background: var(--subject-panel-tint)`, a 1px border mixed from `var(--course-pastel)`, an 18px radius and `overflow: hidden`.
  - `.subjectHead` uses `background: var(--course-pastel)`, a min-height of 104px and the title in `var(--font-serif)` at 26px in `#18233b`. The `.subjectMark :global(.course-icon)` is 64px with no box and `color: var(--course-accent)`, with the svg at 60px.
  - `.bankRow` is a grid `1fr auto auto`, 44px or taller, with `background: rgb(255 255 255 / .75)`, a 1px border mixed from the pastel and white, and a 12px radius. On hover it uses `border-color: var(--course-accent)` and `transform: translateY(-2px)`.
  - The `.plan` band is navy `#18233b` with light text. The year spans are mono, and `[data-year-paid]` is cobalt.
  - Keep the FAQ styles from the old CSS.
  - The dark theme leaves the hero untouched, and the `.subjectHead` title switches to `var(--ink)`.

- [ ] **Step 7: Update the style contracts.** Replace the two old landing describe blocks with:

```ts
describe("landing subject cards read as coloured, clickable blocks", () => {
  const card = styleFor(homeBlocks, ".subjectCard", "all");
  const head = styleFor(homeBlocks, ".subjectHead", "all");
  const row = styleFor(homeBlocks, ".bankRow", "all");
  const hover = styleFor(homeBlocks, ".bankRow:hover", "all");
  it("paints the tinted body and the pastel header from the shared tokens", () => {
    expect(normalize(card.background)).toContain("--subject-panel-tint");
    expect(normalize(head.background)).toContain("--course-pastel");
  });
  it("draws a box around every bank row with a hover state", () => {
    expect(paintsSomething(row.background)).toBe(true);
    expect(drawsNoEdge(row)).toBe(false);
    expect(paintsSomething(hover["border-color"])).toBe(true);
    expect(Number.parseFloat(row["min-height"] ?? "0")).toBeGreaterThanOrEqual(44);
  });
});
```

- [ ] **Step 8: Run and confirm it passes.** Run `npx vitest run src/app/page.test.tsx src/components/ux-polish-style-contract.test.ts src/components/HeroPicker.test.tsx`. Expected: all pass.

- [ ] **Step 9: Commit.** `git add -A public/artwork public/landing scripts/landing-artwork.mjs src && git commit -m "Landing redesign: gothic hero, picker, pastel subject cards, plan band"`

### Task 4: Repo-wide checks

**Files:** whichever files the checks flag. Other tests that assert old landing copy or Georgia, for example `not-found.test.tsx` and `SiteHeader.test.tsx`, are updated only where they assert removed homepage copy.

- [ ] **Step 1: Run the checks.** Run `npm run lint && npm run typecheck && npx vitest run --exclude '.claude/**' --exclude '.worktrees/**'`, writing the output to the workspace log. Expected: all green. Fix only regressions caused by this branch, and ledger each fix as a ruling if it changes a test's intent.
- [ ] **Step 2: Build.** Run `npm run build`. Expected: success, with `/` listed as static (○).
- [ ] **Step 3: Commit any fixes.**

### Task 5: Visual verification

- [ ] **Step 1: Start the dev server.** Run `next dev` on a free port with `.env.local` symlinked.
- [ ] **Step 2: Screenshot the page.** Use headless Chrome to capture `/` at 1440×900 (full page), at 390 wide (the phones iframe trick) and in dark mode (`data-theme="dark"` via localStorage `theme=dark`). Also screenshot one bank page and the dashboard to see how the tokens and font land.
- [ ] **Step 3: Fix and confirm.** Fix any overlap or contrast issues, re-run Task 4 Step 1, and commit.
- [ ] **Step 4: Send the screenshots to the owner.**

### Finish

- Run the final whole-branch review: an opus reviewer over the review package.
- Push the branch and open a PR with screenshots and asset provenance notes.
- Wait for CI and the Vercel preview, then ask the owner before merging.
