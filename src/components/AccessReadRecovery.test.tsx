import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccessReadRecovery } from "@/components/AccessReadRecovery";

describe("AccessReadRecovery", () => {
  it.each(["/account", "/dashboard"] as const)("offers a native manual retry to %s without asserting access", (retryPath) => {
    render(<AccessReadRecovery retryPath={retryPath} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("We couldn't check your access");
    expect(screen.getByRole("heading", { level: 1 }).closest("section")).toHaveClass("auth-page", "shell");
    expect(screen.getByRole("heading", { level: 1 }).closest("article")).toHaveClass("auth-card");
    const retry = screen.getByRole("link", { name: "Try again" });
    expect(retry).toHaveAttribute("href", retryPath);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/checkout|unpaid|free plan|upgrade|sign in/i);
    // Native anchor works without hydration and triggers no automatic retries.
    expect(retry.tagName).toBe("A");
  });
});
