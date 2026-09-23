import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthEntry } from "@/components/AuthEntry";

vi.mock("@/components/SignInMethods", () => ({ SignInMethods: () => <div>Existing sign-in methods</div> }));
vi.mock("@/components/PasswordSignUpForm", () => ({ PasswordSignUpForm: () => <div>New account form</div> }));

describe("AuthEntry", () => {
  it("makes account creation explicit without changing the default sign-in flow", () => {
    render(<AuthEntry next="/dashboard" />);

    expect(screen.getByRole("heading", { name: /sign in to pastpaperprep/i })).toBeInTheDocument();
    expect(screen.getByText("Existing sign-in methods")).toBeInTheDocument();
    expect(screen.queryByText("New account form")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: /account options/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /create a free account/i }));

    expect(screen.getByRole("heading", { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByText("New account form")).toBeInTheDocument();
    expect(screen.queryByText("Existing sign-in methods")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /sign in instead/i }));
    expect(screen.getByText("Existing sign-in methods")).toBeInTheDocument();
  });

  it("moves keyboard focus to the new mode heading", async () => {
    const user = userEvent.setup();
    render(<AuthEntry next="/dashboard" />);

    const createAccount = screen.getByRole("button", { name: /create a free account/i });
    createAccount.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("heading", { name: /create your account/i })).toHaveFocus();

    const signIn = screen.getByRole("button", { name: /sign in instead/i });
    signIn.focus();
    await user.keyboard(" ");

    expect(screen.getByRole("heading", { name: /sign in to pastpaperprep/i })).toHaveFocus();
  });

  it("preserves the invalid-link message in the sign-in flow", () => {
    render(<AuthEntry next="/dashboard" hasLinkError />);

    expect(screen.getByRole("alert")).toHaveTextContent(/invalid or expired/i);
    fireEvent.click(screen.getByRole("button", { name: /create a free account/i }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /sign in instead/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/invalid or expired/i);
  });
});
