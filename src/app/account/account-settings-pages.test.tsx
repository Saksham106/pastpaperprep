import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { createClient } from "@/lib/supabase/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({createClient:vi.fn().mockResolvedValue({auth:{getClaims:async()=>({data:{claims:{sub:"user_example"}}})}})}));
vi.mock("@/lib/custom-bundle-access", () => ({fetchAccessEntitlements:vi.fn().mockResolvedValue({rows:[],error:null})}));
import SubscriptionPage from "@/app/account/subscription/page";
import BillingPage from "@/app/account/billing/page";
import SecurityPage from "@/app/account/security/page";
beforeEach(()=>vi.stubGlobal("fetch",vi.fn().mockImplementation(()=>new Promise(()=>{}))));
describe("combined account pages",()=>{
 it("does not invent a subscription while verified billing is loading",async()=>{
  render(await BillingPage());
  expect(screen.getByRole("heading",{name:"Subscription & billing"})).toBeVisible();
  expect(screen.getByRole("link",{name:/Compare plans/})).toHaveAttribute("href","/pricing");
  expect(screen.queryByRole("button",{name:/cancel subscription/})).toBeNull();
  expect(screen.queryByText(/\$\d+/)).toBeNull();
 });
 it("keeps manual All Access compact, without a second plan grid",async()=>{
  vi.mocked(fetchAccessEntitlements).mockResolvedValueOnce({rows:[{productId:"bundle_all",source:"manual",status:"active",startsAt:"2025-01-01T00:00:00Z",expiresAt:null}],error:null});
  const {container}=render(await BillingPage());
  expect(screen.getByRole("heading",{name:"Complimentary All Access"})).toBeVisible();
  expect(container.querySelector(".pricing-decision-grid")).toBeNull();
 });
 it("redirects the legacy Subscription route to the correct section",async()=>{
  await expect(Promise.resolve().then(SubscriptionPage)).rejects.toMatchObject({digest:expect.stringContaining("/account/billing#subscription")});
 });
 it("redirects if the authenticated session disappears",async()=>{
  vi.mocked(createClient).mockResolvedValueOnce({auth:{getClaims:async()=>({data:{claims:null}})}} as never);
  await expect(BillingPage()).rejects.toMatchObject({digest:expect.stringContaining("/login?next=/account/billing")});
 });
 it("keeps password settings and sign-out available",()=>{
  render(<SecurityPage/>);
  expect(screen.getByRole("link",{name:/password settings/i})).toHaveAttribute("href","/account/password");
  expect(screen.getByRole("button",{name:/sign out/i})).toBeVisible();
 });
});
