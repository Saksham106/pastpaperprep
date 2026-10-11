import { describe, expect, it } from "vitest";
import { assetOriginsForBank } from "@/lib/asset-origins";

const env = { NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co", R2_ACCOUNT_ID: "92278648535014b5231edfe207b9391d" };

describe("asset origins", () => {
  it("preconnects Supabase for Supabase-backed banks", () => {
    expect(assetOriginsForBank("ib-sl", env)).toEqual(["https://abc.supabase.co"]);
  });

  it("adds the R2 origin for R2-backed banks", () => {
    expect(assetOriginsForBank("igcse-chemistry-0620", env)).toEqual([
      "https://abc.supabase.co",
      "https://92278648535014b5231edfe207b9391d.r2.cloudflarestorage.com",
    ]);
  });

  it("skips malformed values", () => {
    expect(assetOriginsForBank("igcse-chemistry-0620", { NEXT_PUBLIC_SUPABASE_URL: "nope", R2_ACCOUNT_ID: "x" })).toEqual([]);
  });
});
