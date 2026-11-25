import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({
  user: { id: "u1" } as { id: string } | null,
  listeners: [] as Array<(event: string, session: { user: { id: string } } | null) => void>,
}));
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: track }));
// A plain anchor, like the AA snapshot test: navigation is observed through the click it receives.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: auth.user ? { user: auth.user } : null } }),
      onAuthStateChange: (listener: (event: string, session: { user: { id: string } } | null) => void) => {
        auth.listeners.push(listener);
        return { data: { subscription: { unsubscribe: () => { auth.listeners = auth.listeners.filter((entry) => entry !== listener); } } } };
      },
    },
  }),
}));

import { forgetSiteChat } from "@/components/helper/site-chat-memory";
import { SiteHelperPanel } from "@/components/helper/SiteHelperPanel";

function ndjson(events: unknown[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      // Split mid-line to check the reader buffers partial lines.
      const text = events.map((event) => JSON.stringify(event)).join("\n") + "\n";
      const half = Math.floor(text.length / 2);
      controller.enqueue(encoder.encode(text.slice(0, half)));
      controller.enqueue(encoder.encode(text.slice(half)));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

/** Records link clicks the way the worksheet guard sees them (capture phase), and stops jsdom navigating. */
function watchLinkClicks(block = false) {
  const clicks: string[] = [];
  const listener = (event: MouseEvent) => {
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!link) return;
    clicks.push(link.getAttribute("href") ?? "");
    event.preventDefault();
    if (block) event.stopPropagation();
  };
  document.addEventListener("click", listener, true);
  return { clicks, stop: () => document.removeEventListener("click", listener, true) };
}

const panel = (onNavigated = () => {}) => <SiteHelperPanel onClose={() => {}} onNavigated={onNavigated} />;

describe("SiteHelperPanel", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { id: "u1" };
    auth.listeners = [];
    forgetSiteChat();
    window.history.replaceState(null, "", "/");
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("asks signed-out students to sign in", async () => {
    auth.user = null;
    render(panel());
    expect(await screen.findByRole("link", { name: "Create free account" })).toBeInTheDocument();
  });

  it("fills the box from a starter without sending", async () => {
    render(panel());
    await userEvent.click(await screen.findByRole("button", { name: "Find a past paper" }));
    expect(screen.getByRole("textbox")).toHaveValue("Open the past paper for ");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("streams the reply and opens the page by clicking its card, so link guards apply", async () => {
    const watch = watchLinkClicks();
    const onNavigated = vi.fn();
    fetchMock.mockResolvedValueOnce(ndjson([
      { type: "navigate", kind: "bank", path: "/banks/igcse?topic=Number&year=2024", label: "Number · 2024", bank: "igcse" },
      { type: "text", text: "Opened **Number** from 2024." },
      { type: "done", remaining: 4, limit: 5 },
    ]));
    render(panel(onNavigated));
    await userEvent.type(await screen.findByRole("textbox"), "2024 number questions{Enter}");

    expect(await screen.findByText("Number")).toBeInTheDocument();
    await waitFor(() => expect(watch.clicks).toEqual(["/banks/igcse?topic=Number&year=2024"]));
    expect(screen.getByRole("link", { name: /Number · 2024/ })).toHaveAttribute("href", "/banks/igcse?topic=Number&year=2024");
    expect(screen.getByText("4 left today")).toBeInTheDocument();
    expect(onNavigated).toHaveBeenCalled();
    watch.stop();
  });

  it("shows a built practice set as a card to check and save, opened like any link", async () => {
    const watch = watchLinkClicks();
    const path = "/worksheets/build?bank=igcse&route=extended&from=2022&to=2024&t=t%3AAlgebra+and+graphs&size=q10&seed=42";
    fetchMock.mockResolvedValueOnce(ndjson([
      { type: "navigate", kind: "build", path, label: "10 questions · Algebra and graphs · 2022–2024 · 57 marks", bank: "igcse" },
      { type: "text", text: "Built it. Check it and save it to My worksheets." },
      { type: "done", remaining: 4, limit: 5 },
    ]));
    render(panel());
    await userEvent.type(await screen.findByRole("textbox"), "10 algebra questions{Enter}");
    expect(await screen.findByText("Built · check and save")).toBeInTheDocument();
    await waitFor(() => expect(watch.clicks).toEqual([path]));
    watch.stop();
  });

  it("opens only one page per message", async () => {
    const watch = watchLinkClicks();
    fetchMock.mockResolvedValueOnce(ndjson([
      { type: "navigate", kind: "page", path: "/dashboard", label: "Banks" },
      { type: "navigate", kind: "page", path: "/pricing", label: "Plans" },
      { type: "text", text: "Done." },
      { type: "done", remaining: 4, limit: 5 },
    ]));
    render(panel());
    await userEvent.type(await screen.findByRole("textbox"), "banks and plans{Enter}");
    expect(await screen.findByText("Done.")).toBeInTheDocument();
    await waitFor(() => expect(watch.clicks).toEqual(["/dashboard"]));
    expect(screen.queryByRole("link", { name: /Plans/ })).not.toBeInTheDocument();
    watch.stop();
  });

  it("never opens a page it may not open", async () => {
    const watch = watchLinkClicks();
    fetchMock.mockResolvedValueOnce(ndjson([
      { type: "navigate", kind: "page", path: "/account", label: "Account" },
      { type: "text", text: "Done." },
      { type: "done", remaining: 4, limit: 5 },
    ]));
    render(panel());
    await userEvent.type(await screen.findByRole("textbox"), "open my account{Enter}");
    expect(await screen.findByText("Done.")).toBeInTheDocument();
    expect(watch.clicks).toEqual([]);
    watch.stop();
  });

  it("sends the path and chosen study filters only, never other query parameters", async () => {
    window.history.replaceState(null, "", "/banks/igcse?topic=Number&year=2024&worksheet=ws-123&utm_source=x&q=secret+search");
    fetchMock.mockResolvedValueOnce(ndjson([{ type: "text", text: "Sure." }, { type: "done", remaining: 3, limit: 5 }]));
    render(panel());
    await userEvent.type(await screen.findByRole("textbox"), "harder ones{Enter}");
    await screen.findByText("Sure.");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).page).toBe("/banks/igcse?topic=Number&year=2024");
  });

  it("keeps the chat for the same account across reopening, sends opened pages as notes, and clears on request", async () => {
    fetchMock.mockResolvedValueOnce(ndjson([
      { type: "navigate", kind: "bank", path: "/banks/ib-hl/topics/calculus", label: "Calculus" },
      { type: "text", text: "Here you go." },
      { type: "done", remaining: 4, limit: 5 },
    ]));
    const watch = watchLinkClicks();
    const first = render(panel());
    await userEvent.type(await screen.findByRole("textbox"), "AA HL calculus{Enter}");
    await screen.findByText("Here you go.");
    first.unmount();

    fetchMock.mockResolvedValueOnce(ndjson([{ type: "text", text: "Sure." }, { type: "done", remaining: 3, limit: 5 }]));
    render(panel());
    expect(await screen.findByText("AA HL calculus")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "only 2023{Enter}");
    await screen.findByText("Sure.");
    const sent = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(sent.messages[1]).toEqual({ role: "assistant", text: "Here you go.\n[Opened Calculus: /banks/ib-hl/topics/calculus]" });

    await userEvent.click(screen.getByRole("button", { name: "Clear chat" }));
    expect(screen.queryByText("AA HL calculus")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find questions" })).toBeInTheDocument();
    watch.stop();
  });

  it("never shows or sends one account's chat to another", async () => {
    fetchMock.mockResolvedValueOnce(ndjson([{ type: "text", text: "Answer for A." }, { type: "done", remaining: 4, limit: 5 }]));
    const first = render(panel());
    await userEvent.type(await screen.findByRole("textbox"), "message from A{Enter}");
    await screen.findByText("Answer for A.");
    first.unmount();

    auth.user = { id: "u2" };
    fetchMock.mockResolvedValueOnce(ndjson([{ type: "text", text: "Answer for B." }, { type: "done", remaining: 4, limit: 5 }]));
    render(panel());
    await userEvent.type(await screen.findByRole("textbox"), "message from B{Enter}");
    await screen.findByText("Answer for B.");
    expect(screen.queryByText("message from A")).not.toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).messages).toEqual([{ role: "user", text: "message from B" }]);
  });

  it("drops a reply still streaming when the account changes", async () => {
    let finish: () => void = () => {};
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        finish = () => {
          controller.enqueue(encoder.encode(`${JSON.stringify({ type: "text", text: "Late answer for A." })}\n`));
          controller.close();
        };
      },
    });
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    render(panel());
    await userEvent.type(await screen.findByRole("textbox"), "message from A{Enter}");
    expect(await screen.findByText("message from A")).toBeInTheDocument();

    await act(async () => { for (const listener of auth.listeners) listener("SIGNED_IN", { user: { id: "u2" } }); });
    await act(async () => { finish(); });
    expect(screen.queryByText("message from A")).not.toBeInTheDocument();
    expect(screen.queryByText("Late answer for A.")).not.toBeInTheDocument();
  });

  it("shows what Pepper is doing until the reply starts", async () => {
    let finish: () => void = () => {};
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "step", label: "Searching “vectors”" })}\n${JSON.stringify({ type: "step", label: "Checking IGCSE Maths 0580" })}\n`));
        finish = () => {
          controller.enqueue(encoder.encode(`${JSON.stringify({ type: "text", text: "Here you go." })}\n${JSON.stringify({ type: "done", remaining: 4, limit: 5 })}\n`));
          controller.close();
        };
      },
    });
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    render(panel());
    await userEvent.type(await screen.findByRole("textbox"), "vectors{Enter}");
    expect(await screen.findByText("Checking IGCSE Maths 0580")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Done so far" })).toHaveTextContent("Searching “vectors”");
    await act(async () => { finish(); });
    expect(await screen.findByText("Here you go.")).toBeInTheDocument();
    expect(screen.queryByText("Checking IGCSE Maths 0580")).not.toBeInTheDocument();
  });

  it("stops the reply the moment it is closed: nothing later opens or shows", async () => {
    const watch = watchLinkClicks();
    let finish: () => void = () => {};
    let signal: AbortSignal | undefined;
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        finish = () => {
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify({ type: "navigate", kind: "page", path: "/dashboard", label: "Banks" })}\n${JSON.stringify({ type: "text", text: "Late." })}\n`));
            controller.close();
          } catch {
            // Already cancelled by the abort.
          }
        };
      },
    });
    fetchMock.mockImplementationOnce(async (_url: string, init: RequestInit) => { signal = init.signal ?? undefined; return new Response(body, { status: 200 }); });
    const view = render(panel());
    await userEvent.type(await screen.findByRole("textbox"), "banks{Enter}");
    expect(await screen.findByText("banks")).toBeInTheDocument();

    view.rerender(<SiteHelperPanel onClose={() => {}} onNavigated={() => {}} closing />);
    expect(signal?.aborted).toBe(true);
    expect(view.container.querySelector("section")).toHaveAttribute("inert");
    await act(async () => { finish(); });
    expect(watch.clicks).toEqual([]);
    expect(screen.queryByText("Late.")).not.toBeInTheDocument();
    watch.stop();
  });

  it("shows the daily limit and gives the draft back", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "You've used today's 5 free helper messages." }), { status: 429 }));
    render(panel());
    await userEvent.type(await screen.findByRole("textbox"), "vectors{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("5 free helper messages");
    expect(screen.getByRole("textbox")).toHaveValue("vectors");
    expect(track).toHaveBeenCalledWith("helper_limit", { surface: "site" });
  });
});
