import { describe, expect, it } from "vitest";
import { boundExceptionFrames, scrubStack } from "./error-privacy";

describe("boundExceptionFrames", () => {
  it("keeps the posthog-js frame platform, which PostHog needs to group and symbolicate", () => {
    const [frame] = boundExceptionFrames([{ filename: "https://pastpaperprep.com/_next/static/immutable/chunks/2-1lhd-k82oxe.js", lineno: 1, colno: 3739, platform: "web:javascript", function: "O" }]);
    expect(frame.platform).toBe("web:javascript");
  });
  it("still drops a platform that is not a plain identifier", () => {
    const [frame] = boundExceptionFrames([{ filename: "https://pastpaperprep.com/_next/static/immutable/chunks/2-1lhd-k82oxe.js", platform: "web:javascript user@example.com" }]);
    expect(frame.platform).toBeUndefined();
  });
});

describe("real browser and server frame formats", () => {
  it("retains the immutable chunk prefix served by the actual Vercel build", () => {
    expect(scrubStack("TypeError: private message\n    at render (https://pastpaperprep.com/_next/static/immutable/chunks/0bqrzw0nf0wio.js:12:8)", "TypeError"))
      .toContain("https://pastpaperprep.com/_next/static/immutable/chunks/0bqrzw0nf0wio.js:12:8");
  });
  it("retains line and column on normal Chrome generated chunk frames", () => {
    expect(scrubStack("TypeError: private message\n    at render (https://pastpaperprep.com/_next/static/chunks/2dwlnrg2u4gi9.js:12:8)", "TypeError"))
      .toContain("https://pastpaperprep.com/_next/static/chunks/2dwlnrg2u4gi9.js:12:8");
  });
  it("retains Safari frames, including the first frame when no message header exists", () => {
    expect(scrubStack("render@https://pastpaperprep.com/_next/static/chunks/2dwlnrg2u4gi9.js:12:8\nclick@https://pastpaperprep.com/_next/static/chunks/001p9wrvf51nf.js:6:2", "TypeError"))
      .toContain("render@https://pastpaperprep.com/_next/static/chunks/2dwlnrg2u4gi9.js:12:8");
  });
  it("retains a Vercel Node application frame so server exceptions have usable source maps", () => {
    expect(scrubStack("Error: private message\n    at POST (/var/task/.next/server/chunks/[root-of-the-server]__0kqxo9u._.js:22:4)", "Error"))
      .toContain("/var/task/.next/server/chunks/[root-of-the-server]__0kqxo9u._.js:22:4");
  });
  it("drops unknown nested static paths and local user directories", () => {
    const safe = scrubStack("Error: private\n at render (https://pastpaperprep.com/_next/static/private-customer-record/main.js:2:4)\n at read (/Users/private-person/project/app.js:2:4)", "Error");
    expect(safe).not.toMatch(/private-customer|private-person/);
  });
});
