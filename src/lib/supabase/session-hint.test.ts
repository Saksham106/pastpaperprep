import { afterEach, describe, expect, it } from "vitest";
import { SESSION_HINT_SCRIPT } from "@/lib/supabase/auth-cookie";

const runHint = (cookie: string) => {
  Object.defineProperty(document, "cookie", { configurable: true, get: () => cookie });
  new Function(SESSION_HINT_SCRIPT)();
  return document.documentElement.dataset.session;
};

describe("session hint script", () => {
  afterEach(() => { delete document.documentElement.dataset.session; });

  it("marks browsers holding a Supabase auth cookie, including chunked ones", () => {
    expect(runHint("ph_consent=1; sb-abc123-auth-token=base64-xyz")).toBe("1");
    delete document.documentElement.dataset.session;
    expect(runHint("sb-abc123-auth-token.0=part")).toBe("1");
  });

  it("leaves anonymous browsers unmarked", () => {
    expect(runHint("ph_consent=1; theme=dark")).toBeUndefined();
    expect(runHint("")).toBeUndefined();
  });
});
