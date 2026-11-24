import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: track }));

import { HelperPanel } from "@/components/helper/HelperPanel";
import { HELPER_NAME, HELPER_PHOTO_NOTE } from "@/lib/helper/config";

const props = { bank: "igcse", questionId: "q1", questionLabel: "2021 June · Paper 4 · Question 3", authenticated: true, freePreview: true };

function streamResponse(chunks: string[], headers: Record<string, string> = {}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "X-Helper-Remaining": "4", "X-Helper-Limit": "5", ...headers } });
}

describe("HelperPanel", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("asks signed-out students to sign in", () => {
    render(<HelperPanel {...props} authenticated={false} />);
    expect(screen.getByRole("link", { name: "Create free account" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Give me a hint/ })).not.toBeInTheDocument();
  });

  it("sends a chip as the student's message and shows the streamed reply", async () => {
    fetchMock.mockResolvedValueOnce(streamResponse(["Try **expanding** ", "first."]));
    render(<HelperPanel {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /^Give me a hint/ }));

    expect(await screen.findByText("expanding")).toBeInTheDocument();
    expect(screen.getByText("Give me a hint.")).toBeInTheDocument();
    expect(screen.getByText(/4 left today/)).toBeInTheDocument();
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sent).toMatchObject({ bank: "igcse", questionId: "q1", mode: "hint", messages: [{ role: "user", text: "Give me a hint." }] });
    expect(track).toHaveBeenCalledWith("helper_chip", expect.objectContaining({ chip: "hint" }));
  });

  it("sends the conversation so far with a typed follow-up", async () => {
    fetchMock.mockResolvedValueOnce(streamResponse(["Expand the bracket."])).mockResolvedValueOnce(streamResponse(["Because the sign flips."]));
    render(<HelperPanel {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /^Explain the whole answer/ }));
    await screen.findByText("Expand the bracket.");
    await userEvent.type(screen.getByRole("textbox", { name: `Message ${HELPER_NAME}` }), "Why negative?{Enter}");
    await screen.findByText("Because the sign flips.");
    const sent = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(sent.mode).toBe("chat");
    expect(sent.messages).toEqual([
      { role: "user", text: "Explain the whole answer." },
      { role: "assistant", text: "Expand the bracket." },
      { role: "user", text: "Why negative?" },
    ]);
  });

  it("shows the daily-limit message and keeps the history clean", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "You've used today's 5 free helper messages." }), { status: 429 }));
    render(<HelperPanel {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /^Give me a hint/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("today's 5 free helper messages");
    await waitFor(() => expect(screen.queryByText("Give me a hint.")).not.toBeInTheDocument());
    expect(track).toHaveBeenCalledWith("helper_limit", expect.objectContaining({ bank: "igcse" }));
  });

  it("marks typed working from the Mark chip when there is no photo", async () => {
    fetchMock.mockResolvedValueOnce(streamResponse(["Mark: 2 / 3\n\nNearly."]));
    render(<HelperPanel {...props} />);
    await userEvent.type(screen.getByRole("textbox", { name: `Message ${HELPER_NAME}` }), "x = 4");
    await userEvent.click(screen.getByRole("button", { name: /^Mark my photo/ }));
    await screen.findByText("Nearly.");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject({ mode: "mark", messages: [{ role: "user", text: "x = 4" }] });
    expect(track).toHaveBeenCalledWith("helper_result", expect.objectContaining({ mode: "mark", score: 2, total: 3 }));
  });

  it("tells follow-ups that an earlier message carried a photo", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 10, height: 10, close: vi.fn() })));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: "" } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,AAAA");
    fetchMock.mockResolvedValueOnce(streamResponse(["Mark: 0 / 1"])).mockResolvedValueOnce(streamResponse(["Sure."]));
    const { container } = render(<HelperPanel {...props} />);
    await userEvent.upload(container.querySelector('input[type="file"]') as HTMLInputElement, new File(["x"], "w.jpg", { type: "image/jpeg" }));
    await userEvent.click(screen.getByRole("button", { name: /^Mark my photo/ }));
    await screen.findByRole("img", { name: "Marked 0 out of 1" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).image).toBe("data:image/jpeg;base64,AAAA");
    await userEvent.type(screen.getByRole("textbox", { name: `Message ${HELPER_NAME}` }), "Why?{Enter}");
    await screen.findByText("Sure.");
    const sent = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(sent.image).toBeUndefined();
    expect(sent.messages[0].text).toBe(`Mark my working.\n${HELPER_PHOTO_NOTE}`);
  });
});
