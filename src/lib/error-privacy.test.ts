import { describe, expect, it } from "vitest";
import { boundExceptionFrames, isBrowserExtensionError, safeErrorMessage, scrubStack } from "./error-privacy";

describe("safeErrorMessage", () => {
  it("normalizes actual parser errors without retaining the parsed private input", () => {
    let error: unknown;
    try { JSON.parse("SyntheticPrivateName"); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(SyntaxError);
    expect(safeErrorMessage((error as Error).message)).toBe("Invalid JSON input");
  });
  it.each([
    'Invalid value "SyntheticAlphabeticSecret"',
    "Authentication failed: password: SyntheticAlphabeticSecret",
    "Customer Jane Smith cannot access account",
    "failed for alice@example.com password=hunter2",
  ])("fails closed for untrusted message %s", (message) => {
    expect(safeErrorMessage(message)).toBeUndefined();
  });
  it("keeps a useful JavaScript diagnostic without forwarding a dynamic property name", () => {
    expect(safeErrorMessage("Cannot read properties of undefined (reading 'SyntheticPrivateName')"))
      .toBe("Cannot read properties of undefined (reading '<property>')");
  });
  it("keeps only the code of a production React error, whose args can carry rendered text", () => {
    expect(safeErrorMessage("Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]=Alice for the full message")).toBe("React error #418");
  });
  it("keeps ordinary diagnostic messages, including code identifiers in quotes", () => {
    expect(safeErrorMessage("Cannot read properties of undefined (reading 'questionAssetPaths')")).toBe("Cannot read properties of undefined (reading 'questionAssetPaths')");
    expect(safeErrorMessage("Failed to fetch")).toBe("Failed to fetch");
    expect(safeErrorMessage("JWT issued at future")).toBe("JWT issued at future");
  });
  it("keeps Chromium's fixed closed- and errored-stream enqueue messages, and only those exact texts", () => {
    const closed = "Failed to execute 'enqueue' on 'ReadableStreamDefaultController': Cannot enqueue a chunk into a readable stream that is closed or has been requested to be closed";
    const errored = "Failed to execute 'enqueue' on 'ReadableStreamDefaultController': Cannot enqueue a chunk into an errored readable stream";
    expect(safeErrorMessage(closed)).toBe(closed);
    expect(safeErrorMessage(errored)).toBe(errored);
    expect(safeErrorMessage(`${closed} for alice@example.com`)).toBeUndefined();
    expect(safeErrorMessage("Failed to execute 'enqueue' on 'ReadableStreamDefaultController': Alice Smith")).toBeUndefined();
  });
  it("drops unrecognized text containing emails, URLs, ids, secrets and quoted prose", () => {
    const safe = safeErrorMessage("account alice@example.com token=secret at https://pastpaperprep.com/r/abc?x=1 user 7f1b6a2e-0000-4000-8000-000000000000 card 4242424242424242 jwt eyJhbGciOiJIUzI1NiIsInR5cCI6 said \"my name is Alice Smith\"");
    expect(safe).toBeUndefined();
  });
  it("redacts Stripe object ids and Postgres key values, which look like identifiers", () => {
    expect(safeErrorMessage("No such customer: 'cus_NffrFeUfNV2Hib'")).toBe("No such customer");
    expect(safeErrorMessage("Key (display_name)=(Alice Smith) already exists.")).toBe("Database key already exists");
  });
  it("drops non-ASCII text and bounds the length", () => {
    expect(safeErrorMessage("Ошибка for Zoë")).toBeUndefined();
    expect(safeErrorMessage(`x ${"word ".repeat(100)}`)).toBeUndefined();
    expect(safeErrorMessage(`Cannot read properties of undefined (reading '${"x".repeat(500)}')`)!.length).toBeLessThanOrEqual(200);
  });
  it("keeps a failed chunk's generated path, never the module id or the browser's cause text", () => {
    const path = "/_next/static/immutable/chunks/0c0hxoamwjsbw.js";
    expect(safeErrorMessage(`Failed to load chunk ${path} from module 12345: TypeError: Load failed for alice@example.com`)).toBe(`Failed to load chunk ${path}`);
    expect(safeErrorMessage(`Failed to load chunk ${path}?dpl=dpl_Secret123 as a runtime dependency of chunk /_next/static/immutable/chunks/x.js`)).toBe(`Failed to load chunk ${path}`);
    expect(safeErrorMessage(`Failed to load chunk https://pastpaperprep.com${path} from module 7`)).toBe(`Failed to load chunk ${path}`);
    // Already-safe output survives the SDK's second sanitization pass unchanged.
    expect(safeErrorMessage(`Failed to load chunk ${path}`)).toBe(`Failed to load chunk ${path}`);
  });
  it.each([
    "Failed to load chunk /r/alice@example.com from module 1",
    "Failed to load chunk /_next/static/immutable/chunks/a%40b.js from module 1",
    "Failed to load chunk Jane-Smith from module 1",
  ])("reports an unrecognised chunk location as <chunk>: %s", (message) => {
    expect(safeErrorMessage(message)).toBe("Failed to load chunk <chunk>");
  });
  it("keeps Safari's and Firefox's TypeError and ReferenceError shapes without the evaluated code", () => {
    expect(safeErrorMessage("undefined is not an object (evaluating 'user.profile.email')")).toBe("undefined is not an object (evaluating '<expression>')");
    expect(safeErrorMessage("null is not an object (evaluating 'document.querySelector(\"#alice@example.com\").value')")).toBe("null is not an object (evaluating '<expression>')");
    expect(safeErrorMessage("undefined is not an object")).toBe("undefined is not an object");
    expect(safeErrorMessage("t.at is not a function. (In 't.at(-1)', 't.at' is undefined)")).toBe("Value is not a function");
    expect(safeErrorMessage("Can't find variable: alice")).toBe("Can't find variable: <identifier>");
    expect(safeErrorMessage("Can't find variable: cooldown")).toBe("Can't find variable: cooldown");
    expect(safeErrorMessage("can't access property \"email\", user is undefined")).toBe("can't access property '<property>', value is undefined");
    expect(safeErrorMessage("can't access property 0, rows is null")).toBe("can't access property '<property>', value is null");
    expect(safeErrorMessage("user.email is undefined")).toBe("Value is undefined");
    expect(safeErrorMessage("Alice Smith token=abc is null")).toBe("Value is null");
  });

  it("maps every browser template to itself, since the SDK applies the boundary twice", () => {
    for (const raw of [
      "undefined is not an object (evaluating 'a.b')", "Can't find variable: alice", "can't access property \"x\", y is null",
      "user.email is undefined", "t.at is not a function. (In 't.at(-1)', 't.at' is undefined)",
      "Failed to fetch dynamically imported module: https://pastpaperprep.com/a.js",
    ]) {
      const once = safeErrorMessage(raw);
      expect(once).toBeDefined();
      expect(safeErrorMessage(once)).toBe(once);
    }
  });

  it("keeps the browsers' fixed loading, abort and observer messages", () => {
    for (const message of [
      "Importing a module script failed.", "The operation was aborted.", "signal is aborted without reason", "The user aborted a request.",
      "Script error.", "The network connection was lost.", "ResizeObserver loop completed with undelivered notifications.",
      "ResizeObserver loop limit exceeded", "The request timed out.", "cancelled",
    ]) expect(safeErrorMessage(message)).toBe(message);
    expect(safeErrorMessage("Failed to fetch dynamically imported module: https://pastpaperprep.com/_next/static/chunks/abc.js?token=secret")).toBe("Failed to fetch dynamically imported module");
    expect(safeErrorMessage("error loading dynamically imported module: https://pastpaperprep.com/x.js")).toBe("Failed to fetch dynamically imported module");
  });

  it("rejects non-strings and empty messages", () => {
    expect(safeErrorMessage(undefined)).toBeUndefined();
    expect(safeErrorMessage("   ")).toBeUndefined();
  });
});

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

describe("isBrowserExtensionError", () => {
  const withStack = (stack: string) => Object.assign(new TypeError("x"), { stack });

  it("recognises errors thrown only by extension code", () => {
    expect(isBrowserExtensionError(withStack("TypeError: x\n    at poll (chrome-extension://abcdefghijklmnop/content.js:1:2)\n    at chrome-extension://abcdefghijklmnop/content.js:9:9"))).toBe(true);
    expect(isBrowserExtensionError(withStack("poll@moz-extension://1234-5678/inject.js:3:4"))).toBe(true);
    expect(isBrowserExtensionError(withStack("poll@safari-web-extension://ABCD/inject.js:3:4"))).toBe(true);
  });

  it("keeps errors that touch the app's own code or carry no frames", () => {
    expect(isBrowserExtensionError(withStack("TypeError: x\n    at poll (chrome-extension://abc/content.js:1:2)\n    at render (https://pastpaperprep.com/_next/static/chunks/app.js:2:3)"))).toBe(false);
    expect(isBrowserExtensionError(withStack("TypeError: x\n    at render (https://pastpaperprep.com/_next/static/chunks/app.js:2:3)"))).toBe(false);
    expect(isBrowserExtensionError(withStack("TypeError: x"))).toBe(false);
    expect(isBrowserExtensionError(Object.assign(new Error("x"), { stack: undefined }))).toBe(false);
    expect(isBrowserExtensionError("chrome-extension://abc/content.js")).toBe(false);
  });

  it("keeps mixed, eval, unrecognised and truncated stacks", () => {
    // Review of #344: an app eval frame the frame pattern did not recognise was dropped before the ownership check.
    expect(isBrowserExtensionError(withStack("poll@moz-extension://1234-5678/inject.js:3:4\nrender@https://pastpaperprep.com/_next/static/chunks/app.js line 2 > eval:1:2"))).toBe(false);
    expect(isBrowserExtensionError(withStack("TypeError: x\n    at chrome-extension://abc/content.js:1:2\n    at eval (eval at render (https://pastpaperprep.com/_next/static/chunks/app.js:2:3), <anonymous>:1:2)"))).toBe(false);
    expect(isBrowserExtensionError(withStack("TypeError: x\n    at poll (chrome-extension://abc/content.js:1:2) https://pastpaperprep.com/_next/static/chunks/app.js:2:3"))).toBe(false);
    expect(isBrowserExtensionError(withStack("TypeError: x\n    at poll (chrome-extension://abc/content.js:1:2)\n    at <anonymous>"))).toBe(false);
    const long = Array.from({ length: 400 }, () => "    at poll (chrome-extension://abcdefghijklmnop/content.js:1:2)").join("\n");
    expect(isBrowserExtensionError(withStack(`TypeError: x\n${long}\n    at render (https://pastpaperprep.com/_next/static/chunks/app.js:2:3)`))).toBe(false);
  });
});
