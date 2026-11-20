import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import runtime from "@/data/production/a-level-maths-9709.json";
import { metadata as hubMetadata } from "@/app/cambridge-a-level/page";
import { metadata as homeMetadata } from "@/app/page";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { bankGroupsByBoard } from "@/lib/bank-groups";
import { inBoardSubjectOrder } from "@/lib/catalog";
import { routeConfigFor } from "@/lib/course-route";
import { BOARD_SUBJECT_ORDER, QUALIFICATIONS } from "@/lib/qualifications";
import { normalizeBankQuestions } from "@/lib/questions";
import { PDF_TESTIMONIAL, SIGNUP_GATE_TESTIMONIAL, bankTestimonial, testimonialForBank, topicTestimonial } from "@/lib/testimonials";

// Owner's pre-launch polish for A Level (2026-11-18, "Yes, fix first").

describe("A Level subject order", () => {
  it("is Mathematics, Chemistry, Physics, Biology, Economics from one shared source", () => {
    expect(BOARD_SUBJECT_ORDER["a-level"]).toEqual(["Mathematics", "Chemistry", "Physics", "Biology", "Economics"]);
  });

  it("reorders A Level banks within their own slots and leaves every other bank in place", () => {
    const banks = [
      { slug: "igcse", qualification: "Cambridge IGCSE", subject: "Mathematics" },
      { slug: "a-level-economics-9708", qualification: "Cambridge A Level", subject: "Economics" },
      { slug: "a-level-biology-9700", qualification: "Cambridge A Level", subject: "Biology" },
      { slug: "a-level-physics-9702", qualification: "Cambridge A Level", subject: "Physics" },
      { slug: "ib-sl", qualification: "IB Diploma", subject: "Mathematics" },
      { slug: "a-level-chemistry-9701", qualification: "Cambridge A Level", subject: "Chemistry" },
      { slug: "a-level-maths-9709", qualification: "Cambridge A Level", subject: "Mathematics" },
    ];
    expect(inBoardSubjectOrder(banks).map((bank) => bank.slug)).toEqual(["igcse", "a-level-maths-9709", "a-level-chemistry-9701", "a-level-physics-9702", "ib-sl", "a-level-biology-9700", "a-level-economics-9708"]);
    // The pricing pickers group the display list, so they inherit the order.
    const groups = bankGroupsByBoard(inBoardSubjectOrder(banks), (bank) => ({ board: QUALIFICATIONS[bank.qualification === "Cambridge A Level" ? "a-level" : bank.qualification === "IB Diploma" ? "ib" : "igcse"].id, subject: bank.subject }));
    expect(groups.find((group) => group.board === "a-level")?.banks.map((bank) => bank.subject)).toEqual(["Mathematics", "Chemistry", "Physics", "Biology", "Economics"]);
  });
});

describe("testimonials on A Level pages", () => {
  it("shows no quote from another board until there are A Level ones", () => {
    for (const slug of ["a-level-maths-9709", "a-level-physics-9702", "a-level-chemistry-9701", "a-level-biology-9700", "a-level-economics-9708"]) {
      expect(bankTestimonial(slug)).toBeUndefined();
      expect(topicTestimonial(slug)).toBeUndefined();
      expect(testimonialForBank(slug, PDF_TESTIMONIAL)).toBeUndefined();
      expect(testimonialForBank(slug, SIGNUP_GATE_TESTIMONIAL)).toBeUndefined();
    }
  });

  it("leaves IGCSE and IB pages as they were", () => {
    expect(bankTestimonial("igcse-chemistry-0620")?.name).toBe("Leah W.");
    expect(bankTestimonial("ib-sl")).toBeDefined();
    expect(topicTestimonial("igcse-biology-0610")?.name).toBe("Carlos V.");
    expect(testimonialForBank("ib-hl", SIGNUP_GATE_TESTIMONIAL)).toBe(SIGNUP_GATE_TESTIMONIAL);
  });
});

describe("titles and labels", () => {
  it("names A Level in the home title and keeps the hub title board-level", () => {
    expect(homeMetadata.title).toEqual({ absolute: "Free IGCSE, A Level & IB Past Papers by Topic | PastPaperPrep" });
    expect(homeMetadata.openGraph?.title).toBe("Free IGCSE, A Level & IB Past Papers by Topic | PastPaperPrep");
    expect(hubMetadata.title).toBe("Cambridge A Level Past Papers by Topic");
    expect(hubMetadata.openGraph?.title).toBe("Cambridge A Level Past Papers by Topic | PastPaperPrep");
    expect(JSON.stringify(hubMetadata)).not.toMatch(/9709|IGCSE & IB/);
  });

  it("labels the IGCSE group Cambridge IGCSE so it can't be read as including A Level", () => {
    expect(QUALIFICATIONS.igcse.groupLabel).toBe("Cambridge IGCSE");
  });

  it("calls the 9709 statistics tabs Stats 1 and Stats 2, keeping the paper sublabels", () => {
    const options = routeConfigFor("a-level-maths-9709")!.options.slice(4);
    expect(options.map((option) => [option.label, option.detail])).toEqual([["Stats 1", "Paper 5"], ["Stats 2", "Paper 6"]]);
  });
});

