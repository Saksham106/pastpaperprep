import { describe, expect, it } from "vitest";
import { BANK_CATALOG, type BankSlug } from "@/lib/catalog";
import { aLevelSuccessors, igcsePredecessors, takenAlongside } from "@/lib/next-step-banks";

const LIVE = { PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const slugs = (slug: BankSlug, env: Record<string, string | undefined> = LIVE) => aLevelSuccessors(slug, env).map((bank) => bank.slug);

describe("IGCSE to A Level next steps", () => {
  it("points each IGCSE course at its A Level successor", () => {
    expect(slugs("igcse")).toEqual(["a-level-maths-9709"]);
    expect(slugs("igcse-additional")).toEqual(["a-level-maths-9709", "a-level-further-maths-9231"]);
    expect(slugs("igcse-physics-0625")).toEqual(["a-level-physics-9702"]);
    expect(slugs("igcse-coordinated-sciences-0654")).toEqual(["a-level-physics-9702", "a-level-chemistry-9701", "a-level-biology-9700"]);
    expect(slugs("igcse-economics-0455")).toEqual(["a-level-economics-9708"]);
    expect(slugs("igcse-computer-science-0478")).toEqual(["a-level-computer-science-9618"]);
    expect(slugs("ib-hl")).toEqual([]);
  });

  it("only links A Level banks that are displayed", () => {
    expect(slugs("igcse", {})).toEqual([]);
  });

  it("names only real catalogue banks, and reverses cleanly", () => {
    const catalog = new Set(BANK_CATALOG.map((bank) => bank.slug));
    for (const bank of BANK_CATALOG) for (const next of aLevelSuccessors(bank.slug, LIVE)) expect(catalog.has(next.slug)).toBe(true);
    expect(igcsePredecessors("a-level-maths-9709", LIVE).map((bank) => bank.slug)).toEqual(["igcse", "igcse-additional"]);
    expect(igcsePredecessors("a-level-further-maths-9231", LIVE).map((bank) => bank.slug)).toEqual(["igcse-additional"]);
    expect(igcsePredecessors("a-level-computer-science-9618", LIVE).map((bank) => bank.slug)).toEqual(["igcse-computer-science-0478"]);
  });
});

describe("courses taken alongside another", () => {
  it("pairs Further Maths 9231 with Maths 9709, so copy says alongside, not instead", () => {
    const next = aLevelSuccessors("igcse-additional", LIVE);
    expect(takenAlongside("a-level-further-maths-9231", next)?.slug).toBe("a-level-maths-9709");
    expect(takenAlongside("a-level-maths-9709", next)).toBeUndefined();
    expect(takenAlongside("a-level-further-maths-9231", next.filter((bank) => bank.slug !== "a-level-maths-9709"))).toBeUndefined();
  });
});
