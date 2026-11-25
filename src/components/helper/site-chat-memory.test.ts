import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A fresh module per test is a "reload": memory is gone, only browser storage remains.
async function reload() {
  vi.resetModules();
  return import("@/components/helper/site-chat-memory");
}

const stored = () => Object.keys(sessionStorage).filter((key) => key.startsWith("ppp:pepper:"));

describe("Pepper chat history", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("keeps a chat across a reload, for the same account, until it is cleared", async () => {
    let memory = await reload();
    memory.rememberSiteChat("u1", [{ role: "user", text: "vectors" }, { role: "assistant", text: "Here you go." }]);
    vi.runAllTimers();
    memory = await reload();
    expect(memory.recallSiteChat("u1")).toEqual([{ role: "user", text: "vectors" }, { role: "assistant", text: "Here you go." }]);

    memory.rememberSiteChat("u1", []);
    memory = await reload();
    expect(memory.recallSiteChat("u1")).toEqual([]);
    expect(stored()).toEqual([]);
  });

  it("never stores photos, only that one was sent", async () => {
    let memory = await reload();
    memory.rememberSiteChat("u1", [{ role: "user", text: "Mark my working.", photo: "data:image/jpeg;base64,AAAA" }], "q:igcse:q1");
    vi.runAllTimers();
    expect(sessionStorage.getItem("ppp:pepper:v1:u1")).not.toContain("base64");
    memory = await reload();
    expect(memory.recallSiteChat("u1", "q:igcse:q1")).toEqual([{ role: "user", text: "Mark my working.", photo: memory.PHOTO_SENT }]);
  });

  it("never shows one account's chats to another, and deletes them when the account changes", async () => {
    let memory = await reload();
    memory.rememberSiteChat("u1", [{ role: "user", text: "from A" }]);
    vi.runAllTimers();
    memory = await reload();
    expect(memory.recallSiteChat("u2")).toEqual([]);
    expect(stored()).toEqual([]);
  });

  it("deletes every stored chat on sign-out", async () => {
    const memory = await reload();
    memory.rememberSiteChat("u1", [{ role: "user", text: "from A" }]);
    vi.runAllTimers();
    memory.forgetSiteChat();
    expect(stored()).toEqual([]);
    expect(memory.recallSiteChat("u1")).toEqual([]);
  });
});
