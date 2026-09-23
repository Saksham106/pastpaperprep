import { StrictMode } from "react";
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

  it.each([
    "#access_token=header.payload.signature&type=invite",
    "#refresh_token=refresh-token&type=invite",
    "#access_token=header.payload.signature",
  ])("scrubs malformed auth fragments and fails closed: %s", async (hash) => {
    window.history.replaceState({}, "", `/start?source=email${hash}`);

    render(<InviteHandoff />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?error=invite"));
    expect(window.location.pathname).toBe("/start");
    expect(window.location.search).toBe("?source=email");
    expect(window.location.hash).toBe("");
    expect(setSession).not.toHaveBeenCalled();
  });

  it("completes exactly once under React Strict Mode", async () => {
    window.history.replaceState({}, "", "/#access_token=header.payload.signature&refresh_token=refresh-token&type=invite");

    render(<StrictMode><InviteHandoff /></StrictMode>);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/account/password?invited=1"));
    expect(setSession).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("");
  });

  it("fails closed when setSession throws synchronously", async () => {
    setSession.mockImplementation(() => {
      throw new Error("invalid session");
    });
    window.history.replaceState({}, "", "/#access_token=header.payload.signature&refresh_token=refresh-token&type=invite");

    render(<InviteHandoff />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?error=invite"));
    expect(window.location.hash).toBe("");
  });
});
