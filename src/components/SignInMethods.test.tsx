import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignInMethods } from "@/components/SignInMethods";

vi.mock("@/components/PasswordSignInForm", () => ({ PasswordSignInForm: () => <div>Password form</div> }));
vi.mock("@/components/MagicLinkForm", () => ({ MagicLinkForm: () => <div>Email link form</div> }));

describe("SignInMethods", () => {
  it("shows one sign-in method at a time with a clear switch", () => {
    render(<SignInMethods next="/dashboard" />);

    expect(screen.getByText("Password form")).toBeInTheDocument();
    expect(screen.queryByText("Email link form")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /password/i })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: /email link/i }));
    expect(screen.queryByText("Password form")).not.toBeInTheDocument();
    expect(screen.getByText("Email link form")).toBeInTheDocument();
  });
});
