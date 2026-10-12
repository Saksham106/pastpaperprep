import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const actions = vi.hoisted(() => ({ requestMagicLink: vi.fn(), verifyEmailCode: vi.fn(), createAccountWithPassword: vi.fn(), resendSignupConfirmation: vi.fn(), signInWithGoogle: vi.fn() }));
vi.mock("@/app/auth/actions", () => actions);
import { EmailCodeForm } from "./CheckEmailHelp";
import { MagicLinkForm } from "./MagicLinkForm";
import { PasswordSignUpForm } from "./PasswordSignUpForm";
import { GoogleSignInButton } from "./GoogleSignInButton";
beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks();
  actions.requestMagicLink.mockResolvedValue({ status: "success", message: "accepted" });
  actions.createAccountWithPassword.mockResolvedValue({ status: "success", message: "accepted" });
  actions.verifyEmailCode.mockResolvedValue({ status: "error", message: "Invalid code" });
  actions.resendSignupConfirmation.mockResolvedValue({ status: "success", message: "Old recipient resend accepted" });
});
afterEach(() => vi.useRealTimers());
async function request(kind: "magic" | "signup", email = "student@school.example") {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: email } });
  await act(async () => { fireEvent.submit(screen.getByRole("button", { name: kind === "magic" ? "Send sign-in link" : "Create account" }).closest("form")!); });
}
it.each([
  ["magic", "verify"], ["magic", "resend"], ["signup", "verify"], ["signup", "resend"],
] as const)("serializes %s %s with other inbox actions in the same turn", async (kind, operation) => {
  render(kind === "magic" ? <MagicLinkForm /> : <PasswordSignUpForm />); await request(kind);
  await act(async () => { vi.advanceTimersByTime(60_000); });
  let finish!: (value: { status: string; message: string }) => void;
  const deferred = new Promise(resolve => { finish = resolve; });
  const resendAction = kind === "magic" ? actions.requestMagicLink : actions.resendSignupConfirmation;
  if (operation === "verify") actions.verifyEmailCode.mockReturnValueOnce(deferred);
  else resendAction.mockReturnValueOnce(deferred);
  const code = screen.getByRole("button", { name: "Confirm" }).closest("form")!;
  const resend = screen.getByRole("button", { name: "Resend email" }).closest("form")!;
  const change = screen.getByRole("button", { name: "Change email" });
  const personal = screen.getByRole("button", { name: "Use a personal email" });
  await act(async () => {
    fireEvent.submit(operation === "verify" ? code : resend);
    fireEvent.submit(operation === "verify" ? resend : code);
    fireEvent.click(change); fireEvent.click(personal);
  });
  try {
    expect(actions.verifyEmailCode).toHaveBeenCalledTimes(operation === "verify" ? 1 : 0);
    expect(resendAction).toHaveBeenCalledTimes((kind === "magic" ? 1 : 0) + (operation === "resend" ? 1 : 0));
    expect(change).toBeDisabled(); expect(personal).toBeDisabled();
    expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
  } finally {
    await act(async () => { finish({ status: "error", message: "Try again" }); });
  }
  fireEvent.click(screen.getByRole("button", { name: "Change email" }));
  expect(screen.getByLabelText("Email address")).toHaveFocus();
});
it.each(["error", "success"] as const)("clears signup resend %s feedback after a new recipient succeeds", async (status) => {
  actions.resendSignupConfirmation.mockResolvedValueOnce({ status, message: "Old recipient resend accepted" });
  const feedback = status === "success" ? "Requested again. Use the newest email." : "Old recipient resend accepted";
  render(<PasswordSignUpForm />); await request("signup");
  await act(async () => { vi.advanceTimersByTime(60_000); });
  await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Resend email" }).closest("form")!); });
  expect(screen.getByText(feedback)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Change email" }));
  await request("signup", "other@gmail.com");
  expect(screen.getByText("other@gmail.com")).toBeInTheDocument();
  expect(screen.queryByText(feedback)).not.toBeInTheDocument();
});
it.each(["magic", "signup"] as const)("keeps %s check-email copy short and offers the code without claiming delivery", async (kind) => {
  render(kind === "magic" ? <MagicLinkForm /> : <PasswordSignUpForm />); await request(kind);
  expect(screen.getByText(/link and code at/i)).toBeInTheDocument();
  expect(screen.getByLabelText("Enter the code")).toBeInTheDocument();
  expect(screen.queryByText(/sent|delivered/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /continue/i })).not.toBeInTheDocument();
});
it.each(["magic", "signup"] as const)("describes %s resend acceptance rather than delivery", async (kind) => {
  render(kind === "magic" ? <MagicLinkForm /> : <PasswordSignUpForm />); await request(kind);
  await act(async () => { vi.advanceTimersByTime(60_000); });
  await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Resend email" }).closest("form")!); });
  expect(screen.getByRole("status")).toHaveTextContent("Requested again. Use the newest email.");
});
it.each(["Change email", "Use a personal email"])("focuses the signup recipient after %s", async (button) => {
  render(<PasswordSignUpForm />); await request("signup");
  const control = screen.getByRole("button", { name: button });
  control.focus(); fireEvent.click(control);
  expect(screen.getByLabelText("Email address")).toHaveFocus();
  expect(screen.getByLabelText("Email address")).toHaveValue(button === "Change email" ? "student@school.example" : "");
});
it("blocks same-turn Google submissions and releases when the action returns", async () => {
  actions.signInWithGoogle.mockResolvedValue(undefined);
  render(<GoogleSignInButton next="/account" />);
  const form = screen.getByRole("button", { name: "Continue with Google" }).closest("form")!;
  await act(async () => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(actions.signInWithGoogle).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.submit(form); });
  expect(actions.signInWithGoogle).toHaveBeenCalledTimes(2);
});
it("blocks same-turn code submissions and releases after an error", async () => {
  render(<EmailCodeForm email="a@example.com" type="signup" next="/account" />);
  fireEvent.change(screen.getByLabelText("Enter the code"), { target: { value: "12345678" } });
  const form = screen.getByRole("button", { name: "Confirm" }).closest("form")!;
  await act(async () => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(actions.verifyEmailCode).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.submit(form); });
  expect(actions.verifyEmailCode).toHaveBeenCalledTimes(2);
});
