import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({ user: { id: "u1" } as { id: string } | null }));
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: track }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/" }));
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({ auth: { getSession: async () => ({ data: { session: session.user ? { user: session.user } : null } }) } }),
}));

import { SiteHelperPanel } from "@/components/helper/SiteHelperPanel";
import { HELPER_SITE_STORAGE_KEY } from "@/lib/helper/site-config";

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

describe("SiteHelperPanel", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    session.user = { id: "u1" };
    sessionStorage.clear();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("asks signed-out students to sign in", async () => {
    session.user = null;
    render(<SiteHelperPanel onClose={() => {}} onNavigated={() => {}} />);
    expect(await screen.findByRole("link", { name: "Create free account" })).toBeInTheDocument();
  });

  it("fills the box from a starter without sending", async () => {
    render(<SiteHelperPanel onClose={() => {}} onNavigated={() => {}} />);
    await userEvent.click(await screen.findByRole("button", { name: "Find a past paper" }));
    expect(screen.getByRole("textbox")).toHaveValue("Open the past paper for ");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("streams the reply, follows the navigation and shows an opened-page card", async () => {
    const onNavigated = vi.fn();
    fetchMock.mockResolvedValueOnce(ndjson([
      { type: "navigate", kind: "bank", path: "/banks/igcse?topic=Number&year=2024", label: "Number · 2024", bank: "igcse" },
      { type: "text", text: "Opened **Number** from 2024." },
      { type: "done", remaining: 4, limit: 5 },
    ]));
    render(<SiteHelperPanel onClose={() => {}} onNavigated={onNavigated} />);
    await userEvent.type(await screen.findByRole("textbox"), "2024 number questions{Enter}");

    expect(await screen.findByText("Number")).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/banks/igcse?topic=Number&year=2024");
    expect(screen.getByRole("link", { name: /Number · 2024/ })).toHaveAttribute("href", "/banks/igcse?topic=Number&year=2024");
    expect(screen.getByText("4 left today")).toBeInTheDocument();
    expect(onNavigated).toHaveBeenCalled();
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sent).toEqual({ page: "/", messages: [{ role: "user", text: "2024 number questions" }] });
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem(HELPER_SITE_STORAGE_KEY) ?? "[]")).toHaveLength(2));
  });

  it("never follows a navigation to a page it may not open", async () => {
    fetchMock.mockResolvedValueOnce(ndjson([
      { type: "navigate", kind: "page", path: "/account", label: "Account" },
      { type: "text", text: "Done." },
      { type: "done", remaining: 4, limit: 5 },
    ]));
    render(<SiteHelperPanel onClose={() => {}} onNavigated={() => {}} />);
    await userEvent.type(await screen.findByRole("textbox"), "open my account{Enter}");
    expect(await screen.findByText("Done.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("sends earlier opened pages back as notes, and restores the chat after a reload", async () => {
    sessionStorage.setItem(HELPER_SITE_STORAGE_KEY, JSON.stringify([
      { role: "user", text: "AA HL calculus" },
      { role: "assistant", text: "Here you go.", opened: [{ path: "/banks/ib-hl/topics/calculus", label: "Calculus" }] },
    ]));
    fetchMock.mockResolvedValueOnce(ndjson([{ type: "text", text: "Sure." }, { type: "done", remaining: 3, limit: 5 }]));
    render(<SiteHelperPanel onClose={() => {}} onNavigated={() => {}} />);
    expect(await screen.findByText("AA HL calculus")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "only 2023{Enter}");
    await screen.findByText("Sure.");
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sent.messages[1]).toEqual({ role: "assistant", text: "Here you go.\n[Opened Calculus: /banks/ib-hl/topics/calculus]" });
  });

  it("shows the daily limit and gives the draft back", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "You've used today's 5 free helper messages." }), { status: 429 }));
    render(<SiteHelperPanel onClose={() => {}} onNavigated={() => {}} />);
    await userEvent.type(await screen.findByRole("textbox"), "vectors{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("5 free helper messages");
    expect(screen.getByRole("textbox")).toHaveValue("vectors");
    expect(track).toHaveBeenCalledWith("helper_limit", { surface: "site" });
  });
});
