import { describe, expect, it } from "vitest";
import { isValidEmail, safeNextPath } from "./auth";

describe("safeNextPath", () => {
  it("allows an internal application path", () => {
    expect(safeNextPath("/account?tab=access")).toBe("/account?tab=access");
  });

  it("rejects absolute and protocol-relative redirects", () => {
    expect(safeNextPath("https://evil.example")).toBe("/account");
    expect(safeNextPath("//evil.example")).toBe("/account");
    expect(safeNextPath("/\\evil.example")).toBe("/account");
  });

  it("uses the account page when no path is supplied", () => {
    expect(safeNextPath(null)).toBe("/account");
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
