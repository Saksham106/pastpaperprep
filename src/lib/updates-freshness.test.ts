import { describe, expect, it } from "vitest";
import { bankLastUpdated, formatUpdateDate, lastUpdated, UPDATES } from "@/lib/updates";

describe("changelog freshness dates", () => {
  it("uses the newest changelog entry for the site", () => {
    expect(lastUpdated()).toBe(UPDATES.map(({ date }) => date).sort().at(-1));
  });

  it("dates a bank by the newest entry linking to its topic bank or full papers", () => {
    const linked = UPDATES.filter((update) => JSON.stringify(update.links ?? []).match(/"\/banks\/igcse-computer-science-0478"|"\/past-papers\/igcse-computer-science-0478/));
    expect(bankLastUpdated("igcse-computer-science-0478")).toBe(linked.map(({ date }) => date).sort().at(-1));
  });

  it("does not let one bank's path prefix match another bank", () => {
    // "/banks/igcse" must not pick up "/banks/igcse-chemistry-0620" updates.
    const own = UPDATES.filter((update) => JSON.stringify(update.links ?? []).match(/"\/banks\/igcse(["/?])|"\/past-papers\/igcse-maths-0580/));
    expect(bankLastUpdated("igcse")).toBe(own.map(({ date }) => date).sort().at(-1));
  });

  it("returns nothing for a path no update links to", () => {
    expect(lastUpdated(["/no-such-page"])).toBeUndefined();
  });

  it("formats dates without locale ambiguity", () => {
    expect(formatUpdateDate("2026-10-05")).toBe("5 Oct 2026");
  });
});
