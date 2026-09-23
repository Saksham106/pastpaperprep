import { fireEvent, render, screen } from "@testing-library/react";
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
});
