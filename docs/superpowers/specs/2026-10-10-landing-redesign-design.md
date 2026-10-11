# Landing page redesign

Date: 2026-10-10 · Status: approved in conversation (owner asked to self-review and build)

## Goal

Rebuild the homepage (`/`) so it gets students practising in one or two clicks, makes the paid plan's value obvious, and looks premium. Copy stays short. The page must not add per-request server work (Vercel Fluid Active CPU): it stays statically rendered, as it is today.

## Decisions (from the owner)

- **Artwork:** the owner-supplied "Engraved Gothic Collegiate Panorama" (a stone arch framing a gothic skyline). Its provenance and licence are not independently verified, so it gets a source note like the Lifetime artwork's.
- **Headline:** "Past papers," / "*by topic.*" (burgundy italic second line).
- **Display font:** Young Serif (Google Fonts, weight 400), replacing Georgia for serif headings site-wide. Body text stays Geist.
- **Hero picker:** a compact bar with an IGCSE / IB toggle, a subject select and "Start free →". Underneath: "All 19 banks · Plans" links and small mono proof numbers (questions · papers · banks). No eyebrow, no paragraph.
- **Toggle style:** the site's existing segmented toggle (the pricing Monthly/Annual look: surface tray, ink-filled active segment).
- **Catalog:** no heading or subtitle. Just the IGCSE / IB toggle and colour-block subject cards:
  - a pastel header with the subject name in Young Serif and a large subject icon in a deeper shade
  - a lighter tinted body of the same colour
  - near-white bank rows showing the name, question count and an arrow
- **Pastel subject palette, site-wide:**

  | Tone | Pastel (header) | Ink (icon, accent text) |
  |---|---|---|
  | math | `#cfdcff` | `#2447b8` |
  | chemistry | `#ffd6c7` | `#a8401f` |
  | physics | `#e0d5fc` | `#5b3fae` |
  | biology | `#c9eed8` | `#1d7546` |
  | economics | `#fde9ad` | `#845c00` |
  | coordinated | `#c4ecef` | `#167279` |

  The existing tokens change: `--course-accent` becomes the ink colour, and `--subject-panel-tint` becomes the pastel mixed 38% with white. A new `--course-pastel` token is added. Dark mode keeps its own light-on-dark accents and derives the tints with `color-mix` as it does today.

## Page structure (top to bottom)

1. **Hero:** full-bleed artwork with the headline layered between a background image and a cut-out foreground (arches, trees, spires).
   - The foreground moves slightly slower than the headline as you scroll, using a CSS scroll-driven animation inside `@supports (animation-timeline: scroll())`. No JavaScript, and it's disabled under `prefers-reduced-motion`.
   - The picker bar sits over the faded bottom edge.
   - The site header keeps its existing transparent-over-hero behaviour (`.landing-editorial`).
   - The hero stays light in dark mode, as it does today.
2. **Try one now:** a short line, a product screenshot of a real free-year 0580 question with its mark-scheme card overlapping it, and a "Try free questions" link.
   - The screenshot is a static WebP captured from the public free tier. No signed asset requests are made from the landing page.
3. **Catalog:** `id="question-banks"`, so existing `/#question-banks` links keep working. It has the toggle and colour-block cards, and every bank links to `bankEntryHref(slug)`.
4. **Free vs plan:** a dark navy band.
   - The headline is "The newest papers are the ones that count."
   - A year strip comes from `bankYearFacts("igcse")`, with free years muted and paid years cobalt.
   - Three plan prices come from `PRICING_MODEL`: One bank, 2–5 banks and All banks.
   - "See plans" links to `/pricing`.
5. **FAQ:** the existing four `HOME_FAQS` with "View all FAQs" and the contact email (unchanged behaviour).
6. **Final CTA:** one serif line and a button to `#question-banks`.

**Removed:**
- the old hero (Georgetown engraving, "Practice the topics you need.")
- the "From topic to finished practice set" workflow band
- the "Backed by learning science" research section
- the Flegel CTA artwork

## Behaviour

- The **picker bar** is a small client component.
  - Toggling the qualification switches the subject list; the default is IGCSE with 0580 selected.
  - The subject `<select>` lists the enabled banks for that qualification, using `getCatalogRuntimeBanks`, so release flags are respected.
  - "Start free" is a real link to `bankEntryHref(selected)`, so it works without JavaScript for the default selection.
  - If a qualification has no enabled banks, its toggle option is not rendered.
- The **catalog toggle** reuses `QualificationTabs`, keeping the tablist keyboard contract: arrows, Home and End.
- **Proof numbers** are computed from the enabled banks, never hard-coded.

## Assets

- `public/artwork/landing-gothic.webp` (background) and `public/artwork/landing-gothic-front.webp` (alpha cut-out). Both are derived from the owner's PNG; the sky is removed by flood fill from the top edge with a feathered edge.
- `public/artwork/landing-gothic-source.md`: provenance note.
- `public/landing/sample-question.webp` and `public/landing/sample-markscheme.webp`: cropped from the public free tier. The owner can veto these in review; if so, the section falls back to a text-only card.
- All images are served through `next/image`. The hero background gets `priority`; everything else lazy-loads.

## Constraints

- The page stays static: no new route handlers and no request-time data.
- Copy stays minimal, following the owner's preference for short copy.
- Accessibility:
  - every control is keyboard-reachable with a visible focus ring
  - the decorative artwork has `alt=""` and `aria-hidden`
  - the headline is a real `<h1>`
  - the select has a label
  - touch targets are at least 44px
- No layout shift: the hero image box has a fixed aspect ratio.
- Mobile at 390px wide: the hero crops to 4:5 centred on the skyline, the picker bar stacks, and the catalog becomes one column.

## Testing

- Rewrite `src/app/page.test.tsx` for the new structure. It covers:
  - the headline
  - the picker default href and switching
  - the catalog links: all 19 banks, `?free=1` hrefs, one link per bank, no nested links
  - the tablist keyboard contract
  - the FAQ preview
  - gated banks not advertised
  - proof numbers from data
  - the free-vs-plan years and prices drawn from the model
- Update `ux-polish-style-contract.test.ts`: replace the old landing-panel contracts with new ones (each bank row draws a box and has a hover state; the subject card paints `--subject-panel-tint`; the toggle has a selected background and a focus ring). Keep the shared tone-token contract, so every tone defines `--subject-panel-tint`.
- Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` before opening the PR.
- Visually check desktop at 1440, mobile at 390, and dark mode.

## Out of scope

- Performance work beyond keeping the page static. The parallel speed session owns that.
- Changes to bank, pricing or dashboard layouts. They only pick up the new tokens and font.
- Merging or deploying, which needs the owner's go-ahead on the PR.

## Revision 2 (owner review, 11 October 2026)

- **Header (site-wide):** a floating rounded pill. On phones it shows the logo, the theme toggle and a menu button. The menu opens a rounded panel with the links easing in (no animation under reduced motion). Escape, a tap outside the header or picking a link closes it.
- **Hero:** the artwork starts below the header, and the headline sits lower.
- **Removed:** the "Try one now" sample section and its images. The page goes straight from the hero to the bank toggle.
- **Proof:** a dark band with archive stats from data (questions, papers, banks, exam years) and the three cited studies, restored and restyled.
- **Free vs plan:** two plain cards. Free ($0: older years, answers, no card) and Plan (from $6/mo: every year up to the latest, every mark scheme, cancel any time).
- **Order:** hero → banks → proof → plan → FAQ → CTA.
- **Testimonials or user counts:** none are added until the owner supplies real ones.
