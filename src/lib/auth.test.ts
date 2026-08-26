import { describe, expect, it } from "vitest";
import { isValidEmail, isValidPassword, safeNextPath } from "./auth";

describe("safeNextPath", () => {
  it("allows an internal application path", () => {
    expect(safeNextPath("/account?tab=access")).toBe("/account?tab=access");
  });

  it("rejects absolute and protocol-relative redirects", () => {
    expect(safeNextPath("https://evil.example")).toBe("/pricing");
    expect(safeNextPath("//evil.example")).toBe("/pricing");
    expect(safeNextPath("/\\evil.example")).toBe("/pricing");
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
