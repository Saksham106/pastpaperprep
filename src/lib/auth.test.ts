import { describe, expect, it } from "vitest";
import { isLikelyOrganizationEmail, isValidEmail, isValidEmailCode, isValidPassword, normalizeEmailCode, safeNextPath } from "./auth";

describe("safeNextPath", () => {
  it("allows an internal application path", () => {
    expect(safeNextPath("/account?tab=access")).toBe("/account?tab=access");
  });

  it("rejects absolute and protocol-relative redirects", () => {
    expect(safeNextPath("https://evil.example")).toBe("/pricing");
    expect(safeNextPath("//evil.example")).toBe("/pricing");
    expect(safeNextPath("/\\evil.example")).toBe("/pricing");
  });

  it("rejects paths that URL parsing would turn into another origin", () => {
    // WHATWG URL parsing strips tab, CR, and LF, so "/\t/evil.example" resolves to //evil.example.
    for (const control of ["\t", "\n", "\r"]) {
      expect(safeNextPath(`/${control}/evil.example`)).toBe("/pricing");
      expect(safeNextPath(`${control}//evil.example`)).toBe("/pricing");
    }
    expect(safeNextPath("/\u0000/evil.example")).toBe("/pricing");
  });

  it("keeps encoded characters inside the path", () => {
    expect(safeNextPath("/%09/evil.example")).toBe("/%09/evil.example");
  });

  it("uses pricing when no path is supplied so sign-in leads to a clear upgrade step", () => {
    expect(safeNextPath(null)).toBe("/pricing");
  });
});

describe("isValidEmail", () => {
  it("accepts a normal email after trimming", () => {
    expect(isValidEmail("  student@example.com ")).toBe(true);
  });

  it("rejects malformed or oversized addresses", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail(`${"a".repeat(250)}@example.com`)).toBe(false);
  });
});

describe("isValidPassword", () => {
  it("accepts a practical passphrase", () => {
    expect(isValidPassword("three calm otters")).toBe(true);
  });

  it("rejects short and oversized passwords", () => {
    expect(isValidPassword("short123")).toBe(false);
    expect(isValidPassword("x".repeat(73))).toBe(false);
  });
});

describe("email codes", () => {
  it("accepts pasted codes with spaces or dashes and rejects anything that is not digits", () => {
    expect(normalizeEmailCode(" 1234 5678 ")).toBe("12345678");
    expect(normalizeEmailCode("1234-5678")).toBe("12345678");
    expect(isValidEmailCode("12345678")).toBe(true);
    expect(isValidEmailCode("12345")).toBe(false);
    expect(isValidEmailCode("1234567a")).toBe(false);
  });
});

describe("isLikelyOrganizationEmail", () => {
  it("flags school and work domains but not personal providers", () => {
    expect(isLikelyOrganizationEmail("student@pupils.school.example")).toBe(true);
    expect(isLikelyOrganizationEmail("teacher@school.example")).toBe(true);
    expect(isLikelyOrganizationEmail("Student@Gmail.com")).toBe(false);
    expect(isLikelyOrganizationEmail("someone@outlook.com")).toBe(false);
    expect(isLikelyOrganizationEmail("not-an-email")).toBe(false);
  });
});
