import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist" }),
  IBM_Plex_Mono: () => ({ variable: "--font-mono" }),
  Young_Serif: () => ({ variable: "--font-young-serif" }),
}));

import { metadata as rootMetadata } from "@/app/layout";
import { metadata as homeMetadata } from "@/app/page";
import { metadata as pricingMetadata } from "@/app/pricing/page";
import { metadata as loginMetadata } from "@/app/login/page";
import { metadata as accountMetadata } from "@/app/account/layout";
import { metadata as authMetadata } from "@/app/auth/layout";
import { metadata as dashboardMetadata } from "@/app/dashboard/layout";
import { generateMetadata as generateBankMetadata } from "@/app/banks/[slug]/page";
import { generateMetadata as generateSyllabusMetadata } from "@/app/syllabus/[bankSlug]/page";
import { metadata as igcseHubMetadata } from "@/app/cambridge-igcse/page";
import { metadata as ibHubMetadata } from "@/app/ib/page";
import { BANK_CATALOG } from "@/lib/catalog";
import { subjectSearchName } from "@/lib/past-paper-seo";
import { BANKS } from "@/lib/banks";
import { hasPublishedExplanations } from "@/lib/explanations";

const expectPrivate = (metadata: typeof accountMetadata) => {
  expect(metadata.robots).toMatchObject({ index: false, follow: false, nocache: true });
};

describe("canonical search metadata", () => {
  it("describes the site globally without forcing one canonical onto child routes", () => {
    expect(rootMetadata.metadataBase?.toString()).toBe("https://pastpaperprep.com/");
    expect(rootMetadata.alternates).toBeUndefined();
    expect(rootMetadata.applicationName).toBe("PastPaperPrep");
    expect(rootMetadata.openGraph).toMatchObject({
      siteName: "PastPaperPrep",
      type: "website",
      locale: "en_US",
    });
    expect(rootMetadata.openGraph).toMatchObject({
      images: [{
        url: "/pastpaperprep-share.png",
        width: 1200,
        height: 630,
        alt: expect.stringMatching(/PastPaperPrep/i),
      }],
    });
    expect(rootMetadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["/pastpaperprep-share.png"],
    });
  });

  it("ships the dedicated social card at the declared dimensions", () => {
    const image = readFileSync(join(process.cwd(), "public/pastpaperprep-share.png"));
    expect(image.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(image.readUInt32BE(16)).toBe(1200);
    expect(image.readUInt32BE(20)).toBe(630);
    expect(image.byteLength).toBeLessThan(5_000_000);
  });

  it("gives the homepage and pricing page distinct canonical metadata", () => {
    expect(homeMetadata.title).toEqual({ absolute: "Free IGCSE & IB Past Papers by Topic | PastPaperPrep" });
    expect(homeMetadata.alternates?.canonical).toBe("/");
    expect(homeMetadata.openGraph).toMatchObject({
      url: "/",
      type: "website",
      images: [{ url: "/pastpaperprep-share.png", width: 1200, height: 630 }],
    });
    expect(pricingMetadata.alternates?.canonical).toBe("/pricing");
    expect(pricingMetadata.openGraph).toMatchObject({ images: [{ url: "/pastpaperprep-share.png" }] });
    expect(pricingMetadata.description).toMatch(/IGCSE and IB Maths/i);
    expect(pricingMetadata.description).toMatch(/Chemistry/i);
    expect(pricingMetadata.description).toMatch(/Economics/i);
  });

  it("canonicalizes every filterable bank to its clean landing URL", async () => {
    for (const bank of BANKS) {
      const metadata = await generateBankMetadata({ params: Promise.resolve({ slug: bank.slug }) });
      const title = typeof metadata.title === "string" ? metadata.title : (metadata.title as { absolute: string }).absolute;
      expect(title).toMatch(/ Topical Past Papers?(?: Questions)?$/);
      expect(typeof metadata.title === "string" ? `${title} | PastPaperPrep`.length : title.length).toBeLessThanOrEqual(60);
      expect(title).not.toMatch(/Past Papers by Topic|& Mark Schemes/);
      expect(metadata.alternates?.canonical).toBe(`/banks/${bank.slug}`);
      expect(metadata.openGraph).toMatchObject({
        url: `/banks/${bank.slug}`,
        type: "website",
        images: [{ url: "/pastpaperprep-share.png" }],
      });
      expect(metadata.twitter).toMatchObject({ images: ["/pastpaperprep-share.png"] });
    }
  });

  it("keeps login and authenticated application surfaces out of the index", () => {
    expectPrivate(loginMetadata);
    expectPrivate(accountMetadata);
    expectPrivate(authMetadata);
    expectPrivate(dashboardMetadata);
  });

  it("advertises worked explanations only for banks with published question-level coverage", async () => {
    for (const bank of BANKS) {
      const metadata = await generateBankMetadata({ params: Promise.resolve({ slug: bank.slug }) });
      expect(metadata.description!.includes("worked explanations"), bank.slug).toBe(hasPublishedExplanations(bank.slug));
      expect(metadata.description!.length).toBeLessThanOrEqual(160);
    }
  });
  it("names syllabus pages the way students search for them", async () => {
    for (const bank of BANK_CATALOG) {
      const metadata = await generateSyllabusMetadata({ params: Promise.resolve({ bankSlug: bank.slug }) });
      const title = (metadata.title as { absolute: string }).absolute;
      expect(title, bank.slug).toMatch(new RegExp(`^${subjectSearchName(bank)} Syllabus`));
      expect(title.length, title).toBeLessThanOrEqual(60);
      expect(metadata.description!.length, metadata.description!).toBeLessThanOrEqual(160);
    }
    const ib = await generateSyllabusMetadata({ params: Promise.resolve({ bankSlug: "ib-biology-hl" }) });
    expect(ib.title).toEqual({ absolute: "IB Biology HL Syllabus: Topics, Papers and Marks" });
    expect(ib.description).toContain("(first assessment 2025)");
    expect(JSON.stringify(igcseHubMetadata)).toMatch(/0580.*0606.*0610.*0620.*0625.*0654.*0455/);
    expect(ibHubMetadata.title).toBe("IB Past Papers by Topic: Maths, Sciences and Economics");
  });
});
