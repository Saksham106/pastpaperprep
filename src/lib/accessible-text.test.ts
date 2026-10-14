import { describe, expect, it } from "vitest";
import { cleanAccessibleText } from "@/lib/accessible-text";

describe("cleanAccessibleText", () => {
  it("drops page footers, margin labels and barcode glyph runs but keeps the question", () => {
    const raw = "............. [2] ,\u0001\u0001\u0001, ĬÍĊ¾Ġ´íÈõÏĪÅĊÝü¸þ× ĬÝğüÏĝĝğåîýØĞ°ĤěíĂ DO NOT WRITE IN THIS MARGIN   DO NOT WRITE IN THIS MARGIN 3 0610/32/F/M/25 © UCLES 2025 [Turn over (c) Fig. 1.1 shows a reaction catalysed by an enzyme.";
    expect(cleanAccessibleText(raw)).toBe("… [2] 3 (c) Fig. 1.1 shows a reaction catalysed by an enzyme.");
  });

  it("drops the closing copyright notice and BLANK PAGE", () => {
    const raw = "D They have a slow reproduction rate. 15 © UCLES 2025 0610/12/F/M/25 BLANK PAGE 16 Permission to reproduce items where third-party owned material protected by copyright is included has been sought and cleared where possible.";
    expect(cleanAccessibleText(raw)).toBe("D They have a slow reproduction rate. 15 16");
  });

  it("drops the 2026 footer and a leading footer before the question", () => {
    expect(cleanAccessibleText("© Cambridge University Press & Assessment 2026 0606/11/M/J/26 [Turn over 4 Solve")).toBe("4 Solve");
    expect(cleanAccessibleText("© UCLES 2025 0610/12/F/M/25 [Turn over 4 The photomicrograph shows part of an animal cell.")).toBe("4 The photomicrograph shows part of an animal cell.");
  });

  it("turns dotted answer lines into a single ellipsis and removes stray commas left by control characters", () => {
    expect(cleanAccessibleText("x = ................................................ [2]")).toBe("x = … [2]");
    expect(cleanAccessibleText("natural number. ......... [1] ,\u0001\u0001\u0001\u0001 \u0001\u0001\u0001,")).toBe("natural number. … [1]");
  });

  it("leaves real wording, symbols, accents and in-text commas alone", () => {
    for (const text of [
      "7 (a) Solve, for 0° ≤ θ ≤ 360°, the equation 2 sin θ = 1. [3]",
      "Café owners in São Paulo, Brazil, raise prices by 5%.",
      "The sequence is 2, 4, 8, 16, …",
      "3 NOT TO SCALE 45° 65° y° x° The diagram shows two straight lines.",
      "vector v is defined as v = (a · c)b − (a · b)c. (a) Show that v · a = 0. [2]",
      "(a) Find the equation of\n    (i) the vertical asymptote;\n    (ii) the horizontal asymptote.",
      "Find the coordinates (2 , 3) and (x , y).",
    ]) expect(cleanAccessibleText(text)).toBe(text);
  });

  it("keeps paragraph breaks", () => {
    expect(cleanAccessibleText("1. [Maximum mark: 6]\n\nIn a group of 20 students\n\n\n\n(a) Find")).toBe("1. [Maximum mark: 6]\n\nIn a group of 20 students\n\n(a) Find");
  });

  it("does not treat a short run of accented letters as a barcode", () => {
    expect(cleanAccessibleText("Łódź is a city.")).toBe("Łódź is a city.");
  });
});
