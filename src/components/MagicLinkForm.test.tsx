import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { requestMagicLink } = vi.hoisted(() => ({ requestMagicLink: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ requestMagicLink }));
import { MagicLinkForm } from "./MagicLinkForm";

async function submitEmail(email = "student@example.com") {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: email } });
  await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Send sign-in link" }).closest("form")!); });
}

beforeEach(() => {
  vi.useFakeTimers();
  requestMagicLink.mockReset();
  requestMagicLink.mockResolvedValue({ status: "success", message: "Check your email." });
});
afterEach(() => vi.useRealTimers());

describe("email-link next step", () => {
  it("makes inbox checking prominent and does not offer navigation before email confirmation", async () => {
    render(<MagicLinkForm next="/account/referrals" />);
    await submitEmail();
    expect(screen.getByRole("heading", { name: "Check your email" })).toHaveFocus();
    expect(screen.getByText("student@example.com")).toBeInTheDocument();
    expect(screen.getByText(/spam or junk/)).toBeInTheDocument();
    expect(screen.getByText(/newest email/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send sign-in link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /continue/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resend available in/i })).toBeDisabled();
  });

  it("requires a full cooldown before each explicit resend and preserves the referral return path", async () => {
    render(<MagicLinkForm next="/account/referrals" />);
    await submitEmail();
    const form = screen.getByRole("button", { name: /resend available in/i }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });
    expect(requestMagicLink).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(60000); });
    const resend = screen.getByRole("button", { name: "Request another link" });
    await act(async () => { fireEvent.submit(resend.closest("form")!); fireEvent.submit(resend.closest("form")!); });
    expect(requestMagicLink).toHaveBeenCalledTimes(2);
    expect([...requestMagicLink.mock.calls[1][1].entries()]).toEqual([["email", "student@example.com"], ["next", "/account/referrals"]]);
    expect(screen.getByRole("button", { name: /resend available in/i })).toBeDisabled();
    await act(async () => { vi.advanceTimersByTime(60000); });
    await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Request another link" }).closest("form")!); });
    expect(requestMagicLink).toHaveBeenCalledTimes(3);
  });

  it("allows changing email without reusing previous success during a pending or rejected request", async () => {
    render(<MagicLinkForm />);
    await submitEmail();
    fireEvent.click(screen.getByRole("button", { name: "Use a different email" }));
    expect(screen.getByLabelText("Email address")).toHaveFocus();
    let resolve!: (value: { status: "error"; message: string }) => void;
    requestMagicLink.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await submitEmail("changed@example.com");
    expect(screen.queryByRole("heading", { name: "Check your email" })).not.toBeInTheDocument();
    await act(async () => { resolve({ status: "error", message: "Check your inbox and wait a minute." }); });
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByLabelText("Email address")).toHaveValue("changed@example.com");
    await submitEmail("changed@example.com");
    expect(screen.getByText("changed@example.com")).toBeInTheDocument();
  });

  it("keeps the recipient and useful recovery controls after a resend failure", async () => {
    render(<MagicLinkForm />);
    await submitEmail();
    requestMagicLink.mockResolvedValueOnce({ status: "error", message: "An earlier email may already be on its way." });
    await act(async () => { vi.advanceTimersByTime(60000); });
    await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Request another link" }).closest("form")!); });
    expect(screen.getByText("student@example.com")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("An earlier email");
    expect(screen.getByRole("button", { name: "Use a different email" })).toBeEnabled();
    await act(async () => { vi.advanceTimersByTime(60000); });
    await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Request another link" }).closest("form")!); });
    expect(requestMagicLink).toHaveBeenCalledTimes(3);
  });
});
