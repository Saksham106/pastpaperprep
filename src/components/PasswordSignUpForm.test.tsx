import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordSignUpForm } from "@/components/PasswordSignUpForm";

const { createAccountWithPassword, resendSignupConfirmation } = vi.hoisted(() => ({
  createAccountWithPassword: vi.fn(),
  resendSignupConfirmation: vi.fn(),
}));
vi.mock("@/app/auth/actions", () => ({ createAccountWithPassword, resendSignupConfirmation }));

describe("PasswordSignUpForm", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    createAccountWithPassword.mockReset();
    resendSignupConfirmation.mockReset();
    createAccountWithPassword.mockResolvedValue({ status: "success", message: "Check your email to confirm your account." });
    resendSignupConfirmation.mockResolvedValue({ status: "success", message: "If the signup is pending, a confirmation email is on its way." });
  });

  it("replaces the signup form with a distinct check-email state and can return to edit", async () => {
    const user = userEvent.setup();
    render(<PasswordSignUpForm next="/banks/ib-hl" />);
    await user.type(screen.getByLabelText("Email address"), "student@example.com");
    await user.type(screen.getByLabelText("Password"), "three calm otters");
    await user.type(screen.getByLabelText("Confirm password"), "three calm otters");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: /check your email/i })).toBeInTheDocument();
    expect(screen.getByText("student@example.com")).toBeInTheDocument();
    expect(screen.getByText(/spam or junk/i)).toBeInTheDocument();
    expect(screen.getByText(/newest email/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /check your email/i })).toHaveFocus();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByText(/confirm account/i)).not.toBeInTheDocument();
    const resend = screen.getByRole("button", { name: /resend available in/i });
    expect(resend).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /change email/i }));
    expect(screen.getByLabelText("Email address")).toHaveValue("student@example.com");
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("resends only after an explicit action, never repeats signup, and throttles rapid clicks", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
    render(<PasswordSignUpForm />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "three calm otters" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "three calm otters" } });
    await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!); });
    expect(screen.getByRole("heading", { name: /check your email/i })).toBeInTheDocument();

    await act(async () => { vi.advanceTimersByTime(60_000); });
    const resend = screen.getByRole("button", { name: /resend confirmation/i });
    expect(resend).toBeEnabled();
    await act(async () => { fireEvent.click(resend); });
    await act(async () => { await Promise.resolve(); });
    expect(resendSignupConfirmation).toHaveBeenCalledTimes(1);
    expect(resendSignupConfirmation).toHaveBeenCalledWith(expect.anything(), expect.any(FormData));
    expect([...resendSignupConfirmation.mock.calls[0][1].entries()]).toEqual([["email", "student@example.com"], ["next", "/pricing"]]);
    expect(createAccountWithPassword).toHaveBeenCalledTimes(1);
    expect(resend).toBeDisabled();

    await act(async () => {
      fireEvent.click(resend);
      fireEvent.click(resend);
    });
    expect(resendSignupConfirmation).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(resend).toBeEnabled();
    await act(async () => { fireEvent.click(resend); });
    expect(resendSignupConfirmation).toHaveBeenCalledTimes(2);
    expect(resend).toBeDisabled();
    vi.useRealTimers();
  });

  it("does not reuse old success while a changed-email signup is pending or rejected", async () => {
    const user = userEvent.setup();
    render(<PasswordSignUpForm />);
    await user.type(screen.getByLabelText("Email address"), "student@example.com");
    await user.type(screen.getByLabelText("Password"), "three calm otters");
    await user.type(screen.getByLabelText("Confirm password"), "three calm otters");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await screen.findByRole("heading", { name: /check your email/i });
    await user.click(screen.getByRole("button", { name: /change email/i }));
    let resolve: (value: { status: string; message: string }) => void = () => {};
    createAccountWithPassword.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "changed@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "three calm otters" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "three calm otters" } });
    await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!); });
    expect(screen.queryByRole("heading", { name: /check your email/i })).not.toBeInTheDocument();
    await act(async () => { resolve({ status: "error", message: "Could not create the account." }); });
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /check your email/i })).not.toBeInTheDocument();
    await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!); });
    expect(screen.getByRole("heading", { name: /check your email/i })).toBeInTheDocument();
  });

  it("returns to the form after invalid signup without exposing resend", async () => {
    createAccountWithPassword.mockResolvedValue({ status: "error", message: "Those passwords do not match." });
    const user = userEvent.setup();
    render(<PasswordSignUpForm />);
    await user.type(screen.getByLabelText("Email address"), "student@example.com");
    await user.type(screen.getByLabelText("Password"), "three calm otters");
    await user.type(screen.getByLabelText("Confirm password"), "three calm badgers");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/do not match/i);
    await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!); });
    expect(createAccountWithPassword).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resend/i })).not.toBeInTheDocument();
  });
});
