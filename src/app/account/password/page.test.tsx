import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/components/PasswordSettingsForm", () => ({ PasswordSettingsForm: () => <div>password form</div> }));

import PasswordPage from "./page";

describe("invited account password setup", () => {
  it("clearly asks an authenticated invitee to finish creating their account", async () => {
    createClient.mockResolvedValue({ auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "invited-user" } } }) } });

    const node = await PasswordPage({ searchParams: Promise.resolve({ invited: "1" }) });
    const markup = renderToStaticMarkup(node);

    expect(markup).toContain("Finish creating your account.");
    expect(markup).toContain("Create a password for this invited email address");
    expect(markup).toContain("password form");
  });
});
