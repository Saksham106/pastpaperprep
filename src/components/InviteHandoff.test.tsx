import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InviteHandoff } from "@/components/InviteHandoff";

const { replace, setSession, createClient } = vi.hoisted(() => ({
  replace: vi.fn(),
  setSession: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/supabase/browser", () => ({ createClient }));

describe("InviteHandoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockReturnValue({ auth: { setSession } });
    setSession.mockResolvedValue({ error: null });
    window.history.replaceState({}, "", "/");
  });

  it("turns a Supabase dashboard invite fragment into a password-setup session", async () => {
    window.history.replaceState({}, "", "/#access_token=header.payload.signature&refresh_token=refresh-token&type=invite");

    render(<InviteHandoff />);

    await waitFor(() => expect(setSession).toHaveBeenCalledWith({
      access_token: "header.payload.signature",
      refresh_token: "refresh-token",
    }));
    expect(window.location.hash).toBe("");
    expect(replace).toHaveBeenCalledWith("/account/password?invited=1");
  });

  it("ignores ordinary homepage visits", async () => {
    render(<InviteHandoff />);

    await Promise.resolve();
    expect(setSession).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("fails closed when the invite session cannot be established", async () => {
    setSession.mockResolvedValue({ error: new Error("expired") });
    window.history.replaceState({}, "", "/#access_token=header.payload.signature&refresh_token=refresh-token&type=invite");

    render(<InviteHandoff />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?error=invite"));
    expect(window.location.hash).toBe("");
  });
});
