import { describe, expect, it } from "vitest";
import { bankTestimonial, HOME_TESTIMONIALS, PRICING_TESTIMONIALS, topicTestimonial } from "@/lib/testimonials";

describe("testimonials", () => {
  it("shows a bank's own quote when it has one", () => {
    expect(bankTestimonial("igcse-chemistry-0620").name).toBe("Leah W.");
  });

  it("shows Carlos's biology quote on the 0610 bank and its topic pages only", () => {
    expect(bankTestimonial("igcse-biology-0610").name).toBe("Carlos V.");
    expect(topicTestimonial("igcse-biology-0610").name).toBe("Carlos V.");
    expect(topicTestimonial("igcse").name).toBe("Ji-woo P.");
  });

  it("picks the same general quote for a bank every time", () => {
    expect(bankTestimonial("igcse")).toBe(bankTestimonial("igcse"));
    expect(bankTestimonial("ib-hl").quote).toBeTruthy();
  });

  it("keeps every quote attributed", () => {
    for (const entry of [...HOME_TESTIMONIALS, ...PRICING_TESTIMONIALS]) {
      expect(entry.name.trim()).not.toBe("");
      expect(entry.detail.trim()).not.toBe("");
    }
  });
});