describe("9709 explorer", () => {
  const questions = normalizeBankQuestions("a-level-maths-9709", runtime.questions as unknown as Array<Record<string, unknown>>).filter((question) => question.year === 2021).slice(0, 40);
  const access = { authenticated: true, bankAccess: true, canExportPdf: true };
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ expiresIn: 600, assets: [] }), { status: 200, headers: { "content-type": "application/json" } })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("wraps its seven paper tabs (no sideways scroll on phones) and heads the variant filter Variant", () => {
    const { container } = render(<QuestionExplorer questions={questions} bankSlug="a-level-maths-9709" access={access} />);
    const picker = container.querySelector(".course-route-picker")!;
    expect(picker.classList.contains("is-wrapping-tabs")).toBe(true);
    expect(picker.querySelectorAll("label")).toHaveLength(7);
    // The variant filter sits under "More filters" (closed, so hidden from the accessibility tree).
    expect(screen.getAllByRole("heading", { name: "Variant", hidden: true }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: /Time zone/, hidden: true })).toBeNull();
  });
});

describe("Physics 9702 under the same rules", () => {
  it("lists Mathematics, Chemistry, Physics, Biology, Economics, whatever the catalog order", async () => {
    const { getCatalogBanksForDisplay } = await import("@/lib/catalog");
    const preview = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
    expect(getCatalogBanksForDisplay(preview).filter((bank) => bank.qualification === "Cambridge A Level").map((bank) => bank.slug)).toEqual(["a-level-maths-9709", "a-level-chemistry-9701", "a-level-physics-9702", "a-level-biology-9700", "a-level-economics-9708"]);
  });

  it("keeps its four paper tabs in one row", () => {
    const { container } = render(<QuestionExplorer questions={[]} bankSlug="a-level-physics-9702" access={{ authenticated: true, bankAccess: true, canExportPdf: true }} />);
    const picker = container.querySelector(".course-route-picker")!;
    expect(picker.querySelectorAll("label")).toHaveLength(4);
    expect(picker.classList.contains("is-paper-tabs")).toBe(true);
    expect(picker.classList.contains("is-wrapping-tabs")).toBe(false);
  });
});

describe("Chemistry 9701 under the same rules", () => {
  it("keeps its four paper tabs in one row", () => {
    const { container } = render(<QuestionExplorer questions={[]} bankSlug="a-level-chemistry-9701" access={{ authenticated: true, bankAccess: true, canExportPdf: true }} />);
    const picker = container.querySelector(".course-route-picker")!;
    expect(picker.querySelectorAll("label")).toHaveLength(4);
    expect(picker.classList.contains("is-paper-tabs")).toBe(true);
    expect(picker.classList.contains("is-wrapping-tabs")).toBe(false);
  });
});

describe("Biology 9700 under the same rules", () => {
  it("keeps its four paper tabs in one row", () => {
    const { container } = render(<QuestionExplorer questions={[]} bankSlug="a-level-biology-9700" access={{ authenticated: true, bankAccess: true, canExportPdf: true }} />);
    const picker = container.querySelector(".course-route-picker")!;
    expect(picker.querySelectorAll("label")).toHaveLength(4);
    expect(picker.classList.contains("is-paper-tabs")).toBe(true);
    expect(picker.classList.contains("is-wrapping-tabs")).toBe(false);
  });
});

describe("Economics 9708 under the same rules", () => {
  it("wraps its five paper tabs, AS before A Level and multiple choice before written", () => {
    const { container } = render(<QuestionExplorer questions={[]} bankSlug="a-level-economics-9708" access={{ authenticated: true, bankAccess: true, canExportPdf: true }} />);
    const picker = container.querySelector(".course-route-picker")!;
    expect([...picker.querySelectorAll("label")].map((label) => label.textContent)).toEqual(["All papersPapers 1–4", "AS multiple choicePaper 1", "AS writtenPaper 2", "A Level multiple choicePaper 3", "A Level writtenPaper 4"]);
    expect(picker.classList.contains("is-paper-tabs")).toBe(true);
    expect(picker.classList.contains("is-wrapping-tabs")).toBe(true);
  });
});
